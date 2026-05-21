import moment from 'moment-business-days';
import { _isBlank, _booleish } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { validateAccessCode } from 'evolution-backend/lib/services/accessCode';
import { getPath, getResponse } from 'evolution-common/lib/utils/helpers';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import { getPreFilledResponseByPath } from 'evolution-backend/lib/services/interviews/serverFieldUpdate';
import { randomFromDistribution } from 'chaire-lib-common/lib/utils/RandomUtils';
import interviewsDbQueries from 'evolution-backend/lib/models/interviews.db.queries';
import participantsDbQueries from 'evolution-backend/lib/models/participants.db.queries';
import { eightDigitsAccessCodeFormatter } from 'evolution-common/lib/utils/formatters';
import { InterviewAttributes } from 'evolution-common/lib/services/questionnaire/types';
import { postalCodeValidation } from 'evolution-common/lib/services/widgets/validations/validations';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import { getTransitSummary } from 'evolution-backend/lib/services/routing';

// *** Code for the home address prefill **
const HOME_ADDRESS_KEY = 'home.address';
const HOME_ADDRESS_IS_PREFILLED_KEY = 'home._addressIsPrefilled';
const getPrefilledForAccessCode = async (accessCode, interview) => {
    const prefilledResponses = await getPreFilledResponseByPath(accessCode, interview);
    if (prefilledResponses[HOME_ADDRESS_KEY] !== undefined) {
        prefilledResponses[HOME_ADDRESS_IS_PREFILLED_KEY] = true;
    }
    return prefilledResponses;
};

// *** Code for the assigned day ***
const assignedDayPath = '_assignedDay';
const originalAssignedDayPath = '_originalAssignedDay';
const ASSIGNED_DAY_UPDATE_FREQ_MINUTES = 15;
let lastCheckMoment = undefined;
const assignedDays = [0, 0, 0, 0, 0, 0, 0];
const assignedDayTarget = [0.2, 0.2, 0.2, 0.2, 0.2, 0, 0];
const defaultProbabilityOfDaysBefore = [0.6, 0.2, 0.13, 0.07];
const getAssignedDayRates = (): number[] | undefined => {
    const total = assignedDays.reduce((sum, current) => sum + current, 0);
    // Do not play with days below 500 surveys
    if (total < 500) {
        return undefined;
    }
    return assignedDays.map((dayCount) => dayCount / total);
};

// Exported so it can be called in unit tests
export const updateAssignedDayRates = async () => {
    console.log('Updating assigned day rates...');
    // Filter completed interviews only and interviews that are not invalid (value can be null or true, so we need to use 'not' false)
    const filters = {
        'response._isCompleted': { value: true },
        is_valid: { value: false, op: 'not' as const }
    };
    if (lastCheckMoment !== undefined) {
        filters['response._completedAt'] = { value: Math.ceil(lastCheckMoment.valueOf() / 1000), op: 'gte' };
    }
    const currentCheck = moment();
    lastCheckMoment = currentCheck;
    let interviewCount = 0;
    const queryStream = interviewsDbQueries.getInterviewsStream({
        filters,
        select: { responseType: 'correctedIfAvailable', includeAudits: false }
    });
    return new Promise<void>((resolve, reject) => {
        queryStream
            .on('error', (error) => {
                console.error('queryStream failed', error);
                reject(error);
            })
            .on('data', (row) => {
                const interview = row;
                interviewCount++;

                const assignedDate = getResponse(interview, assignedDayPath);
                if (assignedDate !== undefined) {
                    const momentDay = moment(assignedDate);
                    if (momentDay.isHoliday() && momentDay.isoWeekday() < 6) {
                        // Holiday in a weekday, ignore from count
                        return;
                    }
                    assignedDays[momentDay.isoWeekday() - 1]++;
                }
            })
            .on('end', () => {
                console.log('Updated assigned day rates with the data from %d interviews', interviewCount);
                resolve();
            });
    });
};

