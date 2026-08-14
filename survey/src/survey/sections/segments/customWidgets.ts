import _get from 'lodash/get';
import _upperFirst from 'lodash/upperFirst';
import _escape from 'lodash/escape';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import * as validations from 'evolution-common/lib/services/widgets/validations/validations';
import { TFunction } from 'i18next';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import { _booleish, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { loopActivities } from 'evolution-common/lib/services/odSurvey/types';
import * as conditionals from '../../common/conditionals';
import metroStations from '../../geojson/stations_metro.json';
import remStations from '../../geojson/stations_rem.json';
import trainStations from '../../geojson/gares_train.json';
import {
    getSegmentNextLocation,
    getSegmentPreviousLocation
} from 'evolution-common/lib/services/questionnaire/sections/segments/helpers';
import * as customValidations from '../../common/customValidations';
import busRoutes from '../../config/busRoutes.json';

const metroStationsFC = metroStations as GeoJSON.FeatureCollection<GeoJSON.Point>;
const remStationsFC = remStations as GeoJSON.FeatureCollection<GeoJSON.Point>;
const trainStationsFC = trainStations as GeoJSON.FeatureCollection<GeoJSON.Point>;

const isProxyRespondent = (interview: WidgetConfig.InterviewAttributes, path: string) => {
    const person = odSurveyHelpers.getPerson({ interview });
    return !odSurveyHelpers.isSelfDeclared({ person, interview });
};

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
        },
        {
            value: 'onDemand',
            label: (t: TFunction) => t('segments:busLinesOnDemand'),
            color: 'grey'
        },
        {
            value: 'schoolLine',
            label: (t: TFunction) => t('segments:busLinesSchoolLine'),
            color: 'grey'
        }
    ],
    choices: function (interview, path) {
        // Put possibles lines at the top of the choices
        const lineSummary: any = getResponse(interview, path, undefined, '../trRoutingResult');
        const lines = lineSummary?.lines || [];
        const choices: any[] = busRoutes.map((busRoute) => {
            const busRouteName = busRoute.name;
            const altLine = lines.find(
                (line) => busRoute.agencyAcronym === line.agencyAcronym && busRoute.lineShortname === line.lineShortname
            );
            return {
                value: busRoute.slug,
                color: busRoute.color,
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
            label: (t: TFunction) => t('segments:busLinesDontKnow'),
            conditional: isProxyRespondent
        });
        choices.push({
            value: 'onDemand',
            color: '#666666',
            sortableName: 'zondemand',
            label: (t: TFunction) => t('segments:busLinesOnDemand'),
            conditional: (interview, path) => {
                const segmentContext = odSurveyHelpers.getSegmentContextFromPath({ interview, path });
                if (segmentContext === null) {
                    throw new Error('segmentBusLines onDemand choice: segment context is undefined');
                }
                const previousLocation = getSegmentPreviousLocation({ interview, ...segmentContext });
                const nextLocation = getSegmentNextLocation({ interview, ...segmentContext });
                return (
                    previousLocation !== null &&
                    nextLocation !== null &&
                    (previousLocation.properties.isOnDemandTransitZone === true ||
                        nextLocation.properties.isOnDemandTransitZone === true)
                );
            }
        });
        choices.push({
            value: 'schoolLine',
            color: '#666666',
            sortableName: 'zschoolline',
            label: (t: TFunction) => t('segments:busLinesSchoolLine'),
            conditional: (interview, path) => {
                const segmentContext = odSurveyHelpers.getSegmentContextFromPath({ interview, path });
                if (segmentContext === null) {
                    throw new Error('segmentBusLines onDemand choice: segment context is undefined');
                }
                const { person } = segmentContext;
                // Display if person age is 16 or below
                if (typeof person.age === 'number' && person.age > 16) {
                    return false;
                }
                // Make sure previous or next location are in RA 1 to 5
                const previousLocation = getSegmentPreviousLocation({ interview, ...segmentContext });
                const nextLocation = getSegmentNextLocation({ interview, ...segmentContext });
                return (
                    (previousLocation !== null &&
                        typeof previousLocation.properties.RA === 'number' &&
                        previousLocation.properties.RA <= 5) ||
                    (nextLocation !== null &&
                        typeof nextLocation.properties.RA === 'number' &&
                        nextLocation.properties.RA <= 5)
                );
            }
        });
        return choices;
    },
    label: (t: TFunction, interview, path) => {
        const person = odSurveyHelpers.getPerson({ interview });
        const nickname = _escape(person.nickname);
        return t('segments:segmentBusLines', {
            nickname,
            count: odSurveyHelpers.getCountOrSelfDeclared({ interview, person })
        });
    },
    conditional: function (interview, path) {
        const mode = getResponse(interview, path, null, '../mode');
        if (mode !== 'transitBus' || busRoutes.length === 0) {
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
    label: (t) => t('segments:segmentBusLinesWarning'),
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
            const declaredBusRoutes = busRoutes.filter((busRoute) => segmentBuses.includes(busRoute.slug));
            const impossibleBusRoutes = declaredBusRoutes.filter(
                (busRoute) =>
                    lines.find(
                        (line) =>
                            busRoute.agencyAcronym === line.agencyAcronym &&
                            busRoute.lineShortname === line.lineShortname
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

const featureSelectAdditionalChoices = [
    {
        label: (t: TFunction) => t('segments:featureSelect.other'),
        value: 'other'
    },
    {
        label: (t: TFunction) => t('segments:featureSelect.dontKnow'),
        value: 'dontknow',
        conditional: isProxyRespondent
    }
];

const featureSelectShortcuts = [
    {
        label: (t: TFunction) => t('segments:featureSelect.other'),
        value: 'other',
        color: 'grey'
    },
    {
        label: (t: TFunction) => t('segments:featureSelect.dontKnow'),
        value: 'dontknow',
        color: 'grey'
    }
];

export const segmentSubwayStationStart: WidgetConfig.InputSelectFeatureType = {
    type: 'question',
    inputType: 'selectFeature',
    path: 'subwayStationStart',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction) => t('segments:segmentSubwayStationStart'),
    featureCollection: metroStationsFC,
    labelProperty: 'nom',
    referenceGeography: (interview, path) => {
        const segmentContext = odSurveyHelpers.getSegmentContextFromPath({ interview, path });
        if (segmentContext === null) {
            throw new Error('segmentSubwayStationStart referenceGeography: segment context is undefined');
        }
        return getSegmentPreviousLocation({ interview, ...segmentContext });
    },
    additionalChoices: featureSelectAdditionalChoices,
    shortcuts: featureSelectShortcuts,
    conditional: conditionals.subwayConditional,
    validations: validations.requiredValidation
};

export const segmentSubwayStationEnd: WidgetConfig.InputSelectFeatureType = {
    type: 'question',
    inputType: 'selectFeature',
    path: 'subwayStationEnd',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction) => t('segments:segmentSubwayStationEnd'),
    featureCollection: metroStationsFC,
    labelProperty: 'nom',
    referenceGeography: (interview, path) => {
        const segmentContext = odSurveyHelpers.getSegmentContextFromPath({ interview, path });
        if (segmentContext === null) {
            throw new Error('segmentSubwayStationEnd referenceGeography: segment context is undefined');
        }
        return getSegmentNextLocation({ interview, ...segmentContext });
    },
    additionalChoices: featureSelectAdditionalChoices,
    shortcuts: featureSelectShortcuts,
    conditional: conditionals.subwayConditional,
    validations: validations.requiredValidation
};

export const segmentTrainStationStart: WidgetConfig.InputSelectFeatureType = {
    type: 'question',
    inputType: 'selectFeature',
    path: 'trainStationStart',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction) => t('segments:segmentTrainStationStart'),
    featureCollection: trainStationsFC,
    labelProperty: 'nom',
    referenceGeography: (interview, path) => {
        const segmentContext = odSurveyHelpers.getSegmentContextFromPath({ interview, path });
        if (segmentContext === null) {
            throw new Error('segmentTrainStationStart referenceGeography: segment context is undefined');
        }
        return getSegmentPreviousLocation({ interview, ...segmentContext });
    },
    additionalChoices: featureSelectAdditionalChoices,
    shortcuts: featureSelectShortcuts,
    conditional: conditionals.trainConditional,
    validations: validations.requiredValidation
};

// FIXME Validations: segmentTrainStationEnd : trainValidation · Issue #20 · chairemobilite/od_mtl
export const segmentTrainStationEnd: WidgetConfig.InputSelectFeatureType = {
    type: 'question',
    inputType: 'selectFeature',
    path: 'trainStationEnd',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction) => t('segments:segmentTrainStationEnd'),
    featureCollection: trainStationsFC,
    labelProperty: 'nom',
    referenceGeography: (interview, path) => {
        const segmentContext = odSurveyHelpers.getSegmentContextFromPath({ interview, path });
        if (segmentContext === null) {
            throw new Error('segmentTrainStationEnd referenceGeography: segment context is undefined');
        }
        return getSegmentNextLocation({ interview, ...segmentContext });
    },
    additionalChoices: featureSelectAdditionalChoices,
    shortcuts: featureSelectShortcuts,
    conditional: conditionals.trainConditional,
    validations: customValidations.trainCustomValidation
};

export const segmentRemStationStart: WidgetConfig.InputSelectFeatureType = {
    type: 'question',
    inputType: 'selectFeature',
    path: 'remStationStart',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction) => t('segments:segmentRemStationStart'),
    featureCollection: remStationsFC,
    labelProperty: 'nom',
    referenceGeography: (interview, path) => {
        const segmentContext = odSurveyHelpers.getSegmentContextFromPath({ interview, path });
        if (segmentContext === null) {
            throw new Error('segmentRemStationStart referenceGeography: segment context is undefined');
        }
        return getSegmentPreviousLocation({ interview, ...segmentContext });
    },
    additionalChoices: featureSelectAdditionalChoices,
    shortcuts: featureSelectShortcuts,
    conditional: conditionals.remConditional,
    validations: validations.requiredValidation
};

export const segmentRemStationEnd: WidgetConfig.InputSelectFeatureType = {
    type: 'question',
    inputType: 'selectFeature',
    path: 'remStationEnd',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction) => t('segments:segmentRemStationEnd'),
    featureCollection: remStationsFC,
    labelProperty: 'nom',
    referenceGeography: (interview, path) => {
        const segmentContext = odSurveyHelpers.getSegmentContextFromPath({ interview, path });
        if (segmentContext === null) {
            throw new Error('segmentRemStationEnd referenceGeography: segment context is undefined');
        }
        return getSegmentNextLocation({ interview, ...segmentContext });
    },
    additionalChoices: featureSelectAdditionalChoices,
    shortcuts: featureSelectShortcuts,
    conditional: conditionals.remConditional,
    validations: validations.requiredValidation
};
