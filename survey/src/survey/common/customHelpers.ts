import _isEqual from 'lodash/isEqual';
import _upperFirst from 'lodash/upperFirst';
import { _booleish, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import type {
    ChoiceType,
    InterviewAttributes,
    Journey,
    Person,
    Trip,
    VisitedPlace
} from 'evolution-common/lib/services/questionnaire/types';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import i18n from 'evolution-frontend/lib/config/i18n.config';
import { getFormattedDate } from 'evolution-frontend/lib/services/display/frontendHelper';
import config from 'evolution-common/lib/config/project.config';
import { TFunction } from 'i18next';
import { secondsSinceMidnightToTimeStr } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { AdditionalSectionLabelOptionFct } from 'evolution-common/lib/services/questionnaire/types';
import * as segmentHelpers from 'evolution-common/lib/services/questionnaire/sections/segments/helpers';
import {
    getCommonTripFromReferencePerson,
    getCommonTripReferencePerson,
    isCommonTripSampleMatch
} from './commonHelpers';

const isSchoolEnrolledTrueValues = [
    'kindergarten',
    'childcare',
    'primarySchool',
    'secondarySchool',
    'schoolAtHome',
    'other'
];

// TODO: Migrate all these useful helpers (or not) to Evolution

// Make sure the household size matches the number of persons in the household,
// in case the participant changed one value but did not reach the household
// section again.
// FIXME This won't be necessary when https://github.com/chairemobilite/evolution/issues/1132 is fixed
export const updateHouseholdSizeFromPersonCount = (
    interview: InterviewAttributes
): Record<string, unknown> | undefined => {
    const householdSize = getResponse(interview, 'household.size', undefined);
    const persons = odSurveyHelpers.getPersonsArray({ interview });
    if (!_isBlank(householdSize) && persons.length > 0 && householdSize !== persons.length) {
        return { 'response.household.size': persons.length };
    }
    return undefined;
};

export const getFormattedTripDateFromJourney = (journey: Journey): string | undefined => {
    const assignedDay = journey.startDate;
    const journeyDate = !_isBlank(assignedDay)
        ? getFormattedDate(assignedDay!, { withRelative: true, locale: i18n.language })
        : undefined;
    return journeyDate;
};

export const isPartialSample = (interview: InterviewAttributes, partialSample: string | string[]) => {
    const partialSamples = typeof partialSample === 'string' ? [partialSample] : partialSample;
    const epExclusive = getResponse(interview, 'ep.exclusive', null);
    return typeof epExclusive === 'string' ? partialSamples.includes(epExclusive) : false;
};

export const isSameModeSample = (interview: InterviewAttributes) =>
    getResponse(interview, 'ep.sameMode', false) as boolean;

export const getPersonsOfDrivingAge = (interview: InterviewAttributes) =>
    odSurveyHelpers
        .getInterviewablePersonsArray({ interview })
        .filter((person) => person.age >= config.drivingLicenseAge);

export const hasMoreThanOnePersonOfDrivingAge = (interview: InterviewAttributes) =>
    getPersonsOfDrivingAge(interview).length > 1;

const validateTripSingleSegmentHasMode =
    (modes: string[]) =>
        ({ trip }: { trip: Trip }) => {
            const segments = odSurveyHelpers.getSegmentsArray({ trip });
            if (segments.length !== 1) {
            // More than one segment for this trip, ignore
                return false;
            }
            // Return `true` if either modePre or mode is in the requested modes. Some
            // pre mode (like carDriver) have many sub-modes and we don't want to have
            // to list them all.
            return modes.includes(segments[0].mode) || modes.includes(segments[0].modePre);
        };

const validateTripForBarrierQuestions = validateTripSingleSegmentHasMode(['carDriver', 'carPassenger']);

const validateTripForBarrierDisabilityQuestions = validateTripSingleSegmentHasMode(['paratransit']);

// Make sure the trip exists, is for the same person and is of the right mode
const validatePersonTripPath = ({
    frequencyPersonId,
    barriersTripPath,
    interview,
    validationFct
}: {
    frequencyPersonId: string;
    barriersTripPath: string;
    interview: InterviewAttributes;
    validationFct: (args: { trip: Trip }) => boolean;
}): boolean => {
    const tripContext = odSurveyHelpers.getTripContextFromPath({ interview, path: barriersTripPath });
    if (tripContext === null) {
        // Path does not exist anymore
        return false;
    }
    const { person, trip } = tripContext;
    if (person._uuid !== frequencyPersonId) {
        // The trip saved is not for the right person anymore
        return false;
    }
    return validationFct({ trip });
};

const getBarriersTripPathForType = (
    barrierTripPath: string,
    interview: InterviewAttributes,
    validationFct: (args: { trip: Trip }) => boolean
) => {
    const frequencyPersonId = getResponse(interview, '_freqPersonId', null) as string | null;
    const barriersTripPath = getResponse(interview, barrierTripPath, null) as string | null;
    if (
        frequencyPersonId !== null &&
        barriersTripPath !== null &&
        validatePersonTripPath({
            frequencyPersonId,
            barriersTripPath,
            interview,
            validationFct
        })
    ) {
        // The trip is already set, return it
        return barriersTripPath;
    }
    // See if any trip has the right characteristics
    const person = odSurveyHelpers.getPersons({ interview })[frequencyPersonId];
    if (person === undefined) {
        // Person does not exist, return null
        return null;
    }
    // Look at each trip for each journey to see if there is one that respects the criterias
    const journeys = odSurveyHelpers.getJourneysArray({ person });
    for (let i = 0; i < journeys.length; i++) {
        const journey = journeys[i];
        const trips = odSurveyHelpers.getTripsArray({ journey });
        for (let j = 0; j < trips.length; j++) {
            const trip = trips[j];
            if (validationFct({ trip })) {
                return `household.persons.${frequencyPersonId}.journeys.${journey._uuid}.trips.${trip._uuid}`;
            }
        }
    }
    // No matching trip found
    return null;
};

export const getBarriersTripPath = (interview: InterviewAttributes) =>
    getBarriersTripPathForType('_barriersTripPath', interview, validateTripForBarrierQuestions);

export const getBarriersDisabilityTripPath = (interview: InterviewAttributes) =>
    getBarriersTripPathForType('_barriersDisabilityTripPath', interview, validateTripForBarrierDisabilityQuestions);

export const getChildrenAged1To4 = (interview) =>
    odSurveyHelpers
        .getPersonsArray({ interview })
        .filter((person) => typeof person.age === 'number' && person.age >= 1 && person.age <= 4);

// Function to decide whether to show the toddler daycare questions
const toddlerDaycarePartialSamples = ['paidParking', 'householdType', 'respect'];
export const shouldShowToddlerDayCareQuestions = (interview: InterviewAttributes): boolean => {
    // Do not show if partial sample is not a valid one
    if (!isPartialSample(interview, toddlerDaycarePartialSamples)) {
        return false;
    }

    // Make sure the household has children
    const children = getChildrenAged1To4(interview);
    if (children.length === 0) {
        // No children
        return false;
    }

    // For all interviewable, see if there are trips for activity 'dropSomeone' or 'fetchSomeone'
    const compatibleTrips = odSurveyHelpers
        .getInterviewablePersonsArray({ interview })
        .flatMap((person) =>
            odSurveyHelpers
                .getJourneysArray({ person })
                .flatMap((journey) =>
                    odSurveyHelpers
                        .getVisitedPlacesArray({ journey })
                        .filter((vp) => ['dropSomeone', 'fetchSomeone'].includes(vp.activity))
                )
        );
    // Make visible if there are no trips to drop/fetch someone
    return compatibleTrips.length === 0;
};

export const personsArrayToChoices = (personsArray: Person[]): ChoiceType[] =>
    personsArray.map((person) => ({
        value: person._uuid,
        label: (t) => odSurveyHelpers.getPersonIdentificationString({ person, t })
    }));

// Get the latest time from this visited place. It is either the departure time, the arrival time or the previous place's departure time
const getVisitedPlaceLatestTime = ({
    interview,
    person,
    journey,
    visitedPlace
}: {
    interview: InterviewAttributes;
    person: Person;
    journey: Journey;
    visitedPlace: VisitedPlace;
}) => {
    const latestTime =
        typeof visitedPlace.departureTime === 'number'
            ? visitedPlace.departureTime
            : typeof visitedPlace.arrivalTime === 'number'
                ? visitedPlace.arrivalTime
                : undefined;
    if (latestTime !== undefined) {
        return latestTime;
    }
    const previousPlace = odSurveyHelpers.getPreviousVisitedPlace({ journey, visitedPlaceId: visitedPlace._uuid });
    if (
        previousPlace !== null &&
        (typeof previousPlace.departureTime === 'number' || typeof previousPlace.arrivalTime === 'number')
    ) {
        return typeof previousPlace.departureTime === 'number'
            ? previousPlace.departureTime
            : previousPlace.arrivalTime;
    }
    // Fall back to the questionnaire configuration's earliest time
    // FIXME La configuration du questionnaire n,est pas encore disponible globalement depuis Evolution, donc nous ne pouvons accéder à cette information. C'est hard-codé pour l'instant.
    return 4 * 60 * 60;
};

const defaultReminder = { reminderText: '' };
export const getCommonTripLabelOptions = ({
    t,
    interview,
    currentPerson,
    currentJourney,
    currentVisitedPlace
}: {
    t: TFunction;
    interview: InterviewAttributes;
    currentPerson: Person;
    currentJourney: Journey;
    currentVisitedPlace: VisitedPlace;
}) => {
    if (!isCommonTripSampleMatch(interview)) {
        return defaultReminder;
    }
    const commonTripsData = getCommonTripFromReferencePerson(interview, currentPerson);
    if (commonTripsData === null) {
        return defaultReminder;
    }
    const {
        person: commonTripReferencePerson,
        journey: commonTripReferenceJourney,
        trips: commonTrips
    } = commonTripsData;

    // Get the time bound for this person's current place (ie the last available time)
    const visitedPlaceLatestTime = getVisitedPlaceLatestTime({
        interview,
        person: currentPerson,
        journey: currentJourney,
        visitedPlace: currentVisitedPlace
    });

    // Find the earliest trip done after that timestamp
    const commonTripReferenceVisitedPlaces = odSurveyHelpers.getVisitedPlaces({ journey: commonTripReferenceJourney });
    const applicableCommonTrip = commonTrips.find((trip) => {
        const tripOrigin = odSurveyHelpers.getOrigin({ trip, visitedPlaces: commonTripReferenceVisitedPlaces });
        return tripOrigin.departureTime >= visitedPlaceLatestTime;
    });

    if (applicableCommonTrip === undefined) {
        return defaultReminder;
    }

    // Finally, return the string that corresponds to the reminder for the common trip.
    const origin = odSurveyHelpers.getOrigin({
        trip: applicableCommonTrip,
        visitedPlaces: commonTripReferenceVisitedPlaces
    });
    const destination = odSurveyHelpers.getDestination({
        trip: applicableCommonTrip,
        visitedPlaces: commonTripReferenceVisitedPlaces
    });
    return {
        reminderText: t('visitedPlaces:reminderText', {
            otherNickname: odSurveyHelpers.getPersonIdentificationString({ person: commonTripReferencePerson, t }),
            time: secondsSinceMidnightToTimeStr(origin.departureTime),
            origin: odSurveyHelpers.getVisitedPlaceDescription({
                visitedPlace: origin,
                person: commonTripReferencePerson,
                interview,
                t,
                options: { withTimes: false, withActivity: false, withPersonIdentification: false, allowHtml: false }
            }),
            destination: odSurveyHelpers.getVisitedPlaceDescription({
                visitedPlace: destination,
                person: commonTripReferencePerson,
                interview,
                t,
                options: { withTimes: false, withActivity: false, withPersonIdentification: false, allowHtml: false }
            })
        })
    };
};

export const getCommonTripReminderOptionsForVisitedPlaces: AdditionalSectionLabelOptionFct = ({
    interview,
    t,
    path
}) => {
    const visitedPlaceContext = odSurveyHelpers.getVisitedPlaceContextFromPath({ interview, path });
    if (visitedPlaceContext === null) {
        throw new Error('Common trip reminder options: visited place context not found for path ' + path);
    }
    const { person, journey, visitedPlace } = visitedPlaceContext;
    return getCommonTripLabelOptions({
        t,
        interview,
        currentJourney: journey,
        currentPerson: person,
        currentVisitedPlace: visitedPlace
    });
};

/**
 * Return whether these 2 trips are part of a simple chain with a single mode,
 * ie the origin of the previous trip is the same as the destination of the trip
 * and there is only one segment in the previous trip that is one of the simple
 * modes.
 *
 * @param {Object} options - The options object.
 * @param {Trip} options.trip The potential return trip
 * @param {Trip} options.previousTrip The previous trip that can be part of the
 * chain
 * @param {Object} options.journey The journey object that these trips are part
 * of
 * @param {Object} options.interview The interview object
 * @param {Object} options.person The person these trips belong to
 * @returns Whether the `trip` is the return trip of a simple chain with simple
 * modes
 */
export const isSimpleChainAnyModeOrComplexChainSimpleModeReturnTrip = ({
    trip,
    previousTrip,
    journey,
    interview,
    person
}: {
    trip: Trip;
    previousTrip: Trip;
    journey: Journey;
    interview: InterviewAttributes;
    person: Person;
}): boolean => {
    const visitedPlaces = odSurveyHelpers.getVisitedPlaces({ journey });
    const origin = odSurveyHelpers.getOrigin({ trip, visitedPlaces });
    const destination = odSurveyHelpers.getDestination({ trip, visitedPlaces });
    const previousOrigin = odSurveyHelpers.getOrigin({ trip: previousTrip, visitedPlaces });

    // If origin or destination is not found, we cannot determine if it is a simple chain
    if (!origin || !destination || !previousOrigin) {
        return false;
    }

    // ignore loop/moving activities:
    if (
        odSurveyHelpers.isLoopActivity({ visitedPlace: origin }) ||
        odSurveyHelpers.isLoopActivity({ visitedPlace: destination })
    ) {
        return false;
    }

    const previousTripOriginGeography = odSurveyHelpers.getVisitedPlaceGeography({
        visitedPlace: previousOrigin,
        interview,
        person
    });
    const tripDestinationGeography = odSurveyHelpers.getVisitedPlaceGeography({
        visitedPlace: destination,
        interview,
        person
    });
    // Condition pour une boucle simple, le mode ne doit juste pas être 'other'
    if (
        previousTripOriginGeography &&
        tripDestinationGeography &&
        tripDestinationGeography.geometry &&
        previousTripOriginGeography.geometry &&
        _isEqual(previousTripOriginGeography.geometry.coordinates, tripDestinationGeography.geometry.coordinates)
    ) {
        const previousTripSegmentsAsArray = odSurveyHelpers.getSegmentsArray({ trip: previousTrip });
        return !previousTripSegmentsAsArray.some((prevSegment) => prevSegment.mode === 'other');
    }

    // échantillon sameMode condition 2: boucle complexe, mode simple:

    const trips = odSurveyHelpers.getTripsArray({ journey });
    // Find candidate trips for the current complex chain: all previous trips until there is a loop activity;
    const previousTrips = trips.filter((otherTrip) => otherTrip._sequence < trip._sequence);
    const loopActivityLastIndex = previousTrips.findLastIndex((otherTrip) => {
        const otherTripOrigin = odSurveyHelpers.getOrigin({ trip: otherTrip, visitedPlaces });
        const otherTripDestination = odSurveyHelpers.getDestination({ trip: otherTrip, visitedPlaces });

        // If origin or destination is not found, this trip cannot be part of the chain
        if (!otherTripOrigin || !otherTripDestination) {
            return true;
        }

        // loop/moving activities cannot be part of the chain
        if (
            odSurveyHelpers.isLoopActivity({ visitedPlace: otherTripOrigin }) ||
            odSurveyHelpers.isLoopActivity({ visitedPlace: otherTripDestination })
        ) {
            return true;
        }
        return false;
    });
    const previousTripsNotLoops =
        loopActivityLastIndex !== -1 ? previousTrips.slice(loopActivityLastIndex + 1) : previousTrips;
    // Get possible next trips
    const nextTrips = trips.filter((otherTrip) => otherTrip._sequence >= trip._sequence);
    const loopActivityNextIndex = nextTrips.findIndex((otherTrip) => {
        const otherTripOrigin = odSurveyHelpers.getOrigin({ trip: otherTrip, visitedPlaces });
        const otherTripDestination = odSurveyHelpers.getDestination({ trip: otherTrip, visitedPlaces });

        // If origin or destination is not found, this trip cannot be part of the chain
        if (!otherTripOrigin || !otherTripDestination) {
            return true;
        }

        // loop/moving activities cannot be part of the chain
        if (
            odSurveyHelpers.isLoopActivity({ visitedPlace: otherTripOrigin }) ||
            odSurveyHelpers.isLoopActivity({ visitedPlace: otherTripDestination })
        ) {
            return true;
        }
        return false;
    });
    const nextTripsNotLoops = loopActivityNextIndex !== -1 ? nextTrips.slice(0, loopActivityNextIndex) : nextTrips;

    // Find the smallest possible complex chain, ie starting at the last index
    // from the previous trips where the origin matches one of the next trip's
    // destination
    const complexChainStartTripIndex = previousTripsNotLoops.findLastIndex((otherPreviousTrip) => {
        const otherTripOrigin = odSurveyHelpers.getOrigin({ trip: otherPreviousTrip, visitedPlaces });
        const previousTripOriginGeography = odSurveyHelpers.getVisitedPlaceGeography({
            visitedPlace: otherTripOrigin,
            interview,
            person
        });
        if (!previousTripOriginGeography || !previousTripOriginGeography.geometry) {
            return false;
        }
        const matchingNextTripDestination = nextTripsNotLoops.find((otherNextTrip) => {
            const nextTripDestination = odSurveyHelpers.getDestination({ trip: otherNextTrip, visitedPlaces });
            const tripDestinationGeography = odSurveyHelpers.getVisitedPlaceGeography({
                visitedPlace: nextTripDestination,
                interview,
                person
            });
            // Trip avec la même géographie
            if (
                tripDestinationGeography &&
                tripDestinationGeography.geometry &&
                _isEqual(
                    previousTripOriginGeography.geometry.coordinates,
                    tripDestinationGeography.geometry.coordinates
                )
            ) {
                return true;
            }
            return false;
        });
        return matchingNextTripDestination !== undefined;
    });
    // Condition si on est dans une chaîne complexe, valider que tous les trips ont un unique mode simple
    if (complexChainStartTripIndex !== -1) {
        const complexChainPreviousTrips = previousTripsNotLoops.slice(complexChainStartTripIndex);
        // Make sure that none the the trips from the chain have more than one simple mode
        return !complexChainPreviousTrips.some((prevTrip) => {
            const previousTripSegmentsAsArray = odSurveyHelpers.getSegmentsArray({ trip: prevTrip });
            if (
                previousTripSegmentsAsArray.length === 1 &&
                previousTripSegmentsAsArray[0].mode &&
                ['carPassenger', 'carDriver', 'walk', 'bicycle'].includes(previousTripSegmentsAsArray[0].mode)
            ) {
                // one segment with simple mode, this is correct
                return false;
            }
            return true;
        });
    }
    return false;
};

const originalShouldShowSameAsReverseTripQuestion = segmentHelpers.shouldShowSameAsReverseTripQuestion;

/**
 * Condition pour montrer la question de même mode dans le cas de l'échantillon
 * partiel 'sameMode': n'importe quelle série de modes pour une boucle simple,
 * modes simples pour une boucle complexe.
 * @returns
 */
export const shouldShowSameAsReverseTripQuestionForSameModeEp = ({
    interview,
    path
}: {
    interview: InterviewAttributes;
    path: string;
}): boolean => {
    const segmentContext = odSurveyHelpers.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('shouldShowSameAsReverseTripQuestion: segment context not found for path ' + path);
    }
    const { person, journey, trip, segment } = segmentContext;
    // Do not display if segment is not new or if not the first
    if (segment._isNew === false || segment._sequence !== 1) {
        return false;
    }
    // If the trip already has more than one segment, the conditional should
    // follow the current flow if the path is `sameModeAsReverseTrip`, otherwise
    // return false (for other widgets depending on this answer, they should be
    // shown)
    const segmentsArray = odSurveyHelpers.getSegmentsArray({ trip });
    if (segmentsArray.length > 1 && !path.endsWith('sameModeAsReverseTrip')) {
        return false;
    }
    // Display this question if the previous and current trips form either a
    // simple chain with any mode or a complex chain with a simple mode
    const previousTrip = odSurveyHelpers.getPreviousTrip({ currentTrip: trip, journey });
    return (
        previousTrip !== null &&
        isSimpleChainAnyModeOrComplexChainSimpleModeReturnTrip({ interview, journey, person, trip, previousTrip })
    );
};