const periodicAssignedDatRatesUpdate = async () => {
    await updateAssignedDayRates();
    setTimeout(periodicAssignedDatRatesUpdate, ASSIGNED_DAY_UPDATE_FREQ_MINUTES * 60 * 1000); // Update every X minutes
};

// To avoid the first query when the server restarts to be long when there's a lot of data, make it run asynchronously now.
try {
    console.log('Calculating assigned day rates for the first time');
    periodicAssignedDatRatesUpdate().then(() => {
        console.log('Assigned day rates at start:', assignedDays.toString());
    });
} catch (error) {
    console.error('Error at first calculation of assigned day rates: ', error);
}

// Minimal time between updates to check if the trip date was too far in the past
const UPDATE_DELAY_FOR_TRIP_DATE_CHECK_MS = 12 * 60 * 60 * 1000; // 12 hours
const DAYS_BEFORE_REVISING_DATE = 5;

// Use the postal code validation to validate the postal code
// FIXME We can't use the postal code validation from the widget directly here because it's in a .tsx file and the `checkValidation` function from which this functionw as copy-pasted also is in the evolution-frontend package, so we can't use it in the backend.
const validatePostalCode = (postalCode: string, interview: InterviewAttributes): boolean => {
    const validationsGroup = postalCodeValidation(postalCode, undefined, interview, 'home.postalCode');
    for (let i = 0; i < validationsGroup.length; i++) {
        if (validationsGroup[i].validation === true) {
            return false;
        }
    }
    return true;
};

// Calculate the assigned day from the previous day, using the distribution of
// assigned days so far to balance the assigned days. Exported for unit tests
export const calculateAssignedDayFromPreviousDay = (previousDay: string): string => {
    const prevDay = moment(previousDay);
    const dow = prevDay.isoWeekday() - 1;
    const currentDayRates = getAssignedDayRates();
    if (currentDayRates === undefined && assignedDayTarget[dow] !== 0) {
        return previousDay;
    }
    const probabilities = [];
    // Divide target by current rate and put to the power of 3, then multiply by default probability.
    // FIXME Fine-tune if necessary
    for (let i = 0; i < 4; i++) {
        const dow = !prevDay.isHoliday() ? prevDay.isoWeekday() - 1 : 6;
        probabilities.push(
            assignedDayTarget[dow] === 0
                ? 0
                : Math.max(
                    0.01,
                    Math.pow(
                        assignedDayTarget[dow] /
                              Math.max(0.005, currentDayRates === undefined ? 1 : currentDayRates[dow]),
                        3
                    )
                ) *
                      defaultProbabilityOfDaysBefore[i] *
                      100
        );
        prevDay.subtract(1, 'days');
    }

    const totalProbability = probabilities.reduce((total, prob) => total + prob, 0);
    const daysBeforePrevDay = randomFromDistribution(probabilities, undefined, totalProbability);
    const formattedAssignedDay = (
        daysBeforePrevDay > 0 ? moment(previousDay).subtract(daysBeforePrevDay, 'days') : moment(previousDay)
    ).format('YYYY-MM-DD');
    return formattedAssignedDay;
};

// An array of probabilities with exclusive options. The first element of the
// array is the upper bound of the probability (the lower bound is the previous
// element), while the second element is the name of the sample. With a random
// value between 0 and 1, the first sample whose upper bound is higher than the
// random value will be selected. The upper bounds should be in increasing order
// and the last upper bound should be 1 or more.
const epExclusiveProbabilities: [number, string][] = [
    [0.05, 'householdType'],
    [0.1, 'omission'],
    [0.47, 'paidParking'],
    [0.5, 'respect'],
    [0.6, 'freqAttitudinal'],
    [0.7, 'freqBarriers'],
    [0.8, 'freqAttitudinalBarriers'],
    [1, 'mtmd']
];
const possibleExclusiveSamples = epExclusiveProbabilities.map((item) => item[1]);
const commonTripProbability = 0.5;
const sameModeProbability = 0.5;
/**
 * Set partial samples for interview once if it is not already set and the
 * prefilled values do not contain a value for them (additional values are
 * stored in home.preData).
 *
 * This function mutates and returns the currentAdditionalData object with the
 * new values to set
 *
 * ```
 * `ep.exclusive` is a string field corresponding to the name of the exclusive sample
 * `ep.commonTrip` is a boolean field
 * `ep.sameMode` is a boolean field
 * ```
 */
