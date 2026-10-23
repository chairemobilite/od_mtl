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

// Survey credentials
const email = 'two-persons-with-disabilities@test.com';
const accessCode = '735-712-117';

// Configure the tests to run in serial mode (one after the other)
test.describe.configure({ mode: 'serial' });

// Initialize the test page and add it to the context
test.beforeAll(async ({ browser }) => {
    context.page = await testHelpers.initializeTestPage(browser, context.objectDetector);
    commonUITestsHelpers.assignWeekDayToInterview({ page: context.page });
});

test.afterAll(async () => {
    // Delete the participant after the test
    await commonUITestsHelpers.deleteParticipantInterview(email);
});

/********** Test data **********/
// 2 identical persons, so selected order does not matter: unemployed, with driving license, no transit pass, on location work.
const person1: commonUITestsHelpers.HouseholdMember = {
    personIndex: 0,
    nickname: 'Martha',
    age: 30,
    gender: 'female',
    genderCustom: null,
    drivingLicenseOwnership: 'yes',
    carSharingMember: 'yes',
    usedTransitInLast30Days: 'no',
    transitPass: null,
    transitFare: null,
    transitFareWarning: null,
    hasDisability: 'no',
    disabilities: null,
    disabilitiesSpecify: null,
    mobilityAssistiveDevices: null,
    mobilityAssistiveDevicesSpecify: null,
    mostUsedMobilityAssistiveDevice: null,
    useParatransit: null,
    useParatransitFrequency: null,
    useParatransitTransitFrequency: null, // Question won't show, need special ep
    workerType: 'no',
    studentType: 'no',
    occupation: 'unemployed',
    job: null,
    workPlaceType: null,
    workDays: null,
    travelToWorkDays: null,
    educationalAttainment: 'bachelorOrHigher',
    occupationSpecify: null, // Question won't show.
    bikesharingUsage: 'no'
};
const person2: commonUITestsHelpers.HouseholdMember = {
    personIndex: 1,
    nickname: 'Angela',
    age: 30,
    gender: 'female',
    genderCustom: null,
    drivingLicenseOwnership: 'yes',
    carSharingMember: 'yes',
    usedTransitInLast30Days: 'no',
    transitPass: null,
    transitFare: null,
    transitFareWarning: null,
    hasDisability: 'no',
    disabilities: null,
    disabilitiesSpecify: null,
    mobilityAssistiveDevices: null,
    mobilityAssistiveDevicesSpecify: null,
    mostUsedMobilityAssistiveDevice: null,
    useParatransit: null,
    useParatransitFrequency: null,
    useParatransitTransitFrequency: null, // Question won't show, need special ep
    workerType: 'no',
    studentType: 'no',
    occupation: 'unemployed',
    job: null,
    workPlaceType: null,
    workDays: null,
    travelToWorkDays: null,
    educationalAttainment: 'bachelorOrHigher',
    occupationSpecify: null, //
    bikesharingUsage: 'no'
};

// P1 goes to volunteering, then stops at the SAQ and goes to a restaurant and goes back home
const visitedPlacesP1: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'work',
        activity: 'volunteering',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'McCord Steward Museum',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: 32400, // 9:00 AM
        arrivalTime: 34200, // 9:30 AM
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 16 * 60 * 60 // 16:00
    },
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'shopping',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show, still no place to show
        shortcut: null, // Question won't show.
        name: 'SAQ Beaubien',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 16 * 60 * 60 + 30 * 60, // 16:30
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 17 * 60 * 60 // 17:00
    },
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'restaurant',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: false,
        shortcut: null, // Question won't show.
        name: 'Tabac Villeray',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 17 * 60 * 60 + 30 * 60, // 17:30
        nextPlaceCategory: 'wentBackHome',
        departureTime: 22 * 60 * 60 // 22:00
    },
    {
        activityCategory: undefined, // Question already has 'home' set
        activity: null, // Question won't show.
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: null, // Question won't show.
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 22 * 60 * 60 + 20 * 60, // 22:20
        nextPlaceCategory: 'stayedThereUntilTheNextDay',
        departureTime: null // Question won't show.
    }
];