// FIXME Override the shouldShowSameAsReverseTripQuestion from segment helpers.
// Plusieurs widgets utilisent cette fonction pour déterminer leur affichage
// (les modes, et hasNextMode). Pour que tous puissent utiliser la nouvelle
// logique pour l'échantillon 'sameMode', la fonction doit être overridée
// globalement. Ce n'est pas idéal, mais pour du A/B testing en 2026, ça va.
// Par contre, attention pour les audits!
(segmentHelpers as any).shouldShowSameAsReverseTripQuestion = ({
    interview,
    path
}: {
    interview: InterviewAttributes;
    path: string;
}): boolean => {
    if (!isSameModeSample(interview)) {
        return originalShouldShowSameAsReverseTripQuestion({ interview, path });
    }
    return shouldShowSameAsReverseTripQuestionForSameModeEp({ interview, path });
};

export const getPreviousModeSameModePartialSample: AdditionalSectionLabelOptionFct = ({ interview, t, path }) => {
    // Only for same mode sample
    if (!isSameModeSample(interview)) {
        return {};
    }
    const tripContext = odSurveyHelpers.getTripContextFromPath({ interview, path });
    if (!tripContext) {
        throw new Error('shouldShowSameAsReverseTripQuestion: segment context not found for path ' + path);
    }

    const { journey, trip } = tripContext;

    const previousTrip = odSurveyHelpers.getPreviousTrip({ currentTrip: trip, journey });
    const previousSegments = odSurveyHelpers.getSegmentsArray({ trip: previousTrip });
    // Return for previousMode the comma-separated list of reverse segment modes
    return {
        previousMode: previousSegments
            .reverse()
            .map((segment) => t(`segments:mode.short.${_upperFirst(segment.mode)}`))
            .join(', ')
    };
};

