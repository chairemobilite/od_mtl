import moment from 'moment';
import i18n from 'evolution-frontend/lib/config/i18n.config';
import { TFunction } from 'i18next';
import _escape from 'lodash/escape';
import { _booleish, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import * as odSurveyHelper from 'evolution-common/lib/services/odSurvey/helpers';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import { addGroupedObjects, getResponse } from 'evolution-common/lib/utils/helpers';
import { getFormattedDate, validateButtonActionWithCompleteSection } from 'evolution-frontend/lib/services/display/frontendHelper';
import { buttonNextBase } from 'evolution-frontend/lib/components/inputs/defaultInputBase';
import { defaultConditional } from 'evolution-common/lib/services/widgets/conditionals/defaultConditional';

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

const goToNextSectionButtonAction: WidgetConfig.ButtonAction = (
    callbacks,
    interview,
    path,
    _section,
    sections,
    saveCallback
) => {
    const currentPerson = odSurveyHelper.getActivePerson({ interview });
    const currentJourney = odSurveyHelper.getActiveJourney({ interview, person: currentPerson });
    if (currentPerson === null || currentJourney === null) {
        throw new Error('tripsIntroSaveCallback: Current person and journey not found');
    }
    // Get all persons who should have their trip diary skipped, they
    // responses may have changed, so we need to look at all the persons
    const allPersons = odSurveyHelper.getPersonsArray({ interview });
    const personIdsToSkipTripDiary = Array.from(new Set(
        allPersons.flatMap((person) => {
            const journey = odSurveyHelper.getJourneysArray({ person })[0];
            if (journey === undefined) {
                return [];
            }
            const personReturnedHome = (currentJourney as any).returnedHome;
            // Person returned home, no extra information to get here
            if (personReturnedHome !== 'no') {
                return [];
            }
            const outOfTerritoryMembers = (currentJourney as any).outOfTerritoryMembers;
            const outOfTerritoryMembersUuids =
                Array.isArray(outOfTerritoryMembers) && !outOfTerritoryMembers.includes('none')
                    ? outOfTerritoryMembers
                    : [];
            return [
                { personUuid: person._uuid, matchingJourney: journey },
                ...outOfTerritoryMembersUuids.map((personUuid) => ({ personUuid, matchingJourney: journey }))
            ];
        })
    ));

    // Handle out of territory members to skip their trip diaries
    const valuesByPath = {};
    for (const person of allPersons) {
        const currentPersonJourney = odSurveyHelper.getJourneysArray({ person })[0];
        const skippedPersonJourney = personIdsToSkipTripDiary.find(
            (personJourney) => personJourney.personUuid === person._uuid
        );
        // This person's trip diary should not be skipped, but it was. Reset
        // the skip flag
        if (
            skippedPersonJourney === undefined &&
            currentPersonJourney !== undefined &&
            currentPersonJourney._skipTripDiary === true
        ) {
            valuesByPath[
                `response.household.persons.${person._uuid}.journeys.${currentPersonJourney._uuid}._skipTripDiary`
            ] = false;
        } else if (skippedPersonJourney !== undefined) {
            // This persons's journey should be skipped.
            // If the journey already exists, just set its flag to `true`
            if (currentPersonJourney !== undefined) {
                valuesByPath[
                    `response.household.persons.${person._uuid}.journeys.${currentPersonJourney._uuid}._skipTripDiary`
                ] = true;
            } else {
                // Otherwise create a new journey with the data from the base journey
                // Keep fields from the base journey
                const {
                    departurePlaceIsHome,
                    departurePlaceOther,
                    personDidTrips,
                    personDidTripsConfirm,
                    returnedHome
                } = skippedPersonJourney.matchingJourney as any;
                const { valuesByPath: newJourneysValuesByPath } = addGroupedObjects(
                    interview,
                    1,
                    1,
                    `household.persons.${person._uuid}.journeys`,
                    // Set the new person popup flag, the corresponding widget will determine if it needs to be displayed for this context
                    [
                        {
                            departurePlaceIsHome,
                            departurePlaceOther,
                            personDidTrips,
                            personDidTripsConfirm,
                            returnedHome,
                            startDate: getResponse(interview, '_assignedDay'),
                            _showNewPersonPopupButton: true,
                            _skipTripDiary: true
                        }
                    ]
                );
                Object.assign(valuesByPath, newJourneysValuesByPath);
            }
        }
    }
    if (Object.keys(valuesByPath).length > 0) {
        // Update interview first, then navigate to the next section
        callbacks.startUpdateInterview({ valuesByPath }, (updatedInterview) => {
            validateButtonActionWithCompleteSection(callbacks,
                updatedInterview,
                path,
                _section,
                sections,
                saveCallback)
        });
    } else {
        validateButtonActionWithCompleteSection(callbacks,
            interview,
            path,
            _section,
            sections,
            saveCallback)
    }
};

export const tripsIntro_save: WidgetConfig.ButtonWidgetConfig = {
    ...buttonNextBase,
    path: 'tripsIntro.save',
    label: (t: TFunction) => t('tripsIntro:tripsIntro_save'),
    conditional: defaultConditional,
    action: goToNextSectionButtonAction
};
