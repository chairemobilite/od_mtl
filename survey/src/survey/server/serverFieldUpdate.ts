import moment from 'moment-business-days';
import { v4 as uuidV4 } from 'uuid';
import { distance as turfDistance } from '@turf/turf';
import { isFeature, isPoint } from 'geojson-validation';
import { _isBlank, _booleish } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { validateAccessCode } from 'evolution-backend/lib/services/accessCode';
import { getPath, getResponse } from 'evolution-common/lib/utils/helpers';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import { getPreFilledResponseByPath } from 'evolution-backend/lib/services/interviews/serverFieldUpdate';
import { randomFromDistribution } from 'chaire-lib-common/lib/utils/RandomUtils';
import interviewsDbQueries from 'evolution-backend/lib/models/interviews.db.queries';
import participantsDbQueries from 'evolution-backend/lib/models/participants.db.queries';
import { accessCodeFormatter, eightDigitsAccessCodeFormatter } from 'evolution-common/lib/utils/formatters';
import { InterviewAttributes, Segment, Trip } from 'evolution-common/lib/services/questionnaire/types';
import { postalCodeValidation } from 'evolution-common/lib/services/widgets/validations/validations';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import { getTransitSummary } from 'evolution-backend/lib/services/routing';
import {
    getCommonTripFromReferencePerson,
    getPointZone,
    isCommonTripSampleMatch,
    isPartialSample
} from '../common/commonHelpers';
import { getZatForPoint } from './serverHelpers';

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

// List of fields to copy to the reverse segment and where to copy them
const segmentFieldReverseMapping = {
    subwayStationStart: 'subwayStationEnd',
    subwayStationEnd: 'subwayStationStart',
    trainStationStart: 'trainStationEnd',
    trainStationEnd: 'trainStationStart',
    remStationStart: 'remStationEnd',
    remStationEnd: 'remStationStart'
};
const copyReverseSegment = (originalSegment: Segment, currentSegmentPath: string): Record<string, unknown> => {
    // Copy the modes
    const updatedSegmentData: Record<string, unknown> = {
        [`${currentSegmentPath}.mode`]: originalSegment.mode,
        [`${currentSegmentPath}.modePre`]: originalSegment.modePre
    };
    // Copy the reverse stations for transit modes, will be null or undefined for non-transit
    Object.entries(segmentFieldReverseMapping).forEach(
        ([previousField, newField]) =>
            (updatedSegmentData[`${currentSegmentPath}.${newField}`] = originalSegment[previousField])
    );

    return updatedSegmentData;
};

const copyReverseSegmentArray = (
    originalSegments: Segment[],
    currentSegmentPath: string,
    currentSegments: Segment[]
): Record<string, unknown> => {
    const updatedSegmentData: Record<string, unknown> = {};
    // Get the path for the trips and create paths for each new segments
    const tripsPath = getPath(currentSegmentPath, '../');
    // Create a new paths for each segment additional segment and copy the data from reverse original segments
    const originalSegmentsCount = originalSegments.length;
    for (let segmentIndex = 0; segmentIndex < originalSegmentsCount; segmentIndex++) {
        const copySegment = originalSegments[originalSegmentsCount - segmentIndex - 1];
        // If segment already exists, copy the data to it
        if (currentSegments[segmentIndex]) {
            const segmentPath = `${tripsPath}.${currentSegments[segmentIndex]._uuid}`;
            updatedSegmentData[`${segmentPath}.mode`] = copySegment.mode;
            updatedSegmentData[`${segmentPath}.modePre`] = copySegment.modePre;
            updatedSegmentData[`${segmentPath}.hasNextMode`] = segmentIndex !== originalSegmentsCount - 1;
            continue;
        }
        // Else create a new one
        const newSegmentUuid = uuidV4();
        const newSegmentPath = `${tripsPath}.${newSegmentUuid}`;
        updatedSegmentData[`${newSegmentPath}`] = {
            _uuid: newSegmentUuid,
            _sequence: segmentIndex + 1,
            _is_new: true,
            mode: copySegment.mode,
            modePre: copySegment.modePre,
            hasNextMode: segmentIndex !== originalSegmentsCount - 1
        };
    }
    // FIXME We should also delete any extra segments, but currently, because of this bug https://github.com/chairemobilite/evolution/issues/1719 it would prove worse than extra visible segments
    return updatedSegmentData;
};

