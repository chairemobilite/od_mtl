import { TFunction } from 'i18next';
import _escape from 'lodash/escape';
import config from 'evolution-common/lib/config/project.config';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import * as customConditionals from '../../common/customConditionals';
import { formatGeocodingQueryStringFromMultipleFields, getResponse } from 'evolution-common/lib/utils/helpers';
import { getActivityMarkerIcon } from 'evolution-common/lib/services/questionnaire/sections/visitedPlaces/activityIconMapping';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { inaccessibleZoneGeographyCustomValidation } from '../../common/customValidations';
import * as conditionals from '../../common/conditionals';

export const personUsualWorkPlaceGeography: WidgetConfig.InputMapFindPlaceType = {
    type: 'question',
    inputType: 'mapFindPlace',
    path: 'household.persons.{_activePersonId}.usualWorkPlace.geography',
    datatype: 'geojson',
    containsHtml: true,
    height: '32rem',
    refreshGeocodingLabel: (t: TFunction) => t('customLabel:RefreshGeocodingLabel'),
    geocodingQueryString: function (interview, path) {
        return formatGeocodingQueryStringFromMultipleFields([getResponse(interview, path, null, '../name')]);
    },
    label: (t: TFunction, interview, path) => {
        const activePerson = odSurveyHelpers.getPerson({ interview, path });
        const countPersons = odSurveyHelpers.countPersons({ interview });
        const nickname = activePerson?.nickname || t('survey:noNickname');
        return t('travelBehavior:personUsualWorkPlaceGeography', {
            nickname,
            count: countPersons
        });
    },
    icon: {
        url: getActivityMarkerIcon('workUsual'),
        size: [70, 70]
    },
    placesIcon: {
        url: (interview, path) => '/dist/icons/interface/markers/marker_round_with_small_circle.svg',
        size: [35, 35]
    },
    selectedIcon: {
        url: (interview, path) => '/dist/icons/interface/markers/marker_round_with_small_circle_selected.svg',
        size: [35, 35]
    },
    defaultCenter: function (interview, path) {
        const homeCoordinates: any = getResponse(interview, 'home.geography.geometry.coordinates', null);
        return homeCoordinates
            ? {
                lat: homeCoordinates[1],
                lon: homeCoordinates[0]
            }
            : config.mapDefaultCenter;
    },
    defaultValue: function (interview, path) {
        return undefined;
    },
    resetToDefaultUnlessUserInteracted: true,
    validations: function (value, _customValue, interview, path, _customPath) {
        const geography: any = getResponse(interview, path, null, '../geography');
        return [
            {
                validation: _isBlank(value),
                errorMessage: (t: TFunction) => t('survey:visitedPlace:locationIsRequiredError')
            },
            {
                validation:
                    geography &&
                    geography.properties.lastAction &&
                    (geography.properties.lastAction === 'mapClicked' ||
                        geography.properties.lastAction === 'markerDragged') &&
                    geography.properties.zoom < 15,
                errorMessage: {
                    fr: 'Le positionnement du lieu n\'est pas assez précis. Utilisez le zoom + pour vous rapprocher davantage, puis précisez la localisation en déplaçant l\'icône.',
                    en: 'Location is not precise enough. Please use the + zoom and drag the icon marker to confirm the precise location.'
                }
            },
            ...inaccessibleZoneGeographyCustomValidation(geography, undefined, interview, path)
        ];
    },
    conditional: customConditionals.hasWorkingLocationNotSetCustomConditional
};

export const personUsualSchoolPlaceGeography: WidgetConfig.InputMapFindPlaceType = {
    type: 'question',
    inputType: 'mapFindPlace',
    path: 'household.persons.{_activePersonId}.usualSchoolPlace.geography',
    datatype: 'geojson',
    containsHtml: true,
    height: '32rem',
    refreshGeocodingLabel: (t: TFunction) => t('customLabel:RefreshGeocodingLabel'),
    geocodingQueryString: function (interview, path) {
        return formatGeocodingQueryStringFromMultipleFields([getResponse(interview, path, null, '../name')]);
    },
    label: (t: TFunction, interview, path) => {
        const activePerson = odSurveyHelpers.getPerson({ interview, path });
        const countPersons = odSurveyHelpers.countPersons({ interview });
        const nickname = activePerson?.nickname || t('survey:noNickname');
        return t('travelBehavior:personUsualSchoolPlaceGeography', {
            nickname,
            count: countPersons
        });
    },
    icon: {
        url: getActivityMarkerIcon('schoolUsual'),
        size: [70, 70]
    },
    placesIcon: {
        url: (interview, path) => '/dist/icons/interface/markers/marker_round_with_small_circle.svg',
        size: [35, 35]
    },
    selectedIcon: {
        url: (interview, path) => '/dist/icons/interface/markers/marker_round_with_small_circle_selected.svg',
        size: [35, 35]
    },
    defaultCenter: function (interview, path) {
        const homeCoordinates: any = getResponse(interview, 'home.geography.geometry.coordinates', null);
        return homeCoordinates
            ? {
                lat: homeCoordinates[1],
                lon: homeCoordinates[0]
            }
            : config.mapDefaultCenter;
    },
    defaultValue: function (interview, path) {
        return undefined;
    },
    resetToDefaultUnlessUserInteracted: true,
    validations: function (value, _customValue, interview, path, _customPath) {
        const geography: any = getResponse(interview, path, null, '../geography');
        return [
            {
                validation: _isBlank(value),
                errorMessage: (t: TFunction) => t('survey:visitedPlace:locationIsRequiredError')
            },
            {
                validation:
                    geography &&
                    geography.properties.lastAction &&
                    (geography.properties.lastAction === 'mapClicked' ||
                        geography.properties.lastAction === 'markerDragged') &&
                    geography.properties.zoom < 15,
                errorMessage: {
                    fr: 'Le positionnement du lieu n\'est pas assez précis. Utilisez le zoom + pour vous rapprocher davantage, puis précisez la localisation en déplaçant l\'icône.',
                    en: 'Location is not precise enough. Please use the + zoom and drag the icon marker to confirm the precise location.'
                }
            },
            ...inaccessibleZoneGeographyCustomValidation(geography, undefined, interview, path)
        ];
    },
    conditional: conditionals.hasSchoolLocationNotSetConditional
};
