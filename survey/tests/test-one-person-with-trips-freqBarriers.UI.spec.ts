// eslint-disable-next-line n/no-extraneous-import
import { test } from '@playwright/test';
import _cloneDeep from 'lodash/cloneDeep';
import * as testHelpers from 'evolution-frontend/tests/ui-testing/testHelpers';
import * as surveyTestHelpers from 'evolution-frontend/tests/ui-testing/surveyTestHelpers';
import { SurveyObjectDetector } from 'evolution-frontend/tests/ui-testing/SurveyObjectDetectors';
import * as commonUITestsHelpers from './common-UI-tests-helpers';

const context = {
    page: null as any,
    objectDetector: new SurveyObjectDetector(),
    title: '',
    widgetTestCounters: {}
};

// Configure the tests to run in serial mode (one after the other)
test.describe.configure({ mode: 'serial' });

// Initialize the test page and add it to the context
test.beforeAll(async ({ browser }) => {
    context.page = await testHelpers.initializeTestPage(browser, context.objectDetector);
});

test.afterAll(async () => {
    // Delete the participant after the test
    await commonUITestsHelpers.deleteParticipantInterview(email);
});

// Define the visited places for this test scenario
const visitedPlaces: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'shopping',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: 'Sports Experts Atwater',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: 32400, // 9:00 AM
        arrivalTime: 34200, // 9:30 AM
        nextPlaceCategory: 'wentBackHome',
        departureTime: 39600 // 11:00 AM
    },
    {
        activityCategory: 'home',
        activity: null, // Question won't show.
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: null, // Question won't show.
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 41400, // 11:30 AM
        nextPlaceCategory: 'stayedThereUntilTheNextDay',
        departureTime: null // Question won't show.
    }
];

// Define the segments for this test scenario, second trip should be selected for barriers
const segments: commonUITestsHelpers.Segment[] = [
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'taxi',
        mode: 'taxi',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'carDriver',
        mode: 'carDriver',
        vehicleOccupancy: 2,
        hasNextMode: false
    }
];

/********** Start the survey **********/
// The survey should still start a new interview with these credentials.
const email = 'one-person-with-trips-freqBarriers@test.com';
const accessCode = '7357-1120';
surveyTestHelpers.startAndLoginWithEmail({
    context,
    title: 'Perspectives Mobilité 2026',
    email,
    nextPageUrl: 'survey/accessCode'
});

/********** Tests access code section **********/
commonUITestsHelpers.fillAccessCodeSectionTests({
    context,
    accessCode: { accessCode, accessCodeIsCorrect: null }
});

/********** Tests home section **********/
commonUITestsHelpers.fillHomeSectionTests({ context });

/********** Tests household section **********/
// Home est dans région d'analyse 7, quelques questions ne sont pas posées
const person = {
    ...commonUITestsHelpers.defaultPerson1,
    carSharingMember: null,
    bikesharingUsage: null,
    bikesharingMembership: null
};
commonUITestsHelpers.fillHouseholdSectionWithMembersTests({ context, householdMembers: [person] });

/********** Tests tripsIntro section **********/
commonUITestsHelpers.fillTripsintroSectionTests({
    context,
    householdSize: 1,
    hasTrips: true,
    expectPopup: false,
    expectedNextSection: 'visitedPlaces'
});

/********** Tests visited places section **********/
commonUITestsHelpers.fillVisitedPlacesSectionTests({
    context,
    householdSize: 1,
    visitedPlaces,
    journeyStartsAtHome: true
});

/********** Tests segments section **********/
commonUITestsHelpers.fillSegmentsSectionTests({
    context,
    householdSize: 1,
    segments,
    expectedNextSection: 'travelBehavior'
});

/********** Tests travelBehavior section **********/
const travelBehavior = _cloneDeep(commonUITestsHelpers.defaultTravelBehaviorWhenNoTrip);
commonUITestsHelpers.fillTravelBehaviorSectionTests({
    context,
    householdSize: 1,
    nextSection: 'frequencies',
    travelBehavior
});

/********** Tests frequency section **********/
const frequencies = _cloneDeep(commonUITestsHelpers.defaultFrequencies);
// The car driver should be present, test all values for each section
frequencies.anyTripModeFrequenciesCarDriver = 'neverOrRarely';
frequencies.anyTripModeFrequenciesBicycle = '1to3daysPerMonth';
frequencies.anyTripModeFrequenciesCarPassenger = '1dayPerWeek';
frequencies.anyTripModeFrequenciesTransit = '2to4daysPerWeek';
frequencies.anyTripModeFrequenciesWalk = '5DaysOrMorePerWeek';
commonUITestsHelpers.fillFrequenciesSectionTests({
    context,
    householdSize: 1,
    frequencySection: frequencies
});

// Go to the next section by clicking the next button, should be the barrier one
testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/barriers' });

/********** Tests barriers section **********/
// There is a trip with carDriver that should be used for barrier questions
// TODO Validate the trip's data
const barriers = _cloneDeep(commonUITestsHelpers.defaultBarriers);
barriers.barriersTripText = 'Sports Experts Atwater to Home at 11:00';
commonUITestsHelpers.fillBarriersSectionTests({
    context,
    householdSize: 1,
    barriersSection: barriers
});

// Go to the next section by clicking the next button, should be the end section
// as there is no trips for barriers
testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/end' });
/********** Tests end section **********/
commonUITestsHelpers.fillEndSectionTests({ context, householdSize: 1 });

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 1 });
