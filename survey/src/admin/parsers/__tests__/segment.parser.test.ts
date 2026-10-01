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

    it('should keep an unrecognized parking choice on paidForParking', () => {
        const result = parse({ paidForParking: 'streetMeter' });

        expect(result.paidForParking).toBe('streetMeter');
        expect(result.parkingType).toBe('streetMeter');
    });

    const householdMemberUuid = uuidV4();

    test.each([
        ['a member of the household', householdMemberUuid, 'householdMember', householdMemberUuid],
        ['a family member', 'familyMember', 'familyMember', undefined],
        ['a colleague', 'colleague', 'colleague', undefined],
        ['a taxi driver', 'taxiDriver', 'taxiDriver', undefined],
        ['a transit taxi driver', 'transitTaxiDriver', 'transitTaxiDriver', undefined],
        ['a paratransit driver', 'paratransit', 'paratransit', undefined],
        ['a carpool driver', 'carpool', 'carpool', undefined],
        ['another driver', 'other', 'other', undefined],
        ['an unknown driver', 'dontKnow', 'dontKnow', undefined],
        ['no driver answer', undefined, undefined, undefined]
    ])('should read the driver answer for %s', (_description, driver, expectedType, expectedUuid) => {
        const result = parse({ driver });

        expect(result.driverType).toEqual(expectedType);
        expect(result.driverUuid).toEqual(expectedUuid);
    });

    it('should leave an unsupported driver choice unmapped', () => {
        const result = parse({ driver: 'neighbor' });

        expect(result.driverType).toBeUndefined();
        expect(result.driverUuid).toBeUndefined();
        expect(result.driver).toBe('neighbor');
    });

    test.each([
        [
            'metro without a transfer',
            {
                mode: 'transitRRT',
                subwayStationStart: 'edouardMontpetit',
                subwayStationEnd: 'longueuilUniversiteDeSherbrooke'
            },
            ['edouardMontpetit', 'longueuilUniversiteDeSherbrooke']
        ],
        [
            'metro with no transfer recorded as none',
            {
                mode: 'transitRRT',
                subwayStationStart: 'placeDArmes',
                subwayStationEnd: 'jeanTalon',
                subwayStationsTransfer: 'none'
            },
            ['placeDArmes', 'jeanTalon']
        ],
        [
            'metro with one transfer',
            {
                mode: 'transitRRT',
                subwayStationStart: 'beaubien',
                subwayStationEnd: 'cadillac',
                subwayStationsTransfer: 'berriUqam'
            },
            ['beaubien', 'berriUqam', 'cadillac']
        ],
        [
            'metro with two transfers',
            {
                mode: 'transitRRT',
                subwayStationStart: 'edouardMontpetit',
                subwayStationEnd: 'longueuilUniversiteDeSherbrooke',
                subwayStationsTransfer: 'snowdon&berriUqam'
            },
            ['edouardMontpetit', 'snowdon', 'berriUqam', 'longueuilUniversiteDeSherbrooke']
        ],
        [
            'metro with an other entry station',
            {
                mode: 'transitRRT',
                subwayStationStart: 'other',
                subwayStationEnd: 'sherbrooke'
            },
            ['other', 'sherbrooke']
        ],
        [
            'REM',
            {
                mode: 'transitLRRT',
                remStationStart: 'panama',
                remStationEnd: 'mcgill'
            },
            ['panama', 'mcgill']
        ],
        [
            'train',
            {
                mode: 'transitRegionalRail',
                trainStationStart: 'centrale',
                trainStationEnd: 'dorval'
            },
            ['centrale', 'dorval']
        ],
        [
            'metro with only the entry station',
            { mode: 'transitRRT', subwayStationStart: 'montRoyal' },
            ['montRoyal']
        ]
    ])('should convert the stations for %s', (_description, answers, expected) => {
        const result = parse(answers);

        expect(result.stations).toEqual(expected);
    });

    it('should leave an already parsed stations array as it is', () => {
        const stations = ['guyConcordia', 'berriUqam', 'montmorency'];
        const result = parse({
            mode: 'transitRRT',
            subwayStationStart: 'guyConcordia',
            subwayStationEnd: 'montmorency',
            stations
        });

        expect(result.stations).toEqual(stations);
    });

    it('should ignore leftover subway stations when the mode is not transit', () => {
        const result = parse({
            mode: 'carDriver',
            subwayStationStart: 'jeanTalon',
            subwayStationEnd: 'guyConcordia'
        });

        expect(result.stations).toBeUndefined();
    });
});
