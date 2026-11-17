/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import _cloneDeep from 'lodash/cloneDeep';
import { TFunction } from 'i18next';
import { interviewAttributesForTestCases } from 'evolution-common/lib/tests/surveys';
import { personDidTripsCustomLabel } from '../customLabels';

// Mocked because it imports config that we don't need for these tests, only what is used to format dates
jest.mock('evolution-frontend/lib/config/i18n.config', () => ({ language: 'en', t: (key: string) => key }));

describe('personDidTripsCustomLabel', () => {
    const referencePersonId = 'personId1';
    const personDidTripsPaths = {
        personId1: 'household.persons.personId1.journeys.journeyId1.personDidTrips',
        personId2: 'household.persons.personId2.journeys.journeyId2.personDidTrips',
        personId3: 'household.persons.personId3.journeys.journeyId3.personDidTrips'
    };
    // Translations are mocked to return the translation key
    const mockedT = jest.fn((key: string) => key) as unknown as jest.MockedFunction<TFunction>;

    // Interview where the first person declared the second and third trips as
    // done with the second person, who is old enough for the common trip sample
    const getInterviewWithCommonTrips = ({
        isCommonTripSample,
        commonTripRefPersonId
    }: {
        isCommonTripSample: boolean;
        commonTripRefPersonId: string | undefined;
    }) => {
        const interview = _cloneDeep(interviewAttributesForTestCases);
        const response = interview.response as any;
        response.ep = { commonTrip: isCommonTripSample };
        response._commonTripRefPersonId = commonTripRefPersonId;
        response.household.persons.personId2.age = 70;
        const referenceTrips = response.household.persons[referencePersonId].journeys.journeyId1.trips;
        referenceTrips.tripId2P1.commonTripWith = ['personId2'];
        referenceTrips.tripId3P1.commonTripWith = ['personId2'];
        return interview;
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        {
            description: 'no reminder when the interview is not in the common trip sample',
            isCommonTripSample: false,
            commonTripRefPersonId: referencePersonId,
            path: personDidTripsPaths.personId2,
            expectedReminderText: ''
        },
        {
            description: 'no reminder when there is no reference person',
            isCommonTripSample: true,
            commonTripRefPersonId: undefined,
            path: personDidTripsPaths.personId2,
            expectedReminderText: ''
        },
        {
            description: 'no reminder for the reference person',
            isCommonTripSample: true,
            commonTripRefPersonId: referencePersonId,
            path: personDidTripsPaths.personId1,
            expectedReminderText: ''
        },
        {
            description: 'no reminder for a person without common trip',
            isCommonTripSample: true,
            commonTripRefPersonId: referencePersonId,
            path: personDidTripsPaths.personId3,
            expectedReminderText: ''
        },
        {
            description: 'reminder for a person with common trips',
            isCommonTripSample: true,
            commonTripRefPersonId: referencePersonId,
            path: personDidTripsPaths.personId2,
            expectedReminderText: 'visitedPlaces:reminderText'
        }
    ])('$description', ({ isCommonTripSample, commonTripRefPersonId, path, expectedReminderText }) => {
        const interview = getInterviewWithCommonTrips({ isCommonTripSample, commonTripRefPersonId });

        const label = (personDidTripsCustomLabel as any)(mockedT, interview, path);

        expect(label).toEqual('tripsIntro:personDidTrips');
        expect(mockedT).toHaveBeenLastCalledWith(
            'tripsIntro:personDidTrips',
            expect.objectContaining({ reminderText: expectedReminderText })
        );
    });

    test('reminder describes the first common trip of the reference person', () => {
        const interview = getInterviewWithCommonTrips({
            isCommonTripSample: true,
            commonTripRefPersonId: referencePersonId
        });

        (personDidTripsCustomLabel as any)(mockedT, interview, personDidTripsPaths.personId2);

        expect(mockedT).toHaveBeenCalledWith('visitedPlaces:reminderText', {
            otherNickname: 'survey:personWithSequenceAndAge',
            originDeparture: '9:00',
            destinationArrival: '9:10',
            origin: 'This is my work',
            destination: 'visitedPlaces:activities:home'
        });
    });
});
