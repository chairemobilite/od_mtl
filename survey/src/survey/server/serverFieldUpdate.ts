import moment from 'moment-business-days';
import { v4 as uuidV4 } from 'uuid';
import { isFeature, isPoint } from 'geojson-validation';
import { _isBlank, _booleish } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { validateAccessCode } from 'evolution-backend/lib/services/accessCode';
import { getPath, getResponse } from 'evolution-common/lib/utils/helpers';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import { getPreFilledResponseByPath } from 'evolution-backend/lib/services/interviews/serverFieldUpdate';
import { randomFromDistribution } from 'chaire-lib-common/lib/utils/RandomUtils';
import interviewsDbQueries from 'evolution-backend/lib/models/interviews.db.queries';
import { accessCodeFormatter } from 'evolution-common/lib/utils/formatters';
import { InterviewAttributes, Segment, Trip } from 'evolution-common/lib/services/questionnaire/types';
import { postalCodeValidation } from 'evolution-common/lib/services/widgets/validations/validations';
import config from 'evolution-common/lib/config/project.config';
import { getTransitSummary } from 'evolution-backend/lib/services/routing';
import { isCommonTripSampleMatch, isPartialSample } from '../common/commonHelpers';
import {
    getUpdatedFieldsForBarriers,
    getUpdatedFieldsForCommonTrip,
    updatePathsWithZonesIntersectingPoint
} from './serverHelpers';

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
const assignedWeekDayPath = '_assignedWeekDayIso';
const ASSIGNED_DAY_UPDATE_FREQ_MINUTES = 15;
let lastCheckMoment = undefined;
const assignedDays = [0, 0, 0, 0, 0, 0, 0];
const assignedDayTarget = [0.1923, 0.1923, 0.1923, 0.1923, 0.1923, 0.0192, 0.0192];
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
            // Ignore holidays for this survey, probability of 0
            assignedDayTarget[dow] === 0 || prevDay.isHoliday()
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
const epExclusiveProbabilitiesWeekday: [number, string][] = [
    [0.012, 'householdType'], // 1.2%
    [0.062, 'omission'], // 5%
    [0.442, 'paidParking'], // 38%
    [0.492, 'respect'], // 5%
    [0.592, 'freqAttitudinal'], // 10%
    [0.692, 'freqBarriers'], // 10%
    [0.792, 'freqAttitudinalBarriers'], // 10%
    [1, 'mtmd'] // 20.8 %
];
// Seulement householdType la fds
const epExclusiveProbabilitiesWeekend: [number, string][] = [[1, 'householdType']];
const possibleExclusiveSamplesWeekday = epExclusiveProbabilitiesWeekday.map((item) => item[1]);
const possibleExclusiveSamplesWeekend = epExclusiveProbabilitiesWeekend.map((item) => item[1]);
const getExclusiveSamplesForDow = (dow: number) =>
    dow < 6
        ? {
            possibleExclusiveSamples: possibleExclusiveSamplesWeekday,
            exclusiveSampleProbabilities: epExclusiveProbabilitiesWeekday
        }
        : {
            possibleExclusiveSamples: possibleExclusiveSamplesWeekend,
            exclusiveSampleProbabilities: epExclusiveProbabilitiesWeekend
        };
