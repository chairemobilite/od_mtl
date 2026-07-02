import { TFunction } from 'i18next';
import * as surveyHelper from 'evolution-common/lib/utils/helpers';
import { GroupConfig, InputRadioNumberType } from 'evolution-common/lib/services/questionnaire/types';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import { householdMembersWidgetsNames } from './widgetsNames';
import { inputRadioNumberBase } from 'evolution-frontend/lib/components/inputs/defaultInputBase';
import { requiredValidation } from 'evolution-common/lib/services/widgets/validations/validations';
import { personWorkTripDaysConditional } from '../../common/conditionals';

// TODO: Migrate most of these widgets in Evolution Frontend, not here.
export const householdMembers: GroupConfig = {
    type: 'group',
    path: 'household.persons',
    title: {
        fr: 'Membres du ménage',
        en: 'Household members'
    },
    name: {
        fr: function (groupedObject: any, sequence, interview) {
            const householdSize = surveyHelper.getResponse(interview, 'household.size', 1);
            if (householdSize === 1) {
                return 'Veuillez entrer les informations suivantes:';
            }
            return `Personne ${sequence || groupedObject['_sequence']} ${
                groupedObject.nickname ? `• **${groupedObject.nickname}**` : ''
            }`;
        },
        en: function (groupedObject: any, sequence, interview) {
            const householdSize = surveyHelper.getResponse(interview, 'household.size', 1);
            if (householdSize === 1) {
                return 'Please enter the following information:';
            }
            return `Person ${sequence || groupedObject['_sequence']} ${
                groupedObject.nickname ? `• **${groupedObject.nickname}**` : ''
            }`;
        }
    },
    showGroupedObjectDeleteButton: function (interview, path) {
        const countPersons = odSurveyHelpers.countPersons({ interview });
        const householdSize = surveyHelper.getResponse(interview, 'household.size', null);
        const householdSizeNum = householdSize ? Number(householdSize) : undefined;
        return householdSizeNum ? countPersons > householdSizeNum : false;
    },
    showGroupedObjectAddButton: function (interview, path) {
        return true;
    },
    groupedObjectAddButtonLabel: (t: TFunction) => t('household:addGroupedObject'),
    groupedObjectDeleteButtonLabel: (t: TFunction) => t('household:deleteThisGroupedObject'),
    addButtonSize: 'small',
    widgets: householdMembersWidgetsNames
};

// Custom because of the max value that depends on another question
export const personTravelToWorkDays: InputRadioNumberType = {
    ...inputRadioNumberBase,
    path: 'travelToWorkDays',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction, interview, path) => {
        const activePerson = odSurveyHelpers.getPerson({ interview, path });
        const countPersons = odSurveyHelpers.countPersons({ interview });
        return t('household:personTravelToWorkDays', {
            nickname: odSurveyHelpers.getPersonIdentificationString({ person: activePerson, t }),
            count: countPersons
        });
    },
    valueRange: {
        min: 0,
        max: (interview, path) => {
            const workDays = surveyHelper.getResponse(interview, path, null, '../workDays');
            // Limiter à workDays si spécifié (pour hybride), sinon, 7
            return workDays ? Number(workDays) : 7;
        }
    },
    conditional: personWorkTripDaysConditional,
    validations: requiredValidation
};
