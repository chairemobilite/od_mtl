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
const email = 'three-persons-with-out-of-territory@test.com';
const accessCode = '735-711-123';

// Configure the tests to run in serial mode (one after the other)
test.describe.configure({ mode: 'serial' });

// Initialize the test page and add it to the context
test.beforeAll(async ({ browser }) => {
    context.page = await testHelpers.initializeTestPage(browser, context.objectDetector);
    commonUITestsHelpers.assignWeekDayToInterview({ page: context.page });
    // Make sure to trap the person random sequence after the household section has
    // been entered. We want the sequence to be predictable so we can set the last
    // person as out of territory with the second one
    commonUITestsHelpers.forcePersonOrder({
        context,
        personsOrder: ['${personId[0]}', '${personId[2]}', '${personId[1]}']
    });
});

test.afterAll(async () => {
    // Delete the participant after the test
    await commonUITestsHelpers.deleteParticipantInterview(email);
});

/********** Test data **********/
// 3 identical persons, so selected order does not matter: full time worker,
// with driving license
// All started in a hotel for vacation, only the first person came back
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
    useParatransitTransitFrequency: null,
    workerType: 'fullTime',
    studentType: 'no',
    job: 'avocate',
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
    hasDisability: 'no',
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
    job: 'CEO',
    workPlaceType: 'hybrid',
    workDays: '4',
    travelToWorkDays: '3',
    educationalAttainment: 'secondaryEducationOrLess',
    occupation: null, // Question won't show.
    bikesharingUsage: 'no'
};
const person3: commonUITestsHelpers.HouseholdMember = {
    personIndex: 1,
    nickname: 'Bobby',
    age: 32,
    gender: 'male',
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
    useParatransitTransitFrequency: null,
    workerType: 'fullTime',
    studentType: 'no',
    job: 'garbage man',
    workPlaceType: 'onTheRoadWithUsualPlace',
    workDays: null,
    travelToWorkDays: '3',
    educationalAttainment: 'secondaryEducationOrLess',
    occupation: null, // Question won't show.
    bikesharingUsage: 'no'
};

// P1 goes to work, then stops at the SAQ and goes to a restaurant to wait for P2. Then both go back home together later
const visitedPlacesP1: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: undefined,
        activity: 'leisureTourism',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'Château Frontenac, Québec',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null,
        arrivalTime: null,
        nextPlaceCategory: 'wentBackHome',
        departureTime: 16 * 60 * 60 // 16:00
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
        arrivalTime: 20 * 60 * 60, // 20:00
        nextPlaceCategory: 'stayedThereUntilTheNextDay',
        departureTime: null // Question won't show.
    }
];

// Define the segments for this test scenario
const segmentsP1: commonUITestsHelpers.Segment[] = [
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'transitHeavy',
        mode: 'intercityTrain',
        intercityRailStationEnd: 'centralStation',
        intercityEgressMode: 'bicycle',
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
        householdSize: 3,
        householdCarSharing: 'yes',
        householdBikesharing: 'yes',
        householdAtLeastOnePersonWithDisability: 'yes'
    }
});

/********** Tests household section **********/

commonUITestsHelpers.fillHouseholdSectionWithMembersTests({ context, householdMembers: [person1, person2, person3] });

/********** Tests selectPerson section **********/
// Skipped in normal workflow

/********** Tests tripsIntro section for first person **********/
// activePersonId is undefined upon reload, we'll have to select it
// FIXME When the object detectors listens to activeInterview, this won't be necessary, as we can set it instead of undefined
//commonUITestsHelpers.fillSelectPersonSectionTests({ context, householdSize: 3 });
// Before filling the tripsIntro section, wait for the right person's page to be
// active, otherwise tests will use the wrong active person ID
testHelpers.waitTextVisible({ context, text: 'Martha’s interview' });
commonUITestsHelpers.fillTripsintroSectionTests({
    context,
    householdSize: 3,
    hasTrips: true,
    departurePlaceIsHome: 'no',
    departurePlaceOther: 'hotelForVacation',
    returnedHome: 'yes',
    expectPopup: true,
    expectedNextSection: 'visitedPlaces'
});

/********** Tests visited places section for person 1 **********/
commonUITestsHelpers.fillVisitedPlacesSectionTests({
    context,
    householdSize: 3,
    visitedPlaces: visitedPlacesP1,
    journeyStartsAtHome: false
});

/********** Tests segments section, then go to next person's trips **********/
commonUITestsHelpers.fillSegmentsSectionTests({
    context,
    householdSize: 2,
    segments: segmentsP1,
    expectedNextSection: 'travelBehavior'
});

/********** Tests travelBehavior section **********/
const travelBehavior = {
    noWorkTripReason: 'noWork',
    noWorkTripReasonSpecify: null,
    usualWorkPlace: { name: 'Polytechnique Montréal' },
    usualWorkPlaceCommuting: 'walk',
    hasSchoolPlace: null,
    usualSchoolPlace: null,
    noSchoolTripReason: null
};
commonUITestsHelpers.fillTravelBehaviorSectionTests({
    context,
    householdSize: 3,
    nextSection: 'travelBehavior',
    travelBehavior
});

/********** Tests tripsIntro section for second person **********/
// This person was out of territory all day and should thus have the trip diary skipped
commonUITestsHelpers.fillTripsintroSectionTests({
    context,
    householdSize: 3,
    hasTrips: true,
    departurePlaceIsHome: 'no',
    departurePlaceOther: 'hotelForVacation',
    returnedHome: 'no',
    outOfTerritoryMembers: ['${personId[1]}'],
    expectPopup: true,
    expectedNextSection: 'travelBehavior'
});

commonUITestsHelpers.fillTravelBehaviorSectionTests({
    context,
    householdSize: 3,
    nextSection: 'travelBehavior',
    travelBehavior
});

/********** Tests tripsIntro section for last person **********/
// This person was out of territory all day and should thus have the trip diary skipped
commonUITestsHelpers.fillTripsintroSectionTests({
    context,
    householdSize: 3,
    hasTrips: true,
    departurePlaceIsHome: 'no',
    departurePlaceOther: 'hotelForVacation',
    returnedHome: 'no',
    outOfTerritoryMembers: ['${personId[1]}'],
    expectPopup: true,
    expectedNextSection: 'travelBehavior'
});

commonUITestsHelpers.fillTravelBehaviorSectionTests({
    context,
    householdSize: 3,
    nextSection: 'end',
    travelBehavior
});

/********** Tests end section **********/
commonUITestsHelpers.fillEndSectionTests({
    context,
    householdSize: 3,
    endSection: {
        ...commonUITestsHelpers.defaultEnd,
        burdenQuestionsVisible: false
    }
});

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 2 });
