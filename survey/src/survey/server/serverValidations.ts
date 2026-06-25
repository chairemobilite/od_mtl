import { validateAccessCode } from 'evolution-backend/lib/services/accessCode';

export default {
    accessCode: {
        validations: [
            {
                validation: (value) => typeof value === 'string' && !validateAccessCode(value),
                // FIXME Server side translations are not as fully integrated as client side with i18next, so we keep hard-coded error messages for now. See https://github.com/chairemobilite/evolution/issues/1061
                errorMessage: {
                    fr: 'Code d\'accès invalide.',
                    en: 'Invalid access code.'
                }
            }
        ]
    }
};
