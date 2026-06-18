import * as odSurveyHelper from 'evolution-common/lib/services/odSurvey/helpers';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import { TFunction } from 'i18next';
import { getPersonsOfDrivingAge } from '../../common/customHelpers';

// Retourne un array de choix correspondant aux membres du ménage en âge de
// conduire, avec leur identification comme valeur
export const hhAge16PlusCustomChoices: WidgetConfig.ParsingFunction<WidgetConfig.RadioChoiceType[]> = (interview) =>
    getPersonsOfDrivingAge(interview).map((person) => ({
        value: person._uuid,
        label: (t: TFunction) => odSurveyHelper.getPersonIdentificationString({ person, t })
    }));
