// eslint-disable-next-line n/no-extraneous-import
import { test } from '@playwright/test';
import _cloneDeep from 'lodash/cloneDeep';
import * as testHelpers from 'evolution-frontend/tests/ui-testing/testHelpers';
import * as surveyTestHelpers from 'evolution-frontend/tests/ui-testing/surveyTestHelpers';
import { SurveyObjectDetector } from 'evolution-frontend/tests/ui-testing/SurveyObjectDetectors';
import * as commonUITestsHelpers from './common-UI-tests-helpers';
import { downtownSimpleChainsPlusComplexChain, femaleHybridWorker } from './test-case-data';

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
    commonUITestsHelpers.assignWeekDayToInterview({ page: context.page });
});

test.afterAll(async () => {
    // Delete the participant after the test
    await commonUITestsHelpers.deleteParticipantInterview(email);
});

/********** Start the survey **********/
// Start the survey using the email provided
const email = 'one-person-with-trips-accessEgressMode@test.com';
const accessCode = '735-711-122';
surveyTestHelpers.startAndLoginWithEmail({
    context,
    title: 'Perspectives mobilité 2026',
    email,
    nextPageUrl: 'survey/accessCode'
});

// Many come and go between home and work, with various combinations of modes to test access/egress modes questions
const visitedPlaces: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'work',
        activity: 'workUsual',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'Polytechnique Montréal',
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: 7 * 60 * 60, // 7:00 AM
        arrivalTime: 8 * 60 * 60, // 8:00 AM
        nextPlaceCategory: 'wentBackHome',
        departureTime: 9 * 60 * 60 // 9:00 AM
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
        arrivalTime: 10 * 60 * 60, // 10:00
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 11 * 60 * 60
    },
    {
        activityCategory: 'work',
        activity: 'workUsual',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'Polytechnique Montréal',
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null,
        arrivalTime: 12 * 60 * 60, // 8:00 AM
        nextPlaceCategory: 'wentBackHome',
        departureTime: 13 * 60 * 60 // 9:00 AM
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
        arrivalTime: 14 * 60 * 60, // 10:00
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 15 * 60 * 60
    },
    {
        activityCategory: 'work',
        activity: 'workUsual',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'Polytechnique Montréal',
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null,
        arrivalTime: 16 * 60 * 60, // 8:00 AM
        nextPlaceCategory: 'wentBackHome',
        departureTime: 17 * 60 * 60 // 9:00 AM
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
        arrivalTime: 18 * 60 * 60, // 10:00
        nextPlaceCategory: 'stayedThereUntilTheNextDay',
        departureTime: null
    }
];

// Define the segments for this test scenario
const segments: commonUITestsHelpers.Segment[] = [
    {
        // First trip, carDriver, no expected access/egress
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'carDriver',
        mode: 'carDriver',
        hasNextMode: false
    },
    {
        // Second trip, metro only to Longueil, no expected access/egress as distances are too low
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        sameModeAsReverseTrip: false,
        modePre: 'transitHeavy',
        mode: 'transitRRT',
        subwayStationStart: 'edouardMontpetit',
        subwayStationEnd: 'longueuilUniversiteDeSherbrooke',
        subwayStationsTransfer: 'snowdon&berriUqam',
        hasNextMode: false
    },
    {
        // Third trip, REM, forgot bus access, comes out downtown, for an undeclared walk
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'transitHeavy',
        mode: 'transitLRRT',
        remStationStart: 'panama',
        remStationEnd: 'mcgill',
        transitAccessMode: 'carPassenger',
        hasNextMode: false,
        transitEgressMode: 'walk'
    },
    {
        // Fourth trip, cycle to downtown, then take the REM, then take the bus home, no access/egress should be asked
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'bicycle',
        mode: 'bicycle',
        hasNextMode: true,
        transitEgressMode: 'walk'
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'transitHeavy',
        mode: 'transitLRRT',
        remStationStart: 'mcgill',
        remStationEnd: 'panama',
        hasNextMode: true
    },
    {
        // FIXME Should be 'transitBus' here, instead of 'transitTaix' but does not work because of https://github.com/chairemobilite/evolution/issues/1860
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 2,
        modePre: 'bus',
        mode: 'transitTaxi',
        hasNextMode: false
    },
    {
        // Fifth trip has 'other' as first access and egress stations. Access and egress modes should not be asked
        // FIXME Currently, they are asked because of this issue in Evolution: https://github.com/chairemobilite/evolution/issues/1862
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'transitHeavy',
        mode: 'transitRRT',
        subwayStationStart: 'other',
        subwayStationEnd: 'sherbrooke',
        transitAccessMode: 'other',
        hasNextMode: true
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'transitHeavy',
        mode: 'transitRRT',
        subwayStationStart: 'montRoyal',
        subwayStationEnd: 'other',
        transitEgressMode: 'carPassenger',
        hasNextMode: false
    },
    {
        // Sixth trip by REM, then undeclared walk, then metro
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'transitHeavy',
        mode: 'transitLRRT',
        remStationStart: 'edouardMontpetit',
        remStationEnd: 'gareCentrale',
        hasNextMode: true
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'transitHeavy',
        mode: 'transitRRT',
        subwayStationStart: 'montRoyal',
        subwayStationEnd: 'longueuilUniversiteDeSherbrooke',
        transitAccessMode: 'walk',
        hasNextMode: false
    }
];

/********** Tests access code section **********/
commonUITestsHelpers.fillAccessCodeSectionTests({
    context,
    accessCode: { accessCode, accessCodeIsCorrect: null }
});

/********** Tests home section **********/
commonUITestsHelpers.fillHomeSectionTests({ context });

/********** Tests household section **********/
const hhMembers = [femaleHybridWorker];
commonUITestsHelpers.fillHouseholdSectionWithMembersTests({ context, householdMembers: hhMembers });

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
    visitedPlaces: visitedPlaces,
    journeyStartsAtHome: true
});

/********** Tests segments section **********/
commonUITestsHelpers.fillSegmentsSectionTests({
    context,
    householdSize: 1,
    segments,
    expectedNextSection: 'omissions'
});

/********** Tests omissions section **********/
const omissions = _cloneDeep(commonUITestsHelpers.defaultOmissionsSection);
// The toddler daycare should not be present as there is no child in the household
omissions.toddlerDaycare = null;
commonUITestsHelpers.fillOmissionsSectionTests({
    context,
    householdSize: 1,
    omissions,
    nextSection: 'end'
});

/********** Tests end section **********/
commonUITestsHelpers.fillEndSectionTests({
    context,
    householdSize: 1,
    endSection: commonUITestsHelpers.defaultEnd
});

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 1 });
