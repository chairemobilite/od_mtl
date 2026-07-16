/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { parseHouseholdAttributes } from '../household.parser';
import { CorrectedResponse } from 'evolution-common/lib/services/questionnaire/types';
import { ExtendedHouseholdAttributes } from 'evolution-common/lib/services/baseObjects/Household';

const correctedResponse = { uuid: 'test' } as CorrectedResponse;

describe('parseHouseholdAttributes', () => {
    describe('twoWheelNumber conversion', () => {
        test.each([
            ['3', 3],
            [3, 3],
            ['5+', 5] // topped-up value: the '+' is stripped and the value is parsed as a number
        ])('should convert twoWheelNumber from %s to %s', (input, expected) => {
            const householdAttributes = { twoWheelNumber: input } as unknown as ExtendedHouseholdAttributes;

            const result = parseHouseholdAttributes(householdAttributes, correctedResponse);

            expect(result.twoWheelNumber).toEqual(expected);
        });

        it('should handle undefined twoWheelNumber', () => {
            const householdAttributes: ExtendedHouseholdAttributes = {};

            const result = parseHouseholdAttributes(householdAttributes, correctedResponse);

            expect(result.twoWheelNumber).toBeUndefined();
        });
    });

    describe('bicycleNumber conversion', () => {
        test.each([
            ['2', 2],
            [2, 2],
            ['10+', 10] // topped-up value: the '+' is stripped and the value is parsed as a number
        ])('should convert bicycleNumber from %s to %s', (input, expected) => {
            const householdAttributes = { bicycleNumber: input } as unknown as ExtendedHouseholdAttributes;

            const result = parseHouseholdAttributes(householdAttributes, correctedResponse);

            expect(result.bicycleNumber).toEqual(expected);
        });

        it('should handle undefined bicycleNumber', () => {
            const householdAttributes: ExtendedHouseholdAttributes = {};

            const result = parseHouseholdAttributes(householdAttributes, correctedResponse);

            expect(result.bicycleNumber).toBeUndefined();
        });
    });

    describe('error handling', () => {
        test.each([
            ['null', null],
            ['undefined', undefined],
            ['string', 'string'],
            ['number', 123],
            ['boolean', true]
        ])('should handle %s householdAttributes gracefully', (_description, householdAttributes) => {
            expect(() => parseHouseholdAttributes(householdAttributes as any, correctedResponse)).not.toThrow();
        });
    });

    describe('comprehensive parsing', () => {
        it('should convert both twoWheelNumber and bicycleNumber simultaneously', () => {
            const householdAttributes = {
                twoWheelNumber: '3+',
                bicycleNumber: '2',
                size: 4,
                carNumber: 1
            } as unknown as ExtendedHouseholdAttributes;

            const result = parseHouseholdAttributes(householdAttributes, correctedResponse);

            expect(result.twoWheelNumber).toEqual(3);
            expect(result.bicycleNumber).toEqual(2);

            // Should preserve other attributes
            expect(result.size).toBe(4);
            expect(result.carNumber).toBe(1);
        });

        it('should preserve other attributes when parsing', () => {
            const householdAttributes = {
                twoWheelNumber: '1',
                someOtherField: 'preserved'
            } as unknown as ExtendedHouseholdAttributes;

            const result = parseHouseholdAttributes(householdAttributes, correctedResponse);

            expect(result.twoWheelNumber).toEqual(1);
            expect((result as any).someOtherField).toBe('preserved');
        });

        it('should ignore the unused correctedResponse parameter', () => {
            const householdAttributes = { bicycleNumber: '4' } as unknown as ExtendedHouseholdAttributes;
            const otherCorrectedResponse: CorrectedResponse = { _language: 'fr' };

            const result = parseHouseholdAttributes(householdAttributes, otherCorrectedResponse);

            expect(result.bicycleNumber).toEqual(4);
        });
    });

    describe('immutability', () => {
        it('should not modify the original householdAttributes object', () => {
            const originalHouseholdAttributes = {
                twoWheelNumber: '2+',
                bicycleNumber: '3',
                size: 2
            } as unknown as ExtendedHouseholdAttributes;
            const originalCopy = JSON.parse(JSON.stringify(originalHouseholdAttributes));

            const result = parseHouseholdAttributes(originalHouseholdAttributes, correctedResponse);

            expect(originalHouseholdAttributes).toEqual(originalCopy);
            expect(result).not.toEqual(originalHouseholdAttributes);
        });
    });

    describe('idempotency', () => {
        it('should leave already-converted numeric values unchanged on repeated parsing', () => {
            const householdAttributes = {
                twoWheelNumber: '2',
                bicycleNumber: '3'
            } as unknown as ExtendedHouseholdAttributes;

            const result1 = parseHouseholdAttributes(householdAttributes, correctedResponse);
            expect(result1.twoWheelNumber).toEqual(2);
            expect(result1.bicycleNumber).toEqual(3);

            const result2 = parseHouseholdAttributes(result1, correctedResponse);
            expect(result2.twoWheelNumber).toEqual(2);
            expect(result2.bicycleNumber).toEqual(3);
        });
    });
});
