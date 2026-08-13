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
const accessCode = '735-711-117';

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
// 2 identical persons, so selected order does not matter: full time worker, with driving license, no transit pass, on location work.
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
    hasDisability: 'yes',
    disabilities: ['hearing', 'cognitiveOrPsychic'],
    disabilitiesSpecify: null,
    mobilityAssistiveDevices: undefined,
    mobilityAssistiveDevicesSpecify: null,
    mostUsedMobilityAssistiveDevice: null,
    useParatransit: 'yes',
    useParatransitFrequency: '1to4daysPerWeek',
    useParatransitTransitFrequency: '1to3daysPerMonth', // Question won't show, need special ep
    workerType: 'fullTime',
    studentType: 'no',
    job: 'préposée marketing',
    jobType: 'administration',
    workPlaceType: 'onLocation',
    workDays: null,
    travelToWorkDays: '4',
    educationalAttainment: 'bachelorOrHigher',
    occupation: null, // Question won't show.
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
    hasDisability: 'yes',
    disabilities: ['hearing', 'cognitiveOrPsychic'],
    disabilitiesSpecify: null,
    mobilityAssistiveDevices: undefined,
    mobilityAssistiveDevicesSpecify: null,
    mostUsedMobilityAssistiveDevice: null,
    useParatransit: 'no',
    useParatransitFrequency: null,
    useParatransitTransitFrequency: null, // Question won't show, need special ep
    workerType: 'fullTime',
    studentType: 'no',
    job: 'col blanc',
    jobType: 'administration',
    workPlaceType: 'hybrid',
    workDays: '4',
    travelToWorkDays: '3',
    educationalAttainment: 'secondaryEducationOrLess',
    occupation: null, // Question won't show.
    bikesharingUsage: 'no'
};

// P1 goes to work, then stops at the SAQ and goes to a restaurant to wait for P2. Then both go back home together later
const visitedPlacesP1: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'work',
        activity: 'workUsual',
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
        mode: 'paratransit',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'bus',
        mode: 'paratransit',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'carDriver',
        mode: 'carDriver',
        vehicleOccupancy: 1,
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

// Person2's data:
// P1 goes to work, then stops at the SAQ and goes to a restaurant to wait for P2. Then both go back home together later
const visitedPlacesP2: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'work',
        activity: 'workUsual',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'Sports Experts Atwater',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: 10 * 60 * 60, // 10:00 AM
        arrivalTime: 10 * 60 * 60 + 30 * 60, // 10:30 AM
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 18 * 60 * 60 // 18:00
    },
    // Using shortcut to get the place from the first person's visited place
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'restaurant',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: true,
        // Set the shortcut to one of the places from p1
        shortcut: '${tripDiary[0]}.visitedPlaces.${tripDiary[0].visitedPlaces[3]}',
        name: null, // Question won't show
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 18 * 60 * 60 + 30 * 60, // 18:30
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
const segmentsP2: commonUITestsHelpers.Segment[] = [
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'other',
        mode: 'mobilityScooter',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'other',
        mode: 'taxi',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'carPassenger',
        mode: null, // Question won't show
        driver: '${tripDiary[0].personId}', // Set the driver of the carPassenger mode to be the first person
        hasNextMode: false
    }
];

/********** Start the survey **********/
// Start the survey using the email provided
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
    expectPopup: true,
    expectedNextSection: 'visitedPlaces'
});

/********** Tests visited places section for person 2 **********/
commonUITestsHelpers.fillVisitedPlacesSectionTests({
    context,
    householdSize: 2,
    visitedPlaces: visitedPlacesP2,
    journeyStartsAtHome: true
});

/********** Tests segments section, then go to long distance section **********/
commonUITestsHelpers.fillSegmentsSectionTests({
    context,
    householdSize: 2,
    segments: segmentsP2,
    expectedNextSection: 'barriersDisability'
});

/********** Tests barrier disability section **********/
// The 2 persons are self-respondent, so there should be validation on the person
commonUITestsHelpers.fillBarriersDisabilitySectionTests({
    context,
    householdSize: 2,
    barriersDisabilitySection: {
        ...commonUITestsHelpers.defaultBarriersDisabilities,
        barriersDisabilityPersonCheck: 'yes',
        barriersDisabilityTripText:
            'Trip for motive Work (out-of-home fixed location): Home to McCord Steward Museum at 9:00'
    }
});

// Go to the next section by clicking the next button, should be the end section
// as there is no trips for barriers
testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/end' });

/********** Tests end section **********/
commonUITestsHelpers.fillEndSectionTests({
    context,
    householdSize: 2,
    endSection: {
        ...commonUITestsHelpers.defaultEnd,
        householdType: 'noFamily',
        burdenQuestionsVisible: false
    }
});

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 2 });
