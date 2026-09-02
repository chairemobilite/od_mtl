import { TFunction } from 'i18next';
import * as defaultInputBase from 'evolution-frontend/lib/components/inputs/defaultInputBase';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import * as conditionals from '../../common/conditionals';
import * as customValidations from '../../common/customValidations';
import { getResponse } from 'evolution-common/lib/utils/helpers';

// Note: This is a custom widget, because we need to use a Math.min() function.
export const householdPluginHybridCarNumber: WidgetConfig.InputRadioNumberType = {
    ...defaultInputBase.inputRadioNumberBase,
    path: 'household.pluginHybridCarNumber',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction) => t('end:householdPluginHybridCarNumber'),
    valueRange: {
        min: 0,
        max: (interview) => Math.min(4, Number(getResponse(interview, 'household.carNumber', 0)))
    },
    overMaxAllowed: true,
    conditional: conditionals.householdHasCars,
    validations: customValidations.householdHybridCarCountCustomValidation
};

// Note: This is a custom widget, because we need to use a Math.min() function.
export const householdElectricCarNumber: WidgetConfig.InputRadioNumberType = {
    ...defaultInputBase.inputRadioNumberBase,
    path: 'household.electricCarNumber',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction) => t('end:householdElectricCarNumber'),
    valueRange: {
        min: 0,
        max: (interview) => Math.min(4, Number(getResponse(interview, 'household.carNumber', 0)))
    },
    overMaxAllowed: true,
    conditional: conditionals.householdHasCars,
    validations: customValidations.householdElectricCarCountCustomValidation
};
