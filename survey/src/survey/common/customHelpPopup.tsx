import moment from 'moment';
import { TFunction } from 'i18next';
import { ButtonWidgetConfig, HelpPopup } from 'evolution-common/lib/services/questionnaire/types';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import i18n from 'chaire-lib-frontend/lib/config/i18n.config';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { getFormattedDate } from 'evolution-frontend/lib/services/display/frontendHelper';
// import { countPersons, getPersonsObject, selfResponseAge } from '../helperFunctions/helper';

export const cityHelpPopup: HelpPopup = {
    title: {
        fr: 'Quoi écrire si ce n\'est pas une ville ?',
        en: 'What to write if it\'s not a city?'
    },
    content: {
        fr: function (_interview, _path) {
            return 'Vous pouvez aussi mettre le nom de votre village, municipalité ou réserve autochtone';
        },
        en: function (_interview, _path) {
            return 'You can also put the name of your village, county or indigeneous reserve.';
        }
    }
};

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

export const validateHouseholdAgesHelpPopup: ButtonWidgetConfig['confirmPopup'] = {
    content: (t: TFunction, interview, path) => {
        const countPersons = odSurveyHelpers.countPersons({ interview });
        return t('household:popup.validateHouseholdAgesHelp', {
            count: countPersons
        });
    },
    showConfirmButton: false,
    cancelButtonColor: 'blue',
    cancelButtonLabel: {
        fr: 'OK',
        en: 'OK'
    },
    conditional: function (interview) {
        const persons = odSurveyHelpers.getPersonsArray({ interview });
        const allPersonsHaveAge = persons.find((person) => _isBlank(person.age)) === undefined;
        // FIXME Why 16? In the config, we have selfResponseMinimumAge, interviewableAge, adultAge, drivingLicenseAge Can we use one of those instead?
        const atLeastOnePersonOlderThan16 =
            persons.find((person) => !_isBlank(person.age) && person.age >= 16) !== undefined;
        return allPersonsHaveAge && !atLeastOnePersonOlderThan16;
    }
};

export const assignedDateHelpPopup: HelpPopup = {
    containsHtml: true,
    title: (t: TFunction, interview) => t('tripsIntro:WhyThisDate'),
    content: (t: TFunction, interview) => t('tripsIntro:WhyThisDateExplanation')
};

export const usualWorkPlaceCommutingHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('travelBehavior:workCommutingHelpPopup.title'),
    content: (t: TFunction) => t('travelBehavior:workCommutingHelpPopup.content')
};

export const transitFareHelpPopup: HelpPopup = {
    title: (t: TFunction) => t('household:popup.transitFareTitle'),
    containsHtml: true,
    content: (t: TFunction, interview) => t('household:popup.transitFareContent')
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