const setPartialSamples = (interview: InterviewAttributes, currentAdditionalData: Record<string, unknown>) => {
    // Set the current exclusive if it is not set or if not a valid value
    const currentExclusiveSample = getResponse(interview, 'ep.exclusive', null);
    if (typeof currentExclusiveSample !== 'string' || !possibleExclusiveSamples.includes(currentExclusiveSample)) {
        let exclusiveSample = currentAdditionalData['home.preData']?.['ep.exclusive'];
        if (typeof exclusiveSample !== 'string' || !possibleExclusiveSamples.includes(exclusiveSample)) {
            const randomValue = Math.random();
            for (let i = 0; i < epExclusiveProbabilities.length; i++) {
                if (randomValue <= epExclusiveProbabilities[i][0]) {
                    exclusiveSample = epExclusiveProbabilities[i][1];
                    break;
                }
            }
        }
        currentAdditionalData['ep.exclusive'] = exclusiveSample;
    }
    // Set the common trip and same mode samples if not set. If there are
    // prefilled values for them, use them after making sure to convert it to
    // booleish values
    const currentCommonTrip = getResponse(interview, 'ep.commonTrip', null);
    if (currentCommonTrip === null) {
        const prefilledCommonTrip = _booleish(currentAdditionalData['home.preData']?.['ep.commonTrip']);
        if (prefilledCommonTrip !== null) {
            currentAdditionalData['ep.commonTrip'] = prefilledCommonTrip;
        } else {
            currentAdditionalData['ep.commonTrip'] = _booleish(Math.random() <= commonTripProbability);
        }
    }

    const currentSameMode = getResponse(interview, 'ep.sameMode', null);
    if (currentSameMode === null) {
        const prefilledSameMode = _booleish(currentAdditionalData['home.preData']?.['ep.sameMode']);
        if (prefilledSameMode !== null) {
            currentAdditionalData['ep.sameMode'] = prefilledSameMode;
        } else {
            currentAdditionalData['ep.sameMode'] = _booleish(Math.random() <= sameModeProbability);
        }
    }
    return currentAdditionalData;
};

