import { TFunction } from 'i18next';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import * as defaultInputBase from 'evolution-frontend/lib/components/inputs/defaultInputBase';
import * as WidgetConfig from 'evolution-common/lib/services/questionnaire/types';
import { getActivityMarkerIcon } from 'evolution-common/lib/services/questionnaire/sections/visitedPlaces/activityIconMapping';
import * as surveyHelperNew from 'evolution-common/lib/utils/helpers';
import { defaultConditional } from 'evolution-common/lib/services/widgets/conditionals/defaultConditional';
import * as validations from 'evolution-common/lib/services/widgets/validations/validations';
import * as customValidations from '../../common/customValidations';
import { defaultInvalidGeocodingResultTypes } from '../../common/customGeoData';
import * as conditionals from '../../common/conditionals';
import { getResponse } from 'evolution-common/lib/utils/helpers';

export const homeGeography: WidgetConfig.InputMapFindPlaceType = {
    ...defaultInputBase.inputMapFindPlaceBase,
    path: 'home.geography',
    label: (t: TFunction, _interview, _path) => {
        return t('home:homeGeography');
    },
    icon: {
        url: getActivityMarkerIcon('home'),
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
    geocodingQueryString: (interview) => {
        // TODO: Add country and region to the geocoding query string
        const city = surveyHelperNew.getResponse(interview, 'home.city', null);
        const address = surveyHelperNew.getResponse(interview, 'home.address', null);
        const postalCode = surveyHelperNew.getResponse(interview, 'home.postalCode', null);

        // Fields to use for geocoding
        const fieldsAddress = [];
        // Postal code is optional
        if (postalCode !== null) {
            fieldsAddress.push(postalCode);
        }
        fieldsAddress.push(city, address);

        return [{ queryString: surveyHelperNew.formatGeocodingQueryStringFromMultipleFields(fieldsAddress), zoom: 16 }];
    },
    defaultCenter: config.mapDefaultCenter,
    defaultZoom: config.mapDefaultZoom,
    invalidGeocodingResultTypes: defaultInvalidGeocodingResultTypes,
    validations: (value, _customValue, interview, path) =>
        customValidations.getGeographyCustomValidation({
            value,
            interview,
            path
        })
    // conditional: conditionals.homeGeographyConditional
};

// Note: This is a custom widget, because we need to use a Math.min() function.
export const householdElectricBicycleNumber: WidgetConfig.InputRadioNumberType = {
    ...defaultInputBase.inputRadioNumberBase,
    path: 'household.electricBicycleNumber',
    twoColumns: false,
    containsHtml: true,
    label: (t: TFunction) => t('home:householdElectricBicycleNumber'),
    valueRange: {
        min: 0,
        max: (interview) => Math.min(4, Number(getResponse(interview, 'household.bicycleNumber', 0)))
    },
    overMaxAllowed: true,
    conditional: conditionals.hasHouseholdBicycleConditional,
    validations: customValidations.electricBicycleNumberCustomValidation
};
