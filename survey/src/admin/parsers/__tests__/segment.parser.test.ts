/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';

import { parseSegmentAttributes } from '../segment.parser';
import { ExtendedSegmentAttributes } from 'evolution-common/lib/services/baseObjects/Segment';
import { CorrectedResponse } from 'evolution-common/lib/services/questionnaire/types';

describe('parseSegmentAttributes', () => {
    const correctedResponse: CorrectedResponse = { _assignedDay: '2025-01-15' };

    const parse = (answers: { [key: string]: unknown }): ExtendedSegmentAttributes =>
        parseSegmentAttributes(
            { _uuid: 'test-segment-uuid', mode: 'carDriver', ...answers } as ExtendedSegmentAttributes,
            correctedResponse
        );

    test.each([
        ['free or paid by the employer', 'noWorker', { status: 'answered', value: false }],
        ['free', 'no', { status: 'answered', value: false }],
        ['paid', 'yes', { status: 'answered', value: true }],
        ['the vehicle was not parked', 'noPark', { status: 'not_applicable' }],
        ['not known', 'dontKnow', { status: 'dont_know' }]
    ])('should convert the parking choice for %s', (_description, choice, expected) => {
        const result = parse({ paidForParking: choice });

        expect(result.paidForParking).toEqual(expected);
        // The choice itself says more than the boolean, so it is kept
        expect(result.parkingType).toBe(choice);
    });

    test.each([
        ['no parking answer', undefined],
        ['an answer already wrapped', { status: 'refusal' }]
    ])('should leave %s as it is', (_description, paidForParking) => {
        const result = parse({ paidForParking });

        expect(result.paidForParking).toEqual(paidForParking);
        expect(result.parkingType).toBeUndefined();
    });

    const householdMemberUuid = uuidV4();

    test.each([
        ['a member of the household', householdMemberUuid, 'householdMember', householdMemberUuid],
        ['a colleague', 'colleague', 'colleague', undefined],
        ['a carpool driver', 'carpool', 'carpool', undefined],
        ['a paratransit driver', 'paratransit', 'paratransit', undefined],
        ['no driver answer', undefined, undefined, undefined]
    ])('should read the driver answer for %s', (_description, driver, expectedType, expectedUuid) => {
        const result = parse({ driver });

        expect(result.driverType).toEqual(expectedType);
        expect(result.driverUuid).toEqual(expectedUuid);
    });
});