// Threshold distance for the trip geography to be considered the same location
const commonTripGeographyDistanceThresholdMeters = 50;

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
        // When the access code is confirmed by clicking the confirm button
        field: 'accessCodeConfirm',
        callback: async (interview: InterviewAttributes, value) => {
            try {
                const accessCode = getResponse(interview, 'accessCode');
                const accessCodeIsCorrect = getResponse(interview, 'accessCodeIsCorrect');

                const properlyFormattedAccessCode =
                    typeof accessCode === 'string' ? accessCodeFormatter(accessCode) : accessCode;
                // Only valid access codes should be processed
                if (
                    typeof properlyFormattedAccessCode !== 'string' ||
                    !validateAccessCode(properlyFormattedAccessCode)
                ) {
                    return {};
                }

                // To avoid multiple changes to the access code, we check if it has already been confirmed, if so, simply return.
                const accessCodeConfirmed = getResponse(interview, '_accessCodeConfirmed', false);
                if (accessCodeConfirmed) {
                    return {};
                }

                // Get prefilled responses for this access code
                const prefilledResponses = await getPrefilledForAccessCode(properlyFormattedAccessCode, interview);
                const prefilledOk = !_isBlank(prefilledResponses);

                if (properlyFormattedAccessCode !== accessCode) {
                    prefilledResponses['accessCode'] = properlyFormattedAccessCode;
                }
                // Set the access code as confirmed if it exists
                if (prefilledOk) {
                    prefilledResponses['_accessCodeConfirmed'] = true;

                    // Set the home RA and zat if the prefilled response contains a home geography
                    if (
                        prefilledResponses['home.geography'] &&
                        isFeature(prefilledResponses['home.geography']) &&
                        isPoint((prefilledResponses['home.geography'] as GeoJSON.Feature).geometry)
                    ) {
                        prefilledResponses['home.RA'] = getPointZone(
                            prefilledResponses['home.geography'] as GeoJSON.Feature<GeoJSON.Point>
                        );
                        prefilledResponses['home.zat'] = getZatForPoint(
                            prefilledResponses['home.geography'] as GeoJSON.Feature<GeoJSON.Point>
                        );
                    }
                } else {
                    // If the participant confirmed the access code is correct, set it as confirmed, otherwise, no
                    if (!(Array.isArray(accessCodeIsCorrect) && accessCodeIsCorrect.includes('accessCodeConfirmOk'))) {
                        prefilledResponses['_accessCodeConfirmed'] = false;
                        return prefilledResponses;
                    } else {
                        prefilledResponses['_accessCodeConfirmed'] = true;
                        // Continue to set the partial samples
                    }
                }

                return setPartialSamples(interview, prefilledResponses);
            } catch (error) {
                console.error('error getting server update fields for accessCode', error);
                return {};
            }
        }
    },
    {
        field: 'home.geography',
        callback: async (interview: InterviewAttributes, value) => {
            try {
                // Set the correct RA and zat for the home geography

                // If the point is not a feature, set to null
                if (_isBlank(value) || !isFeature(value) || !isPoint(value.geometry)) {
                    return { 'home.RA': null, 'home.zat': null };
                }
                return { 'home.RA': getPointZone(value), 'home.zat': getZatForPoint(value) };
            } catch (error) {
                console.error('error getting server update fields for home geography', error);
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
            regex: '^household\\.persons\\.[a-zA-Z0-9_-]+\\.journeys\\.[a-zA-Z0-9_-]+\\.visitedPlaces\\.[a-zA-Z0-9_-]+\\.geography$'
        },
        // Do not run on validated data as it may affect previous responses for barriers, etc
        runOnValidatedData: false,
        callback: async (interview, value, path, registerUpdateOperation) => {
            const pathToSet = getPath(path, '../zat');
            try {
                // Set the zat corresponding to the geography

                // If the point is not a feature, set to null
                if (_isBlank(value) || !isFeature(value) || !isPoint(value.geometry)) {
                    return { [pathToSet]: null };
                }
                return { [pathToSet]: getZatForPoint(value) };
            } catch (error) {
                console.error('Error getting zat for visited place geography:', error);
                return { [pathToSet]: null };
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
    },
    {
        field: {
            regex: '^household\\.persons\\.[a-zA-Z0-9_-]+\\.journeys\\.[a-zA-Z0-9_-]+\\.trips\\.[a-zA-Z0-9_-]+\\.segments\\.[a-zA-Z0-9_-]+\\.sameModeAsReverseTrip$'
        },
        runOnValidatedData: true,
        callback: async (interview, value, path, registerUpdateOperation) => {
            // If the value is not 'yes' or the partial sample is not sameMode, ignore
            const sameModeSample = getResponse(interview, 'ep.sameMode', false);
            if (value !== true || !sameModeSample) {
                return {};
            }
            try {
                // Remplissage complexe des segments à partir des données
                // précédentes, laisser le serveur le faire puisque côté client,
                // ce serait un champ à la fois et trop de logique à écrire à
                // trop d'endroits différents
                const pathParts = path.split('.');
                const personId = pathParts[2];
                const journeyId = pathParts[4];
                const tripId = pathParts[6];

                const person = odSurveyHelpers.getPerson({ interview, personId });
                const journey = person ? odSurveyHelpers.getJourneys({ person })[journeyId] : undefined;
                const trip = journey ? (odSurveyHelpers.getTrips({ journey })[tripId] ?? null) : null;
                const previousTrip = odSurveyHelpers.getPreviousTrip({ currentTrip: trip, journey });
                const previousTripSegments = odSurveyHelpers.getSegmentsArray({ trip: previousTrip });
                const currentTripSegments = odSurveyHelpers.getSegmentsArray({ trip });

                // Copy each of the previous trip segment's data into the new trip
                const currentSegmentPath = getPath(path, '../');
                if (previousTripSegments.length === 1) {
                    console.log('should copy reverse segment');
                    // Fill the current segment's mode with same data as previous segment and reverse entry/exit stations if necessary
                    return copyReverseSegment(previousTripSegments[0], currentSegmentPath);
                } else {
                    // Multi-mode: copy modes only in reverse order
                    return copyReverseSegmentArray(previousTripSegments, currentSegmentPath, currentTripSegments);
                }
            } catch (error) {
                console.error('Error occurred while filling the segment data for sameMode partial sample:', error);
                return {};
            }
        }
    },
    {
        field: '_activeTripId',
        callback: async (interview, value, path) => {
            try {
                if (
                    _isBlank(value) ||
                    (!isCommonTripSampleMatch(interview) &&
                        !isPartialSample(interview, ['freqBarriers', 'freqAttitudinalBarriers']))
                ) {
                    // Nothing to do if no actual trip ID or if it is not a sample that needs further calculations
                    return {};
                }

                if (isCommonTripSampleMatch(interview)) {
                    
                }
                // Fill segment data: If the partial sample is set the
                // commonTrip and this is a common trip (same
                // origin/destination/times as a trip said to be common with
                // this person)
                const currentPerson = odSurveyHelpers.getActivePerson({ interview });
                if (currentPerson === null) {
                    throw new Error('active trip ID server callback: current person not found in interview');
                }
                const currentJourney = odSurveyHelpers.getActiveJourney({ interview, person: currentPerson });
                if (currentJourney === null) {
                    throw new Error('active trip ID server callback: current journey not found in interview');
                }
                const currentTrip = odSurveyHelpers.getTrips({ journey: currentJourney })[value];
                if (currentTrip === undefined) {
                    throw new Error('active trip ID server callback: current trip not found in interview ');
                }

                // If the trip already has segments, do not fill them again and
                // make sure the prefilled flag is set to `false` if the
                // segments are not new (not confirmed yet)
                const segments = odSurveyHelpers.getSegmentsArray({ trip: currentTrip });
                if (segments.length > 0) {
                    return segments.some((segment) => segment._isNew === false)
                        ? {
                            [`household.persons.${currentPerson._uuid}.journeys.${currentJourney._uuid}.trips.${currentTrip._uuid}._prefilledFromCommonTrip`]:
                                  false
                        }
                        : {};
                }

                const commonTripsData = getCommonTripFromReferencePerson(interview, currentPerson);
                if (commonTripsData === null) {
                    return {};
                }

                // Get the current trip's origin and destination to compare with the reference person's trips
                const visitedPlaces = odSurveyHelpers.getVisitedPlaces({ journey: currentJourney });
                const tripOrigin = odSurveyHelpers.getOrigin({ trip: currentTrip, visitedPlaces });
                const tripDestination = odSurveyHelpers.getDestination({ trip: currentTrip, visitedPlaces });
                if (tripOrigin === null || tripDestination === null) {
                    return {};
                }

                // Find the trip with the same timings
                const referencePersonVisitedPlaces = odSurveyHelpers.getVisitedPlaces({
                    journey: commonTripsData.journey
                });
                // Keep track of the matching trip and its origin/destination to get the geographies later
                let matchingTripOnTimesOrigin: ReturnType<typeof odSurveyHelpers.getOrigin> = null;
                let matchingTripOnTimesDestination: ReturnType<typeof odSurveyHelpers.getDestination> = null;
                let matchingTripOnTimes: Trip | undefined = undefined;
                for (const commonTrip of commonTripsData.trips) {
                    const commonTripOrigin = odSurveyHelpers.getOrigin({
                        trip: commonTrip,
                        visitedPlaces: referencePersonVisitedPlaces
                    });
                    const commonTripDestination = odSurveyHelpers.getDestination({
                        trip: commonTrip,
                        visitedPlaces: referencePersonVisitedPlaces
                    });
                    if (commonTripOrigin === null || commonTripDestination === null) {
                        continue; // Ignore trips with no origin or destination, like loop activities
                    }
                    // Found the trip that matches the current trip's timings, keep it
                    // TODO Determine if we want to be more flexible with the timings or keep it strict
                    if (
                        commonTripOrigin.departureTime === tripOrigin.departureTime &&
                        commonTripDestination.arrivalTime === tripDestination.arrivalTime
                    ) {
                        matchingTripOnTimes = commonTrip;
                        matchingTripOnTimesOrigin = commonTripOrigin;
                        matchingTripOnTimesDestination = commonTripDestination;
                        break;
                    }
                }

                if (matchingTripOnTimes === undefined) {
                    return {};
                }

                // Make sure the trip's geographies are the same (within 50 meters)
                const matchingTripOriginGeography = odSurveyHelpers.getVisitedPlaceGeography({
                    visitedPlace: matchingTripOnTimesOrigin,
                    person: commonTripsData.person,
                    interview
                });
                const matchingTripDestinationGeography = odSurveyHelpers.getVisitedPlaceGeography({
                    visitedPlace: matchingTripOnTimesDestination,
                    person: commonTripsData.person,
                    interview
                });
                const tripOriginGeography = odSurveyHelpers.getVisitedPlaceGeography({
                    visitedPlace: tripOrigin,
                    person: currentPerson,
                    interview
                });
                const tripDestinationGeography = odSurveyHelpers.getVisitedPlaceGeography({
                    visitedPlace: tripDestination,
                    person: currentPerson,
                    interview
                });

                // No geography for some origins or destination, ignore the segments
                if (
                    matchingTripOriginGeography === null ||
                    matchingTripDestinationGeography === null ||
                    tripOriginGeography === null ||
                    tripDestinationGeography === null
                ) {
                    return {};
                }

                const originDistance = turfDistance(
                    matchingTripOriginGeography.geometry,
                    tripOriginGeography.geometry,
                    { units: 'meters' }
                );
                const destinationDistance = turfDistance(
                    matchingTripDestinationGeography.geometry,
                    tripDestinationGeography.geometry,
                    { units: 'meters' }
                );

                // Since 2 persons can share part of a trip, either origin or
                // destination geographies should be within a certain threshold
                // distance to be a common trip, but one end of the trip can be
                // different places.
                if (
                    originDistance > commonTripGeographyDistanceThresholdMeters &&
                    destinationDistance > commonTripGeographyDistanceThresholdMeters
                ) {
                    return {};
                }

                // If we reach this point, the trip is considered a common trip
                // with the reference person, so we can fill the segments from
                // the reference person's trip
                const referenceSegments = odSurveyHelpers.getSegmentsArray({ trip: matchingTripOnTimes });
                // Only for unimodal trips, so if there are multiple segments, do not fill them
                if (referenceSegments.length !== 1) {
                    return {};
                }

                // Copy segment, but special cases for carDriver/carPassenger and their specific fields (paidForParking, vehicleOccupancy, driver)
                const { _uuid, modePre, mode, paidForParking, vehicleOccupancy, driver, _isNew, ...segment } =
                    referenceSegments[0] as any;
                const newSegment = {
                    _uuid: uuidV4(),
                    _isNew: true,
                    ...segment
                };

                // If original mode is carPassenger and this person is the
                // driver, change to carDriver
                if (mode === 'carPassenger' && driver === currentPerson._uuid) {
                    newSegment.mode = 'carDriver';
                    newSegment.modePre = 'carDriver';
                } else if (mode === 'carDriver') {
                    // If original mode is carDriver, change to carPassenger and set
                    // driver as the reference person
                    newSegment.mode = 'carPassenger';
                    newSegment.modePre = 'carPassenger';
                    // Set the driver as the reference person
                    newSegment.driver = commonTripsData.person._uuid;
                } else {
                    // Otherwise, keep previous mode and modePre
                    newSegment.mode = mode;
                    newSegment.modePre = modePre;
                    if (mode === 'carPassenger') {
                        // Keep the current driver
                        newSegment.driver = driver;
                    }
                }

                const updatedSegments: Record<string, unknown> = {
                    [`household.persons.${currentPerson._uuid}.journeys.${currentJourney._uuid}.trips.${currentTrip._uuid}._prefilledFromCommonTrip`]:
                        true,
                    [`household.persons.${currentPerson._uuid}.journeys.${currentJourney._uuid}.trips.${currentTrip._uuid}.segments.${newSegment._uuid}`]:
                        newSegment
                };
                return updatedSegments;
            } catch (error) {
                console.error('error filling modes for active trip', error);
                return {};
            }
        }
    }
];
