import { _booleish, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { countPersons, getPersonsArray } from 'evolution-common/lib/services/odSurvey/helpers';
import type { InterviewAttributes, Journey } from 'evolution-common/lib/services/questionnaire/types';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import i18n from 'evolution-frontend/lib/config/i18n.config';
import { getFormattedDate } from 'evolution-frontend/lib/services/display/frontendHelper';

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
    const persons = getPersonsArray({ interview });
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
