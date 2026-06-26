import { TFunction } from 'i18next';
import * as defaultInputBase from 'evolution-frontend/lib/components/inputs/defaultInputBase';
import { defaultConditional } from 'evolution-common/lib/services/widgets/conditionals/defaultConditional';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import { validateButtonActionWithCompleteSection } from 'evolution-frontend/lib/services/display/frontendHelper';

// Custom widget pour que l'action envoie un champ pour déclencher le server field update
export const accessCode_confirm: WidgetConfig.ButtonWidgetConfig = {
    ...defaultInputBase.buttonNextBase,
    path: 'accessCode.confirm',
    label: (t: TFunction) => t('accessCode:accessCode_confirm'),
    conditional: defaultConditional,
    action: (callbacks, _interview, path, section, sections, saveCallback) => {
        // Faire un premier update pour valider le code d'accès et permettre de continuer au besoin
        callbacks.startUpdateInterview({ valuesByPath: { 'response.accessCodeConfirm': true } }, (updatedInterview) => {
            // Si les widgets sont valides, continuer vers la prochaine section
            if ((updatedInterview as any).allWidgetsValid) {
                validateButtonActionWithCompleteSection(
                    callbacks,
                    updatedInterview,
                    path,
                    section,
                    sections,
                    saveCallback
                );
            }
        });
    }
};
