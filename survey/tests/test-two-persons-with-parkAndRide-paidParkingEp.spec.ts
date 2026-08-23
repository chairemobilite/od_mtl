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
const email = 'two-persons-with-parkAndRide@test.com';
const accessCode = '735-711-121';

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
// 2 identical persons, so selected order does not matter: full time worker,
// with driving license, with ABC transit pass, on location work at hospital,
// one night shift, one day shift
const person1: commonUITestsHelpers.HouseholdMember = {
    personIndex: 0,
    nickname: 'Martha',
    age: 30,
    gender: 'female',
    genderCustom: null,
    drivingLicenseOwnership: 'yes',
    carSharingMember: null, // not asked in RA
    usedTransitInLast30Days: 'yes',
    transitPass: ['transitPassARTM'],
    transitFare: 'ABC',
    transitFareWarning: null,
    hasDisability: null,
    disabilities: null,
    disabilitiesSpecify: null,
    mobilityAssistiveDevices: null,
    mobilityAssistiveDevicesSpecify: null,
    mostUsedMobilityAssistiveDevice: null,
    useParatransit: null,
    useParatransitFrequency: null,
    useParatransitTransitFrequency: null,
    workerType: 'fullTime',
    studentType: 'no',
    job: 'médecin',
    workPlaceType: 'onLocation',
    workDays: null,
    travelToWorkDays: '5',
    educationalAttainment: 'bachelorOrHigher',
    occupation: null, // Question won't show.
    bikesharingUsage: null // not asked in RA
};
const person2: commonUITestsHelpers.HouseholdMember = {
    personIndex: 1,
    nickname: 'Angela',
    age: 30,
    gender: 'female',
    genderCustom: null,
    drivingLicenseOwnership: 'yes',
    carSharingMember: null, // not asked in RA
    usedTransitInLast30Days: 'yes',
    transitPass: ['transitPassARTM'],
    transitFare: 'ABC',
    transitFareWarning: null,
    hasDisability: null,
    disabilities: null,
    disabilitiesSpecify: null,
    mobilityAssistiveDevices: null,
    mobilityAssistiveDevicesSpecify: null,
    mostUsedMobilityAssistiveDevice: null,
    useParatransit: null,
    useParatransitFrequency: null,
    useParatransitTransitFrequency: null,
    workerType: 'fullTime',
    studentType: 'no',
    job: 'infirmière',
    workPlaceType: 'onLocation',
    workDays: null,
    travelToWorkDays: '5',
    educationalAttainment: 'postSecondaryBelowBachelorEducation',
    occupation: null, // Question won't show.
    bikesharingUsage: null // not asked in RA
};

// P1 goes to work at the hospital then home again
const visitedPlacesP1: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'work',
        activity: 'workUsual',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'Hôpital Cité de la Santé, Laval',
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: 6 * 60 * 60, // 6:00 AM
        arrivalTime: 7 * 60 * 60 + 15 * 60, // 7:15 AM
        nextPlaceCategory: 'wentBackHome',
        departureTime: 17 * 60 * 60 // 17:00
    },
    {
        activityCategory: undefined, // Question already has 'home' set
        activity: null, // Question won't show.
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: null, // Question won't show.
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 18 * 60 * 60, // 18 * 60 * 60
        nextPlaceCategory: 'stayedThereUntilTheNextDay',
        departureTime: null // Question won't show.
    }
];

// Define the segments for this test scenario
const segmentsP1: commonUITestsHelpers.Segment[] = [
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'carDriver',
        mode: 'carDriver',
        paidForParking: 'noWorker',
        hasNextMode: true
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'bus',
        mode: 'transitBus',
        busLines: ['exo_514_sainte-anne-des-plaines---laval'],
        junctionPrivateBus: 'bois-des-filion',
        transitEgressMode: 'walk',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'bus',
        mode: 'transitBus',
        busLines: ['exo_514_sainte-anne-des-plaines---laval'],
        hasNextMode: true
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'carDriver',
        mode: 'carDriver',
        junctionBusPrivate: null, // Mirror trip, should not be asked
        hasNextMode: false
    }
];

// Person2's visited places, starts the day at the hospital for a night shift and comes back home
const visitedPlacesP2: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'work',
        activity: 'workUsual',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'Hôpital Cité de la Santé, Laval',
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null,
        arrivalTime: null,
        nextPlaceCategory: 'wentBackHome',
        departureTime: 7 * 60 * 60 + 30 * 60 // 7:30
    },
    {
        activityCategory: undefined, // Question already has 'home' set
        activity: null, // Question won't show.
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: null, // Question won't show.
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 9 * 60 * 60, // 9:00
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 22 * 60 * 60 // 22:00
    },
    {
        activityCategory: 'work',
        activity: 'workUsual',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'Hôpital Cité de la Santé, Laval',
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null,
        arrivalTime: 24 * 60 * 60, // 24:00
        nextPlaceCategory: 'stayedThereUntilTheNextDay',
        departureTime: null
    }
];

// Define the segments for this test scenario
const segmentsP2: commonUITestsHelpers.Segment[] = [
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'bus',
        mode: 'transitBus',
        busLines: ['exo_514_sainte-anne-des-plaines---laval'],
        hasNextMode: true
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'carDriver',
        mode: 'carDriver',
        junctionBusPrivate: 'bois-des-filion',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'carDriver',
        mode: 'carDriver',
        paidForParking: 'noWorker',
        hasNextMode: true
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'bus',
        mode: 'transitBus',
        busLines: ['exo_514_sainte-anne-des-plaines---laval'],
        junctionPrivateBus: null, // Mirror trip, should not be asked
        transitEgressMode: null, // It is a mirror trip, so we don't know closest location...
        hasNextMode: false
    }
];

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
        householdCarSharing: null, // Home in RA > 6
        householdBikesharing: null, // Home in RA > 6
        householdAtLeastOnePersonWithDisability: 'no'
    }
});

/********** Tests household section **********/
commonUITestsHelpers.fillHouseholdSectionWithMembersTests({ context, householdMembers: [person1, person2] });

/********** Tests selectPerson section **********/
// Skipped in normal workflow

/********** Tests tripsIntro section for first person **********/
commonUITestsHelpers.fillTripsintroSectionTests({
    context,
    householdSize: 2,
    hasTrips: true,
    expectPopup: true,
    expectedNextSection: 'visitedPlaces'
});

/********** Tests visited places section for person 1 **********/
commonUITestsHelpers.fillVisitedPlacesSectionTests({
    context,
    householdSize: 2,
    visitedPlaces: visitedPlacesP1,
    journeyStartsAtHome: true
});

/********** Tests segments section, then go to next person's trips **********/
commonUITestsHelpers.fillSegmentsSectionTests({
    context,
    householdSize: 2,
    segments: segmentsP1,
    expectedNextSection: 'tripsIntro'
});

/********** Tests tripsIntro section for second person **********/
commonUITestsHelpers.fillTripsintroSectionTests({
    context,
    householdSize: 2,
    hasTrips: true,
    departurePlaceIsHome: 'no',
    departurePlaceOther: 'workedOvernight',
    expectPopup: true,
    expectedNextSection: 'visitedPlaces'
});

/********** Tests visited places section for person 1 **********/
commonUITestsHelpers.fillVisitedPlacesSectionTests({
    context,
    householdSize: 2,
    visitedPlaces: visitedPlacesP2,
    journeyStartsAtHome: false
});

/********** Tests segments section, then go to next person's trips **********/
commonUITestsHelpers.fillSegmentsSectionTests({
    context,
    householdSize: 2,
    segments: segmentsP2,
    expectedNextSection: 'end'
});

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
