/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import _cloneDeep from 'lodash/cloneDeep';
import { transitFareWarningCustomConditional } from '../customConditionals';
import { interviewAttributesForTestCases } from 'evolution-common/lib/tests/surveys';

// Mocked because it imports config that we don't need for these tests
jest.mock('evolution-frontend/lib/config/i18n.config', () => ({}));

describe('transitFareWarningCustomConditional', () => {

    const getHomeGeography = (coordinates: [number, number] | null) => {
        if (!coordinates) {
            return undefined;
        }
        return {
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates
            },
            properties: {
                lastAction: 'findPlace' as const
            }
        };
    };
	
    test.each([
        { 
            testCase: 'returns false when there is no valid home geography feature',
            homeGeography: undefined,
            transitFare: 'AB',
            expected: [false, null]
        },
        { 
            testCase: 'returns false when there is no transitFare',
            homeGeography: getHomeGeography([-73.5932, 45.5173]),
            transitFare: undefined,
            expected: [false, null]
        },
        { 
            testCase: 'returns false when transit fare has no matching zone',
            homeGeography: getHomeGeography([-73.5932, 45.5173]),
            transitFare: 'opusWithTicketsOnly',
            expected: [false, null]
        },
        { 
            testCase: 'returns false when transit fare A matches the home zone in A',
            homeGeography: getHomeGeography([-73.5932, 45.5173]),
            transitFare: 'A',
            expected: [false, null]
        },
        { 
            testCase: 'returns false when transit fare AB matches the home zone in B',
            homeGeography: getHomeGeography([-73.4317, 45.5161]),
            transitFare: 'AB',
            expected: [false, null]
        },
        { 
            testCase: 'returns false when transit fare ABC matches the home zone in C',
            homeGeography: getHomeGeography([-74.0680, 45.3670]),
            transitFare: 'ABC',
            expected: [false, null]
        },
        { 
            testCase: 'returns false when transit fare ABCD matches the home zone in D',
            homeGeography: getHomeGeography([-72.9982, 45.4017]),
            transitFare: 'ABCD',
            expected: [false, null]
        },
        { 
            testCase: 'returns false when transit fare bus matches the home zone in bus',
            homeGeography: getHomeGeography([-74.0680, 45.3670]),
            transitFare: 'bus',
            expected: [false, null]
        },
        { 
            testCase: 'returns false when transit fare busCD matches the home zone in busCD',
            homeGeography: getHomeGeography([-72.9982, 45.4017]),
            transitFare: 'busCD',
            expected: [false, null]
        },
        { 
            testCase: 'returns true for transit fare that extends home zone',
            homeGeography: getHomeGeography([-73.5932, 45.5173]),
            transitFare: 'busCD',
            expected: [true, null]
        }
    ])('$testCase', ({ homeGeography, transitFare, expected}) => {
		const testInterview = _cloneDeep(interviewAttributesForTestCases);
        testInterview.response.home!.geography = homeGeography;
        (testInterview.response.household!.persons!.personId1 as any).transitFare = transitFare;

		expect(transitFareWarningCustomConditional(testInterview, 'household.persons.personId1.transitFareWarning')).toEqual(expected);
	});

});