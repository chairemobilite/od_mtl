import { _booleish, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import type { InterviewAttributes, Journey, Trip } from 'evolution-common/lib/services/questionnaire/types';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import i18n from 'evolution-frontend/lib/config/i18n.config';
import { getFormattedDate } from 'evolution-frontend/lib/services/display/frontendHelper';
import config from 'evolution-common/lib/config/project.config';

const isSchoolEnrolledTrueValues = [
    'kindergarten',
    'childcare',
    'primarySchool',
    'secondarySchool',
    'schoolAtHome',
    'other'
];

// TODO: Migrate all these useful helpers (or not) to Evolution

export const isStudentFromEnrolled = (person) => {
    const schoolType = person.schoolType;
    return !_isBlank(schoolType) && isSchoolEnrolledTrueValues.includes(schoolType);
};

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
