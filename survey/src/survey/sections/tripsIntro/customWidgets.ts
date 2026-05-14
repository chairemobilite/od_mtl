import moment from 'moment';
import i18n from 'evolution-frontend/lib/config/i18n.config';
import { TFunction } from 'i18next';
import _escape from 'lodash/escape';
import { _booleish, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import * as odSurveyHelper from 'evolution-common/lib/services/odSurvey/helpers';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import { getFormattedDate } from 'evolution-frontend/lib/services/display/frontendHelper';

// FIXME This widget is custom because of the choices, conditional and label, it is also in the tripsSelectPeron
export const personNewPerson = {
    type: 'question',
    inputType: 'button',
    path: 'household.persons.{_activePersonId}.journeys.{_activeJourneyId}._showNewPersonPopupButton',
    align: 'left',
    datatype: 'boolean',
    twoColumns: false,
    isModal: true,
    containsHtml: true,
    label: (t: TFunction, interview) => {
        const activePerson = odSurveyHelper.getActivePerson({ interview });
        const nickname = _escape(activePerson.nickname);
        return t('tripsIntro:personNewPerson', {
            nickname
        });
    },
    choices: [
        {
            value: false,
            label: (t: TFunction) => t('customLabel:Continue'),
            color: 'green'
        },
        {
            // Keep this hidden `true` value so that the value is not reset when it is intialized to true (label and color do not matter)
            value: true,
            hidden: true
        }
    ],
    conditional: function (interview, path) {
        const interviewablePersons = odSurveyHelper.getInterviewablePersonsArray({ interview });
        const previousSections = getResponse(interview, '_sections._actions', []) as {
            section: string;
        }[];
        // The last action is the start of this section, look at the before last section action and see if the section is `selectPerson`
        const manuallySelectedPerson =
            previousSections.length >= 2
                ? previousSections[previousSections.length - 2]['section'] === 'selectPerson'
                : false;
        const showPopup = getResponse(interview, path, true) as boolean;

        // Show the popup if there are more than one interviewablePerson and
        // that person was not manually selected and the popup question is still
        // set to be displayed
        return [interviewablePersons.length > 1 && !manuallySelectedPerson && showPopup === true, false];
    }
};
