import { TFunction } from 'i18next';
import { _isBlank, _booleish } from 'chaire-lib-common/lib/utils/LodashExtensions';
import * as surveyHelperNew from 'evolution-common/lib/utils/helpers';
import { GroupConfig, InputRadioType } from 'evolution-common/lib/services/questionnaire/types';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import * as validations from 'evolution-common/lib/services/widgets/validations/validations';
import * as defaultInputBase from 'evolution-frontend/lib/components/inputs/defaultInputBase';
import * as conditionals from '../../common/conditionals';
import { householdMembersWidgetsNames } from './widgetsNames';
import * as choices from '../../common/choices';

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
            const householdSize = surveyHelperNew.getResponse(interview, 'household.size', 1);
            if (householdSize === 1) {
                return 'Veuillez entrer les informations suivantes:';
            }
            return `Personne ${sequence || groupedObject['_sequence']} ${
                groupedObject.nickname ? `• **${groupedObject.nickname}**` : ''
            }`;
        },
        en: function (groupedObject: any, sequence, interview) {
            const householdSize = surveyHelperNew.getResponse(interview, 'household.size', 1);
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
        const householdSize = surveyHelperNew.getResponse(interview, 'household.size', null);
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

export const personSchoolType: InputRadioType = {
    ...defaultInputBase.inputRadioBase,
    path: 'schoolType',
    twoColumns: false,
    containsHtml: true,
    customPath: 'schoolTypeOther',
    customChoice: 'other',
    label: (t: TFunction, interview, path) => {
        const activePerson = odSurveyHelpers.getPerson({ interview, path });

        // Different label based on age
        if (activePerson?.age < 4) {
            // For children under 4
            return t('household:schoolTypeLessThan4');
        } else if (activePerson?.age <= 15) {
            // For children between 4 and 15
            return t('household:schoolTypeBetween4And15');
        } else {
            // For people over 15
            return t('household:schoolType');
        }
    },
    choices: choices.schoolType,
    conditional: conditionals.ifAge15OrLessConditional,
    validations: validations.requiredValidation
};