export default [
    {
        field: '_previousDay',
        callback: async (interview, value) => {
            const assignedDay = getResponse(interview, assignedDayPath);
            if (!_isBlank(assignedDay)) {
                // already assigned
                return {};
            }
            try {
                const formattedAssignedDay = calculateAssignedDayFromPreviousDay(value);
                return {
                    [assignedDayPath]: formattedAssignedDay,
                    [originalAssignedDayPath]: formattedAssignedDay
                };
            } catch (error) {
                console.error('Error getting the assigned day for survey', error);
                // Error, fallback to previous business day
                return { [assignedDayPath]: value, [originalAssignedDayPath]: value };
            }
        }
    },
    {
        field: 'accessCode',
        callback: async (interview: InterviewAttributes, value) => {
            try {
                // FIXME In od_mtl, prefilling data should come after confirming access code, but it is not implemented yet. See https://github.com/chairemobilite/od_mtl/issues/110

                const properlyFormattedAccessCode =
                    typeof value === 'string' ? eightDigitsAccessCodeFormatter(value) : value;
                // Only valid access codes should be processed
                if (_isBlank(value) || !validateAccessCode(properlyFormattedAccessCode)) {
                    return {};
                }
                // To avoid multiple changes to the access code, we check if it has already been confirmed, if so, simply return.
                const accessCodeConfirmed = getResponse(interview, '_accessCodeConfirmed', false);
                if (accessCodeConfirmed) {
                    return {};
                }

                // Get prefilled responses for this access code
                const prefilledResponses = await getPrefilledForAccessCode(properlyFormattedAccessCode, interview);

                if (properlyFormattedAccessCode !== value) {
                    prefilledResponses['accessCode'] = properlyFormattedAccessCode;
                }
                // Set the access code as confirmed
                prefilledResponses['_accessCodeConfirmed'] = true;

                return setPartialSamples(interview, prefilledResponses);
            } catch (error) {
                console.error('error getting server update fields for accessCode', error);
                return {};
            }
        }
    },
    {
        field: '_sections._actions',
        runOnValidatedData: false, // make sure not to run in validation mode!
        callback: async (interview: InterviewAttributes, value) => {
            // FIXME When https://github.com/chairemobilite/evolution/issues/1138 is implemented, this should be done in that hook and not here, as it is a hack to hook on a field that is updated right after a new login/access
            try {
                const updatedAtDate = moment(interview.updated_at);
                const now = moment();
                const lastUpdateDelayMs = now.valueOf() - updatedAtDate.valueOf();

                if (!(_isBlank(interview.updated_at) || lastUpdateDelayMs > UPDATE_DELAY_FOR_TRIP_DATE_CHECK_MS)) {
                    // The interview was updated recently, do not check the trip date
                    return {};
                }
                const assignedDayStr = getResponse(interview, assignedDayPath);
                if (_isBlank(assignedDayStr)) {
                    // No assigned day yet, cannot check
                    return {};
                }
                const assignedDay = moment(assignedDayStr);
                const assignedDayLimit = now.subtract(DAYS_BEFORE_REVISING_DATE, 'days');
                if (assignedDay.isAfter(assignedDayLimit)) {
                    // The assigned day is not too far in the past
                    return {};
                }

                // See if there are trips already declared
                const persons = odSurveyHelpers.getPersonsArray({ interview });
                for (let i = 0, count = persons.length; i < count; i++) {
                    const person = persons[i];
                    const journey = odSurveyHelpers.getJourneysArray({ person })[0];
                    if (journey !== undefined) {
                        if (!_isBlank((journey as any).personDidTrips)) {
                            // At least a person has trips, do not change the assigned day
                            return {};
                        }
                    }
                }

                // The assigned day is too far in the past, calculate a new one from yesterday
                const formattedAssignedDay = calculateAssignedDayFromPreviousDay(
                    moment().subtract(1, 'days').format('YYYY-MM-DD')
                );
                // Adding logging to monitor how often this happens and make sure it works correctly
                // FIXME Remove this logging once it is confirmed to work correctly
                console.log(
                    'serverFieldUpdate: Assigned day for interview ' +
                        interview.id +
                        ' was too far in the past (' +
                        assignedDayStr +
                        '), changing to ' +
                        formattedAssignedDay
                );
                // Change the assigned day, but keep the original
                return {
                    [assignedDayPath]: formattedAssignedDay
                };
            } catch (error) {
                console.error('error evaluating if the assigned day needs to be modified', error);
                return {};
            }
        }
    },
    {
        field: '_interviewFinished',
        callback: async (interview, value) => {
            try {
                if (value !== true) {
                    // Ignore all values but true
                    return {};
                }
                // Set the interview as completed if it is set for the first time
                const isInterviewCompleted = getResponse(interview, '_isCompleted', false);
                if (!isInterviewCompleted) {
                    return {
                        _isCompleted: true,
                        _completedAt: Math.ceil(Date.now() / 1000) // Set the completedAt timestamp to now
                    };
                }
                return {};
            } catch (error) {
                console.error('error attempting to set the interview as completed', error);
                return {};
            }
        }
    },
    {
        field: {
            regex: '^household\\.persons\\.[a-zA-Z0-9_-]+\\.journeys\\.[a-zA-Z0-9_-]+\\.trips\\.[a-zA-Z0-9_-]+\\.segments\\.[a-zA-Z0-9_-]+\\.modePre$'
        },
        runOnValidatedData: true,
        callback: async (interview, value, path, registerUpdateOperation) => {
            const resultPath = getPath(path, '../trRoutingResult');
            const defaultResponse = { [resultPath]: undefined };
            // If using a public transit mode, retrieve results from trRouting
            if (!['transit'].includes(value) || config.trRoutingScenarios === undefined) {
                return defaultResponse;
            }
            try {
                // Extract IDs from the path
                const pathParts = path.split('.');
                const personId = pathParts[2];
                const journeyId = pathParts[4];
                const tripId = pathParts[6];

                const person = odSurveyHelpers.getPerson({ interview, personId });
                const journey = person ? odSurveyHelpers.getJourneys({ person })[journeyId] : undefined;
                const visitedPlaces = journey ? odSurveyHelpers.getVisitedPlaces({ journey }) : null;
                const trip = journey ? odSurveyHelpers.getTrips({ journey })[tripId] || null : null;
                const householdTripsDate = getResponse(interview, assignedDayPath, null);
                if (visitedPlaces === null || person === null || trip === null || householdTripsDate === null) {
                    return defaultResponse;
                }

                // Find the scenario for the appropriate week day
                const weekDay = moment(householdTripsDate).day();
                const scenario =
                    weekDay === 0
                        ? config.trRoutingScenarios.DI
                        : weekDay === 6
                            ? config.trRoutingScenarios.SA
                            : config.trRoutingScenarios.SE;
                if (scenario === undefined) {
                    return defaultResponse;
                }

                // Get geography of places
                const origin = odSurveyHelpers.getOrigin({ trip, visitedPlaces });
                const destination = odSurveyHelpers.getDestination({ trip, visitedPlaces });
                const originGeography = origin
                    ? odSurveyHelpers.getVisitedPlaceGeography({
                        visitedPlace: origin,
                        person,
                        interview
                    })
                    : null;
                const destinationGeography = destination
                    ? odSurveyHelpers.getVisitedPlaceGeography({
                        visitedPlace: destination,
                        person,
                        interview
                    })
                    : null;
                const timeOfTrip = origin?.departureTime;

                if (originGeography === null || destinationGeography === null || typeof timeOfTrip !== 'number') {
                    return defaultResponse;
                }

                const executeTransitSummaryPromise = async () => {
                    try {
                        const summaryResponse = await getTransitSummary({
                            origin: originGeography,
                            destination: destinationGeography,
                            transitScenario: scenario,
                            departureSecondsSinceMidnight: timeOfTrip,
                            departureDateString: householdTripsDate,
                            minWaitingTime: 180,
                            maxAccessTravelTime: 20 * 60,
                            maxEgressTravelTime: 20 * 60,
                            maxTransferTravelTime: 20 * 60,
                            maxTravelTime: 180 * 60,
                            maxFirstWaitingTime: 20 * 60
                        } as any);
                        if (summaryResponse.status !== 'success') {
                            console.log('Error getting summary: ', JSON.stringify(summaryResponse));
                        }
                        return { [resultPath]: summaryResponse.status === 'success' ? summaryResponse : undefined };
                    } catch (error) {
                        console.error('Error getting transit summary:', error);
                        return { [resultPath]: undefined };
                    }
                };

                if (typeof registerUpdateOperation !== 'function') {
                    // If registerUpdateOperation is not provided, execute the promise directly, that would be in the validation interface, they can wait
                    return await executeTransitSummaryPromise();
                } else {
                    // Execute the operation in the backend so the result may be ready when needed, but without blocking the call
                    registerUpdateOperation({
                        opName: `transitSummary${originGeography.geometry.coordinates[0]}${originGeography.geometry.coordinates[1]}${destinationGeography.geometry.coordinates[0]}${destinationGeography.geometry.coordinates[1]}`,
                        opUniqueId: 1,
                        operation: async (_isCancelled: () => boolean) => {
                            return await executeTransitSummaryPromise();
                        }
                    });
                    return {};
                }
            } catch (error) {
                console.log('Error occurred while getting summary for transit mode:', error);
                return defaultResponse;
            }
        }
    }
];
