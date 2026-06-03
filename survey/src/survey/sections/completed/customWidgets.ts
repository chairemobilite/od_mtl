import { TFunction } from 'i18next';
import i18n from 'evolution-frontend/lib/config/i18n.config';
import { defaultConditional } from 'evolution-common/lib/services/widgets/conditionals/defaultConditional';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';

const artmPanelUrl = () =>
    i18n.language === 'fr' ? 'https://parlonsmobilite.quebec/fr' : 'https://parlonsmobilite.quebec/en';

export const buttonARTMPanel: WidgetConfig.ButtonWidgetConfig = {
    type: 'button',
    path: 'buttonARTMPanel',
    containsHtml: true,
    label: (t: TFunction) => t('completed:buttonARTMPanel'),
    color: 'blue',
    action: () => {
        // Go to the ARTM Panel URL in a new tab, with no opener to prevent the new tab from being able to access the current tab's DOM
        window.open(artmPanelUrl(), '_blank', 'noopener');
    },
    align: 'left',
    conditional: defaultConditional
};
