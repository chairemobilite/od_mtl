import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import * as odHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import config from 'evolution-common/lib/config/project.config';
import { TFunction } from 'i18next';
import { getFormattedDate } from 'evolution-frontend/lib/services/display/frontendHelper';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import i18n from 'evolution-frontend/lib/config/i18n.config';
import { getResponse } from 'evolution-common/lib/utils/helpers';

// List possible self-respondents among the interviewable persons
export const whoAnswersCustomChoices: WidgetConfig.ParsingFunction<WidgetConfig.RadioChoiceType[]> = (interview) => {
    const interviewablePersons = odHelpers.getInterviewablePersonsArray({ interview });
    return interviewablePersons
        .filter((person) => person.age >= config.selfResponseMinimumAge)
        .map((person) => ({
            value: person._uuid,
            label: person.nickname
        }));
};

// Custom because the labels of the choices contain journey dates
export const personDidTripsConfirmCustomChoices: WidgetConfig.RadioChoiceType[] = [
    {
        value: 'no',
        label: (t: TFunction, interview, path) => {
            const journeyContext = odHelpers.getJourneyContextFromPath({ interview, path });
            if (!journeyContext) {
                throw new Error('personDidTripsConfirmCustomLabel: Journey context not found');
            }
            const { person, journey } = journeyContext;
            const assignedDay = journey.startDate;
            const journeyDate = !_isBlank(assignedDay)
                ? getFormattedDate(assignedDay!, { withRelative: true, locale: i18n.language })
                : undefined;

            return t('tripsIntro:personDidTripsConfirmChoiceNo', {
                count: odHelpers.getCountOrSelfDeclared({ interview, person }),
                nickname: odHelpers.getPersonIdentificationString({ person, t }),
                journeyDate
            });
        }
    },
    {
        value: 'yes',
        label: (t: TFunction, interview, path) => {
            const journeyContext = odHelpers.getJourneyContextFromPath({ interview, path });
            if (!journeyContext) {
                throw new Error('personDidTripsConfirmCustomLabel: Journey context not found');
            }
            const { person, journey } = journeyContext;
            const assignedDay = journey.startDate;
            const journeyDate = !_isBlank(assignedDay)
                ? getFormattedDate(assignedDay!, { withRelative: true, locale: i18n.language })
                : undefined;

            return t('tripsIntro:personDidTripsConfirmChoiceYes', {
                count: odHelpers.getCountOrSelfDeclared({ interview, person }),
                nickname: odHelpers.getPersonIdentificationString({ person, t }),
                journeyDate
            });
        }
    }
];

// Custom because the 'no' has a suffix label option depending on the departure place declared in the survey
export const outOfTerritoryCustomChoices: WidgetConfig.RadioChoiceType[] = [
    {
        value: 'no',
        label: (t: TFunction, interview, path) => {
            const person = odHelpers.getPerson({ interview, path });
            const departurePlaceOther = getResponse(interview, path, undefined, '../departurePlaceOther');
            return t(
                [`tripsIntro:outOfTerritoryChoiceNo_${departurePlaceOther}`, 'tripsIntro:outOfTerritoryChoiceNo'],
                {
                    count: odHelpers.getCountOrSelfDeclared({ interview, person }),
                    nickname: odHelpers.getPersonIdentificationString({ person, t })
                }
            );
        }
    },
    {
        value: 'yes',
        label: (t: TFunction, interview, path) => {
            const person = odHelpers.getPerson({ interview, path });
            return t('tripsIntro:outOfTerritoryChoiceYes', {
                count: odHelpers.getCountOrSelfDeclared({ interview, person }),
                nickname: odHelpers.getPersonIdentificationString({ person, t })
            });
        }
    }
];

// Custom choices because it lists household members
export const outOfTerritoryMembersCustomChoices: WidgetConfig.ParsingFunction<WidgetConfig.ChoiceType[]> = (
    interview
) => {
    const persons = odHelpers.getPersonsArray({ interview });
    const choices: WidgetConfig.ChoiceType[] = persons.map((person) => ({
        value: person._uuid,
        label: person.nickname
    }));
    choices.unshift({
        value: 'none',
        label: (t: TFunction) => t('tripsIntro:outOfTerritoryMembersChoiceNone')
    });
    return choices;
};
