import * as odSurveyHelper from 'evolution-common/lib/services/odSurvey/helpers';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import { TFunction } from 'i18next';
import { getSelfRespondentWithNoDisabilityAndDrivingAge } from '../../common/customHelpers';

// Retourne un array de choix correspondant aux auto-répondant sans incapacité
// et en âge en de conduire, avec leur identification comme valeur
export const hhAge16PlusCustomChoices: WidgetConfig.ParsingFunction<WidgetConfig.RadioChoiceType[]> = (interview) =>
    getSelfRespondentWithNoDisabilityAndDrivingAge(interview).map((person) => ({
        value: person._uuid,
        label: (t: TFunction) => odSurveyHelper.getPersonIdentificationString({ person, t })
    }));