const defaultPrefilledSegmentNote = { prefilledSegmentNote: '' };
export const addPrefilledSegmentNote: AdditionalSectionLabelOptionFct = ({ interview, t, path }) => {
    // Uncomment the code here to get the trip context faster when https://github.com/chairemobilite/evolution/issues/1715 is fixed
    // const tripContext = odSurveyHelpers.getTripContextFromPath({ interview, path });
    // if (!tripContext) {
    //     throw new Error('addPrefilledSegmentNode: segment context not found for path ' + path);
    // }
    // const { trip } = tripContext;

    const currentPerson = odSurveyHelpers.getActivePerson({ interview });
    if (currentPerson === null) {
        throw new Error('addPrefilledSegmentNote: current person not found in interview');
    }
    const currentJourney = odSurveyHelpers.getActiveJourney({ interview, person: currentPerson });
    if (currentJourney === null) {
        throw new Error('addPrefilledSegmentNote: current journey not found in interview');
    }
    const trip = odSurveyHelpers.getActiveTrip({ interview, journey: currentJourney });
    if (trip === undefined) {
        throw new Error('addPrefilledSegmentNote: current trip not found in interview ');
    }

    // If the trip is prefilled from a common trip, return a note to inform the
    // user that the segment is prefilled
    if ((trip as any)._prefilledFromCommonTrip === true) {
        const referencePerson = getCommonTripReferencePerson(interview);
        if (referencePerson !== null) {
            return {
                prefilledSegmentNote: t('segments:prefilledSegmentNote', {
                    referenceNickname: odSurveyHelpers.getPersonIdentificationString({ person: referencePerson, t })
                })
            };
        }
    }
    return defaultPrefilledSegmentNote;
};
