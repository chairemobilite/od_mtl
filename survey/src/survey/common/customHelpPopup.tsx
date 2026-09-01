import { TFunction } from 'i18next';
import { ButtonWidgetConfig, HelpPopup } from 'evolution-common/lib/services/questionnaire/types';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { getFormattedDate } from 'evolution-frontend/lib/services/display/frontendHelper';
import { getHouseholdMinimumAgeConfirmPopup } from 'evolution-common/lib/services/questionnaire/sections/common/householdMinimumAgeConfirmPopup';
import { homeNotInTerritoryConditional } from './conditionals';

// TODO: Use the assignedDate from the interview object instead of the date of the survey.
// TODO: Update the assignedDate from serverFieldUpdate.ts and test it from serverFieldUpdate.test.ts
export const householdSizeHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('home:popup.householdSizeTitle'),
    containsHtml: true,
    content: (t: TFunction, interview) => {
        // assigned date should be the day before the interview started:
        const assignedDay = getResponse(interview, '_assignedDay') as string;
        const assignedDate = getFormattedDate(assignedDay, { withDayOfWeek: true, withRelative: true });

        return t('home:popup.householdSizeContent', {
            assignedDate
        });
    }
};

export const householdOwnershipHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('home:popup.homeOwnershipTitle'),
    containsHtml: true,
    content: (t: TFunction, interview) => t('home:popup.homeOwnershipContent')
};

export const householdCarNumberHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('home:popup.householdCarNumberTitle'),
    containsHtml: true,
    content: (t: TFunction, interview) => t('home:popup.householdCarNumberContent')
};

export const twoWheelNumberHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('home:popup.householdTwoWheelTitle'),
    containsHtml: true,
    content: (t: TFunction, interview) => t('home:popup.householdTwoWheelContent')
};

export const validateHouseholdAgesHelpPopup: ButtonWidgetConfig['confirmPopup'] = getHouseholdMinimumAgeConfirmPopup();

export const assignedDateHelpPopup: HelpPopup = {
    containsHtml: true,
    title: (t: TFunction, interview) => t('tripsIntro:WhyThisDate'),
    content: (t: TFunction, interview) => t('tripsIntro:WhyThisDateExplanation')
};

export const usualWorkPlaceCommutingHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('travelBehavior:workCommutingHelpPopup.title'),
    content: (t: TFunction) => t('travelBehavior:workCommutingHelpPopup.content')
};

const fareTbl = [
    { fareName: 'A', regular: '110', reduced: '66' },
    { fareName: 'AB', regular: '170', reduced: '102' },
    { fareName: 'ABC', regular: '206', reduced: '123.50' },
    { fareName: 'ABCD', regular: '281', reduced: '168.50' },
    { fareName: 'bus', regular: '119', reduced: '71.50' },
    { fareName: 'busCD', regular: '119', reduced: '71.50' }
];
export const transitFareHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('household:popup.transitFareTitle'),
    containsHtml: true,
    content: (t: TFunction) => {
        const fareTblStr = fareTbl
            .map(({ fareName, regular, reduced }) =>
                t('household:popup.transitFareOneFareLine', {
                    fareName: t(`choices:transitFareType.${fareName}`),
                    regular,
                    reduced
                })
            )
            .join('<br/>');
        return t('household:popup.transitFareContent', { fareTable: fareTblStr });
    }
};

export const studentHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('household:popup.studentTitle'),
    containsHtml: true,
    content: (t: TFunction, interview) => t('household:popup.studentContent')
};

export const workerHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('household:popup.workerTitle'),
    containsHtml: true,
    content: (t: TFunction, interview) => t('household:popup.workerContent')
};

export const toddlerDaycareHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('omissions:popup.toddlerDaycareTitle'),
    containsHtml: true,
    content: (t: TFunction, interview) => t('omissions:popup.toddlerDaycareContent')
};

export const incomeHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('end:popup.incomeHelpPopupTitle'),
    containsHtml: true,
    content: (t: TFunction, interview) => t('end:popup.incomeHelpPopupContent')
};

export const homeNotInTerritoryConfirmPopup: ButtonWidgetConfig['confirmPopup'] = {
    content: (t: TFunction) => t('home:popup.homeNotInTerritoryPleaseValidate'),
    showConfirmButton: true,
    cancelButtonColor: 'blue',
    confirmButtonColor: 'blue',
    cancelButtonLabel: (t: TFunction) => t('home:popup.validateHomeGeography'),
    confirmButtonLabel: (t: TFunction) => t('home:popup.confirmHomeGeography'),
    conditional: homeNotInTerritoryConditional
};
