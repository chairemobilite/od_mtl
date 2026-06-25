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

/**
 * Validate if the interview is the commonTrip ep AND if the household matches some criteria
 * @param interview
 * @returns
 */
export const isCommonTripSampleMatch = (interview: InterviewAttributes) => {
    const isCommonTripEp = getResponse(interview, 'ep.commonTrip', false) as boolean;
    if (!isCommonTripEp) {
        return false;
    }
    // The household should have more than one person and have persons aged between 5 and 17 or aged 65+
    const persons = odSurveyHelpers.getPersonsArray({ interview });
    if (persons.length === 1) {
        return false;
    }
    const eligiblePerson = persons.filter(
        (person) => (person.age >= config.interviewableAge && person.age < config.adultAge) || person.age >= 65
    );
    return eligiblePerson.length > 0;
};

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
    if (previousPlace !== null && typeof previousPlace.departureTime === 'number') {
        return previousPlace.departureTime;
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
    // See if this person may have had a common trip with someone (only if it is not the first one)
    const commonTripReferencePersonId = getResponse(interview, '_commonTripRefPersonId', null) as string | null;
    if (commonTripReferencePersonId === currentPerson._uuid || commonTripReferencePersonId === null) {
        return defaultReminder;
    }

    // Does the first person have common trip with this one?
    const commonTripReferencePerson = odSurveyHelpers.getPersons({ interview })[commonTripReferencePersonId];
    if (commonTripReferencePerson === undefined) {
        return defaultReminder;
    }
    const commonTripReferenceJourney = odSurveyHelpers.getJourneysArray({ person: commonTripReferencePerson })[0];
    if (commonTripReferenceJourney === undefined) {
        return defaultReminder;
    }

    // Does the first person have trips made in common with the current person?
    const referenceTrips = odSurveyHelpers.getTripsArray({ journey: commonTripReferenceJourney });
    const commonTrips = referenceTrips.filter(
        (trip) =>
            Array.isArray((trip as any).commonTripWith) && (trip as any).commonTripWith.includes(currentPerson._uuid)
    );
    if (commonTrips.length === 0) {
        return defaultReminder;
    }

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
