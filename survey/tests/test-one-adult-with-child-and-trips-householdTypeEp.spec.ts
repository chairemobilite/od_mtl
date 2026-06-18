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

// Survey credentials, no long distance section, no trips, one person in the
// household, should go to omissions section.
const postalCode = 'H3B 0A7';
const accessCode = '7357-2116';

// Configure the tests to run in serial mode (one after the other)
test.describe.configure({ mode: 'serial' });

// Initialize the test page and add it to the context
test.beforeAll(async ({ browser }) => {
    context.page = await testHelpers.initializeTestPage(browser, context.objectDetector);
});

test.afterAll(async () => {
    // Delete the participant after the test
    await commonUITestsHelpers.deleteParticipantInterview(accessCode);
});

// Define the visited places for this test scenario: dropped the child at a daycare, then went shopping, then home
const visitedPlaces: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'dropFetchSomeone',
        activity: 'dropSomeone',
        onTheRoadDepartureType: null, // Question won't show.
        onTheRoadArrivalType: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: 'Centre de la petite enfance de mon coeur',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: 32400, // 9:00 AM
        arrivalTime: 34200, // 9:30 AM
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 34500 // 9:35 AM
    },
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'shopping',
        onTheRoadDepartureType: null, // Question won't show.
        onTheRoadArrivalType: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: 'Sports Expert Atwater',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // 9:00 AM
        arrivalTime: 36000, // 10:00 AM
        nextPlaceCategory: 'wentBackHome',
        departureTime: 39600 // 11:00 AM
    },
    {
        activityCategory: 'home',
        activity: null, // Question won't show.
        onTheRoadDepartureType: null, // Question won't show.
        onTheRoadArrivalType: null, // Question won't show.
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

// Define the segments for this test scenario
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
        modePre: 'walk',
        mode: null,
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'bicycle',
        mode: 'bicycle',
        hasNextMode: false
    }
];

/********** Start the survey **********/
// Start the survey using an access code and postal code combination
surveyTestHelpers.startAndLoginWithAccessAndPostalCodes({
    context,
    title: 'Perspectives Mobilité 2026',
    accessCode,
    postalCode,
    expectedToExist: true,
    nextPageUrl: 'survey/home'
});

/********** Tests home section **********/
commonUITestsHelpers.fillHomeSectionTests({
    context,
    home: {
        ...commonUITestsHelpers.defaultHome,
        householdSize: 2,
        householdCarSharing: 'no',
        householdBikesharing: 'no',
        householdAtLeastOnePersonWithDisability: 'yes'
    }
});

/********** Tests household section **********/
// A non-working, non-student parent and a child
const parent = {
    ...commonUITestsHelpers.defaultPerson1,
    nickname: 'Bianca',
    carSharingMember: null, // Question won't show, set to no in home section
    workerType: 'no',
    studentType: 'no',
    jobType: null,
    workPlaceType: null,
    workDays: null,
    travelToWorkDays: null,
    educationalAttainment: null,
    occupation: 'longTermDisability',
    bikesharingUsage: null,
    bikesharingMembership: null
};
const child1 = {
    personIndex: 0,
    nickname: 'Oliver',
    age: 2,
    gender: null,
    genderCustom: null,
    drivingLicenseOwnership: null,
    carSharingMember: null,
    usedTransitInLast30Days: null,
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
    useParatransitTransitFrequency: null,
    workerType: null,
    studentType: null,
    jobType: null,
    workPlaceType: null,
    workDays: null,
    travelToWorkDays: null,
    educationalAttainment: null,
    occupation: null, // Question won't show.
    bikesharingUsage: null,
    bikesharingMembership: null
};
commonUITestsHelpers.fillHouseholdSectionWithMembersTests({ context, householdMembers: [parent, child1] });

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
    expectedNextSection: 'end'
});

/********** Tests omissions section **********/
// Omission section is skipped as there are trips for the daycare

/********** Tests end section **********/
const endSection = {
    ...commonUITestsHelpers.defaultEnd,
    householdType: 'oneFamilyOnly',
    householdTypeSpecify: 'parentWithChild'
};
commonUITestsHelpers.fillEndSectionTests({ context, householdSize: 2, endSection });

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 2 });

// Logout and log back in with same credentials, shoud log in directly
testHelpers.logoutTest({ context });
testHelpers.hasConsentTest({ context });
testHelpers.startSurveyTest({ context });
testHelpers.registerWithAccessPostalCodeTest({
    context,
    postalCode,
    accessCode,
    expectedToExist: true,
    nextPageUrl: 'survey/completed'
});

// FIXME Validate the survey re-entry
