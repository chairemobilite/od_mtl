import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import * as odHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import config from 'evolution-common/lib/config/project.config';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { personsArrayToChoices } from '../../common/customHelpers';
import { TFunction } from 'i18next';

// List possible self-respondents among the interviewable persons and add "another person" choice
export const person14PlusAndOtherCustomChoices: WidgetConfig.ParsingFunction<WidgetConfig.ChoiceType[]> = (
    interview
) => {
    const interviewablePersons = odHelpers.getInterviewablePersonsArray({ interview });
    const choices = personsArrayToChoices(
        interviewablePersons.filter((person) => person.age >= config.selfResponseMinimumAge)
    );
    choices.push({
        value: 'anotherPerson',
        label: (t: TFunction) => t('omissions:anotherPersonChoice')
    });
    return choices;
};