// These samples should not apply to the 'mtmd' samples
const commonTripProbability = (exclusiveSample: string) => (exclusiveSample !== 'mtmd' ? 0.5 : 0);
const sameModeProbability = (exclusiveSample: string) => (exclusiveSample !== 'mtmd' ? 0.5 : 0);
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
    let currentExclusiveSample = getResponse(interview, 'ep.exclusive', null);
    // 'mtmd' sample should not be available on weekends and independent samples should not be assigned for 'mtmd'
    const assignedWeekday = getResponse(interview, assignedWeekDayPath, 0) as number;
    const { possibleExclusiveSamples, exclusiveSampleProbabilities } = getExclusiveSamplesForDow(assignedWeekday);
    if (typeof currentExclusiveSample !== 'string' || !possibleExclusiveSamples.includes(currentExclusiveSample)) {
        currentExclusiveSample = currentAdditionalData['home.preData']?.['ep.exclusive'];
        // Here, the exclusive sample comes from the preData, so we use the
        // sample requested, even if not available on the day of week, as this
        // is likely for tests and needs predictability, so we compare with
        // weekday samples, that are exhaustive.
        if (
            typeof currentExclusiveSample !== 'string' ||
            !possibleExclusiveSamplesWeekday.includes(currentExclusiveSample)
        ) {
            const randomValue = Math.random();
            for (let i = 0; i < exclusiveSampleProbabilities.length; i++) {
                if (randomValue < exclusiveSampleProbabilities[i][0]) {
                    currentExclusiveSample = exclusiveSampleProbabilities[i][1];
                    break;
                }
            }
        }
        currentAdditionalData['ep.exclusive'] = currentExclusiveSample;
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
            currentAdditionalData['ep.commonTrip'] = _booleish(
                Math.random() < commonTripProbability(currentExclusiveSample as string)
            );
        }
    }

    const currentSameMode = getResponse(interview, 'ep.sameMode', null);
    if (currentSameMode === null) {
        const prefilledSameMode = _booleish(currentAdditionalData['home.preData']?.['ep.sameMode']);
        if (prefilledSameMode !== null) {
            currentAdditionalData['ep.sameMode'] = prefilledSameMode;
        } else {
            currentAdditionalData['ep.sameMode'] = _booleish(
                Math.random() < sameModeProbability(currentExclusiveSample as string)
            );
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

const getDayOfWeek = (formattedDate: unknown): number | null => {
    if (typeof formattedDate !== 'string') {
        return null;
    }
    // Get the assigned day of week
    const date = new Date(`${formattedDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        // Invalid date, return null
        return null;
    }
    // javascript returns 0 for sunday. To match the export and postgres iso 8601 standard, where monday is 1 and sunday 7, we remap 0 to 7
    const dayOfWeekNumber = date.getDay();
    return dayOfWeekNumber === 0 ? 7 : dayOfWeekNumber;
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
                    [assignedWeekDayPath]: getDayOfWeek(formattedAssignedDay)
                };
            } catch (error) {
                console.error('Error getting the assigned day for survey', error);
                // Error, fallback to previous business day
                return { [assignedDayPath]: value, [assignedWeekDayPath]: getDayOfWeek(value) };
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
                        const zoneResponses = updatePathsWithZonesIntersectingPoint(
                            prefilledResponses['home.geography'] as GeoJSON.Feature<GeoJSON.Point>,
                            'home.geography'
                        );
                        Object.assign(prefilledResponses, zoneResponses);
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
                // Set the various zones intersecting the home geography

                // If the point is not a feature, return an empty object
                if (_isBlank(value) || !isFeature(value) || !isPoint(value.geometry)) {
                    return {};
                }
                return updatePathsWithZonesIntersectingPoint(value, 'home.geography');
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
            try {
                // Set the intersecting zones for this geography

                // If the point is not a feature, set to null
                if (_isBlank(value) || !isFeature(value) || !isPoint(value.geometry)) {
                    return {};
                }
                return updatePathsWithZonesIntersectingPoint(value, path);
            } catch (error) {
                console.error('Error getting zat for visited place geography:', error);
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
            if (!['bus', 'transitHeavy'].includes(value) || (config as any).trRoutingScenarios === undefined) {
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
                        ? (config as any).trRoutingScenarios.DI
                        : weekDay === 6
                            ? (config as any).trRoutingScenarios.SA
                            : (config as any).trRoutingScenarios.SE;
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
                const isCommonTripSampleAndMatch = isCommonTripSampleMatch(interview);
                const isBarriersSample = isPartialSample(interview, ['freqBarriers', 'freqAttitudinalBarriers']);
                if (_isBlank(value) || (!isCommonTripSampleAndMatch && !isBarriersSample)) {
                    // Nothing to do if no actual trip ID or if it is not a sample that needs further calculations
                    return {};
                }

                // Assign the values from the corresponding helper function to every sample that applies.
                const updatedValuesByPath = {};
                if (isCommonTripSampleAndMatch) {
                    Object.assign(updatedValuesByPath, getUpdatedFieldsForCommonTrip(interview, value));
                }
                if (isBarriersSample) {
                    Object.assign(updatedValuesByPath, getUpdatedFieldsForBarriers(interview, value));
                }
                return updatedValuesByPath;
            } catch (error) {
                console.error('error filling modes for active trip', error);
                return {};
            }
        }
    }
];