// Define the segments for this test scenario
const segmentsP1: commonUITestsHelpers.Segment[] = [
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'bus',
        mode: 'transitTaxi',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'bus',
        mode: 'transitTaxi',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'carDriver',
        mode: 'carDriver',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'carDriver',
        mode: 'carDriver',
        hasNextMode: false
    }
];

// P2 has no trips

/********** Start the survey **********/
// Start the survey using the email provided
surveyTestHelpers.startAndLoginWithEmail({
    context,
    title: 'Perspectives mobilité 2026',
    email,
    nextPageUrl: 'survey/accessCode'
});

/********** Tests access code section **********/
commonUITestsHelpers.fillAccessCodeSectionTests({
    context,
    accessCode: { accessCode, accessCodeIsCorrect: null }
});

/********** Tests home section **********/
commonUITestsHelpers.fillHomeSectionTests({
    context,
    home: {
        ...commonUITestsHelpers.defaultHome,
        householdSize: 2,
        householdCarSharing: 'yes',
        householdBikesharing: 'yes',
        householdAtLeastOnePersonWithDisability: 'yes'
    }
});

/********** Tests household section **********/
commonUITestsHelpers.fillHouseholdSectionWithMembersTests({ context, householdMembers: [person1, person2] });

/********** Tests selectPerson section **********/
// Skipped in normal workflow

/********** Tests tripsIntro section for first person **********/
commonUITestsHelpers.fillTripsintroSectionTestsNoNextClick({
    context,
    householdSize: 2,
    hasTrips: true,
    expectPopup: true
});

// Click on the button to select the other person
testHelpers.inputNextButtonTest({ context, text: 'Change person', nextPageUrl: '/survey/selectPerson' });

commonUITestsHelpers.fillSelectPersonSectionTests({ context, householdSize: 2, selectedPerson: '${otherPerson[0]}' });

/********** Tests tripsIntro section for second person **********/
// Should go back to the tripsIntro of the first person, incomplete
// FIXME We go from a trips's intro section to another one. It may not be obvious to the participant that the interviewed person chagned
commonUITestsHelpers.fillTripsintroSectionTests({
    context,
    householdSize: 2,
    hasTrips: false,
    expectPopup: false,
    expectedNextSection: 'tripsIntro'
});

// The section should be completed, so we go to the next section, which should be visited places
testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/visitedPlaces' });

/********** Tests visited places section for person 1 **********/
commonUITestsHelpers.fillVisitedPlacesSectionTestsNoNextClick({
    context,
    householdSize: 2,
    visitedPlaces: visitedPlacesP1,
    journeyStartsAtHome: true
});

// Again, click on the button to select the other person
testHelpers.inputNextButtonTest({ context, text: 'Change person', nextPageUrl: '/survey/selectPerson' });

// Select the other person
commonUITestsHelpers.fillSelectPersonSectionTests({ context, householdSize: 2, selectedPerson: '${otherPerson[0]}' });

// Trips intro section should be completed, we go to the next section, which should be back at the tripIntro of the first person again, the incomplete one
// FIXME We go from a trips's intro section to another one. It may not be obvious to the participant that the interviewed person chagned
testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/tripsIntro' });

// The section should be completed, so we go to the next section, which should be visited places
testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/visitedPlaces' });

// The visited places section is completed, so we go to the next, which should be segments
testHelpers.inputNextButtonTest({
    context,
    text: 'Confirm locations and continue',
    nextPageUrl: '/survey/segments'
});

/********** Tests segments section, then go to next person's trips **********/
// Fill the segments section for p1, that should return to the selectPerson section
commonUITestsHelpers.fillSegmentsSectionTests({
    context,
    householdSize: 2,
    segments: segmentsP1,
    expectedNextSection: 'selectPerson'
});

// Second person is complete, so we just click next
commonUITestsHelpers.fillSelectPersonSectionTests({ context, householdSize: 2, selectedPerson: null });

// Trips intro section should be completed, we go to the next section, which should be back at the selectPerson, because person 1 is not finished yet
testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/end' });

/********** Tests end section **********/
commonUITestsHelpers.fillEndSectionTests({
    context,
    householdSize: 2,
    endSection: {
        ...commonUITestsHelpers.defaultEnd,
        burdenQuestionsVisible: false
    }
});

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 2 });
