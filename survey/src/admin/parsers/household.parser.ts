/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { SurveyObjectParser } from 'evolution-backend/lib/services/audits/types';
import { CorrectedResponse } from 'evolution-common/lib/services/questionnaire/types';
import { ExtendedHouseholdAttributes } from 'evolution-common/lib/services/baseObjects/Household';
import _cloneDeep from 'lodash/cloneDeep';

/**
 * @param originalCorrectedHouseholdAttributes - The household attributes to parse
 * @param _correctedResponse - The corrected response (unused)
 */
export const parseHouseholdAttributes: SurveyObjectParser<ExtendedHouseholdAttributes, CorrectedResponse> = (
    originalCorrectedHouseholdAttributes: Readonly<ExtendedHouseholdAttributes>,
    _correctedResponse?: Readonly<CorrectedResponse>
): ExtendedHouseholdAttributes => {
    const householdAttributes = _cloneDeep(originalCorrectedHouseholdAttributes) as ExtendedHouseholdAttributes;

    if (!householdAttributes || typeof householdAttributes !== 'object') {
        return householdAttributes;
    }

    // Convert twoWheelNumber to a number
    // BE CAREFUL: The max shown in the questionnaire, with the plus implies it could be more than the entered value.
    // YOU NEED TO EXPLAIN THIS IN THE FINAL GUIDE so analysis understands that the value is topped up!
    if (householdAttributes.twoWheelNumber !== undefined && householdAttributes.twoWheelNumber !== null) {
        const rawTwoWheelNumber = String(householdAttributes.twoWheelNumber);
        householdAttributes.twoWheelNumber = parseInt(
            rawTwoWheelNumber.endsWith('+') ? rawTwoWheelNumber.slice(0, -1) : rawTwoWheelNumber
        );
    }

    // Convert bicycleNumber to a number
    // BE CAREFUL: The max shown in the questionnaire, with the plus implies it could be more than the entered value.
    // YOU NEED TO EXPLAIN THIS IN THE FINAL GUIDE so analysis understands that the value is topped up!
    if (householdAttributes.bicycleNumber !== undefined && householdAttributes.bicycleNumber !== null) {
        const rawBicycleNumber = String(householdAttributes.bicycleNumber);
        householdAttributes.bicycleNumber = parseInt(
            rawBicycleNumber.endsWith('+') ? rawBicycleNumber.slice(0, -1) : rawBicycleNumber
        );
    }

    return householdAttributes;
};
