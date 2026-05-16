import _get from 'lodash/get';
import _upperFirst from 'lodash/upperFirst';
import _escape from 'lodash/escape';
import config from 'evolution-common/lib/config/project.config';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import * as validations from 'evolution-common/lib/services/widgets/validations/validations';
import { TFunction } from 'i18next';
import { formatGeocodingQueryStringFromMultipleFields, getResponse } from 'evolution-common/lib/utils/helpers';
import { shouldDisplayTripJunction } from '../../common/helper';
import { _booleish, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { getModeIcon } from 'evolution-common/lib/services/questionnaire/sections/segments/modeIconMapping';
import { loopActivities } from 'evolution-common/lib/services/odSurvey/types';
import { inaccessibleZoneGeographyCustomValidation } from '../../common/customValidations';

let busRoutes = { type: 'FeatureCollection', features: [] };

// Use async immediately invoked function (IIFE) to handle dynamic import instead of using a require, which causes linter error
(async () => {
    try {
        // FIXME Can't use dynamic import as webpack does not find the file and complains the dependency is an expression
        /* eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
        busRoutes = require(`../../config/busRoutes${_upperFirst(process.env.EV_VARIANT)}.json`);
        busRoutes.features = busRoutes.features.sort((a, b) =>
            (a.properties.sortableName || '').localeCompare(b.properties.sortableName)
        );
    } catch (error) {
        // No bus routes found for this ev variant, it's ok, the question just won't be asked
        console.log('No bus routes found for this survey');
    }
})();

export const segmentBusLines: WidgetConfig.InputMultiselectType = {
    type: 'question',
    path: 'busLines',
    inputType: 'multiselect',
    multiple: true,
    datatype: 'string',
    twoColumns: false,
    containsHtml: true,
    shortcuts: [
        {
            value: 'other',
            label: (t: TFunction) => t('segments:busLinesOther'),
            color: 'grey'
        },
        {
            value: 'dontKnow',
            label: (t: TFunction) => t('segments:busLinesDontKnow'),
            color: 'grey'
        }
    ],
    choices: function (interview, path) {
        // Put possibles lines at the top of the choices
        const lineSummary: any = getResponse(interview, path, undefined, '../trRoutingResult');
        const lines = lineSummary?.lines || [];
        const busRoutesFeatures = busRoutes.features;
        const choices: any[] = busRoutesFeatures.map((busRoute: any) => {
            const busRouteName = busRoute.properties.name;
            const altLine = lines.find(
                (line) =>
                    busRoute.properties.agencyId === line.agencyAcronym &&
                    busRoute.properties.shortname === line.lineShortname
            );
            return {
                value: busRoute.properties.slug,
                color: busRoute.properties.color,
                label: {
                    fr: busRouteName,
                    en: busRouteName
                },
                altCount: altLine === undefined ? 0 : altLine.alternativeCount
            };
        });
        choices.sort((lineA, lineB) => {
            // Bigger value is better
            return lineB.altCount - lineA.altCount;
        });
        choices.push({
            value: 'other',
            color: '#666666',
            sortableName: 'zother',
            label: (t: TFunction) => t('segments:busLinesOther')
        });
        choices.push({
            value: 'dontKnow',
            color: '#666666',
            sortableName: 'zdontknow',
            label: (t: TFunction) => t('segments:busLinesDontKnow')
        });
        return choices;
    },
    label: (t: TFunction, interview, path) => {
        const person = odSurveyHelpers.getPerson({ interview });
        const nickname = _escape(person.nickname);
        return t('segments:busLines', {
            nickname,
            count: odSurveyHelpers.getCountOrSelfDeclared({ interview, person })
        });
    },
    conditional: function (interview, path) {
        const mode = getResponse(interview, path, null, '../mode');
        if (mode !== 'transitBus' || busRoutes.features.length === 0) {
            return [false, null];
        }
        const journey = odSurveyHelpers.getActiveJourney({ interview });
        const trip = odSurveyHelpers.getActiveTrip({ interview });
        const visitedPlaces = odSurveyHelpers.getVisitedPlaces({ journey });
        const destination = odSurveyHelpers.getDestination({ trip, visitedPlaces });
        const activity = destination ? destination.activity : null;
        return [!loopActivities.includes(activity), null];
    },
    validations: function (value, customValue, interview, path, customPath) {
        const person = odSurveyHelpers.getPerson({ interview });
        if (odSurveyHelpers.isSelfDeclared({ person, interview })) {
            return validations.requiredValidation(value, customValue, interview, path, customPath);
        } else {
            // accept blank if proxy:
            return [];
        }
    }
};

export const segmentBusLinesWarning: WidgetConfig.InputButtonType = {
    type: 'question',
    path: 'busLinesWarning',
    inputType: 'button',
    twoColumns: false,
    containsHtml: true,
    choices: function (interview, path) {
        return [
            {
                value: 'ok',
                color: 'grey',
                size: 'medium',
                label: (t) => t('segments:busLinesAreCorrect')
            }
        ];
    },
    label: (t) => t('segments:busLinesWarning'),
    conditional: function (interview, path) {
        const segmentMode = getResponse(interview, path, undefined, '../mode');
        const segmentBuses: any = getResponse(interview, path, undefined, `../${segmentBusLines.path}`);
        if (segmentMode !== 'transitBus' || _isBlank(segmentBuses)) {
            return [false, null];
        }
        const lineSummary: any = getResponse(interview, path, undefined, '../trRoutingResult');
        let hasImpossibleLine = false;
        if (lineSummary !== undefined) {
            const lines = lineSummary.lines || [];
            const busRoutesFeatures = busRoutes.features;
            const declaredBusRoutes = busRoutesFeatures.filter((busRoute) =>
                segmentBuses.includes(busRoute.properties.slug)
            );
            const impossibleBusRoutes = declaredBusRoutes.filter(
                (busRoute) =>
                    lines.find(
                        (line) =>
                            busRoute.properties.agencyId === line.agencyAcronym &&
                            busRoute.properties.shortname === line.lineShortname
                    ) === undefined
            );
            hasImpossibleLine = impossibleBusRoutes.length !== 0;
        }
        return [hasImpossibleLine, null];
    },
    validations: function (value, customValue, interview, path, customPath) {
        return [
            {
                validation: _isBlank(value),
                errorMessage: (t: TFunction) => t('segments:busLinesWarningRequired')
            }
        ];
    }
};
