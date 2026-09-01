import { TFunction } from 'i18next';
import i18n from 'evolution-frontend/lib/config/i18n.config';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import * as conditionals from '../../common/conditionals';

const artmPanelUrl = () =>
    i18n.language === 'fr'
        ? 'https://panel.parlonsmobilite.quebec/api/redirect/78/fr'
        : 'https://panel.parlonsmobilite.quebec/api/redirect/78/en';

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
    conditional: conditionals.homeInTerritoryConditional
};
