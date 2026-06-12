import { ChoiceType } from 'evolution-common/lib/services/questionnaire/types';
import { labelWithAssignedDate } from '../../common/customLabels';

// Custom choices because the labels need the assigned date
export const didRespondForCorrectAssignedDateCustomChoices: ChoiceType[] = [
    {
        value: 'yes',
        label: labelWithAssignedDate('choices:didRespondForCorrectAssignedDateChoices.yes')
    },
    {
        value: 'no',
        label: labelWithAssignedDate('choices:didRespondForCorrectAssignedDateChoices.no')
    }
];
