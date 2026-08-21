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
const email = 'two-persons-with-common-trips-freqBarriersEp@test.com';
const accessCode = '735-711-118';

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
// 2 identical elderly persons, with the same trips together all day, different
// purposes. This also tests the freqBarriers sample with 2 self respondents
// with no disabilities and eligible carDriver trips
const person1: commonUITestsHelpers.HouseholdMember = {
    personIndex: 0,
    nickname: 'Ginette',
    age: 80,
    gender: 'female',
    genderCustom: null,
    drivingLicenseOwnership: 'yes',
    carSharingMember: null,
    usedTransitInLast30Days: 'yes',
    transitPass: ['tickets'],
    transitFare: null,
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
    workerType: 'no',
    studentType: 'no',
    job: null,
    jobType: null,
    workPlaceType: null,
    workDays: null,
    travelToWorkDays: null,
    educationalAttainment: null,
    occupation: null,
    bikesharingUsage: null
};
const person2: commonUITestsHelpers.HouseholdMember = {
    personIndex: 1,
    nickname: 'Fleurette',
    age: 82,
    gender: 'female',
    genderCustom: null,
    drivingLicenseOwnership: 'yes',
    carSharingMember: null, // Not in a carsharing zone
    usedTransitInLast30Days: 'yes',
    transitPass: ['transitPassARTMWithElderly'],
    transitFare: 'AB',
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
    workerType: 'no',
    studentType: 'no',
    job: null,
    jobType: null,
    workPlaceType: null,
    workDays: null,
    travelToWorkDays: null,
    educationalAttainment: null,
    occupation: null,
    bikesharingUsage: null
};

// P1 goes to the market, then to the museum and back to a restaurant near the market, then go home
const visitedPlacesP1: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'shopping',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show
        shortcut: null, // Question won't show.
        name: 'Marché Jean-Talon',
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: 7 * 60 * 60, // 7:00 AM
        arrivalTime: 7 * 60 * 60 + 30 * 60, // 7:30 AM
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 9 * 60 * 60 // 9:00 AM
    },
    {
        activityCategory: 'leisure',
        activity: 'leisureArtsMusicCulture',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show, still no place to show
        shortcut: null, // Question won't show.
        name: 'Musée des beaux-arts de Montréal',
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 10 * 60 * 60, // 10:00
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 12 * 60 * 60 // 12:00
    },
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'restaurant',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: false,
        shortcut: null,
        name: 'Mon ami BBQ coréen Jean-Talon',
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 13 * 60 * 60, // 13:00
        nextPlaceCategory: 'wentBackHome',
        departureTime: 14 * 60 * 60 // 14:00
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
        arrivalTime: 15 * 60 * 60, // 15:20
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
        vehicleOccupancy: 4,
        hasNextMode: false,
        commonTrip: ['${otherPerson[0]}'] // Set the commonTrip to the other person
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'transitHeavy',
        mode: 'transitRRT',
        subwayStationStart: 'jeanTalon',
        subwayStationEnd: 'guyConcordia',
        hasNextMode: false,
        commonTrip: ['${otherPerson[0]}'] // Set the commonTrip to the other person
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'transitHeavy',
        mode: 'transitLRRT',
        remStationStart: 'mcgill',
        remStationEnd: 'edouardMontpetit',
        hasNextMode: true
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'transitHeavy',
        mode: 'transitRRT',
        subwayStationStart: 'edouardMontpetit',
        subwayStationEnd: 'castelnau',
        hasNextMode: false,
        commonTrip: ['${otherPerson[0]}'] // Set the commonTrip to the other person
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'carPassenger',
        mode: null, // Question won't show
        driver: '${otherPerson[0]}', // Set the driver of the carPassenger mode to be the other person
        hasNextMode: false,
        commonTrip: ['${otherPerson[0]}'] // Set the commonTrip to the other person
    }
];

// Person2's data: using thortcuts from person1's visited places
const visitedPlacesP2: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'shopping',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: true,
        // Set the shortcut to one of the places from p1
        shortcut: '${tripDiary[0]}.visitedPlaces.${tripDiary[0].visitedPlaces[1]}',
        name: null, // Question won't show
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: 7 * 60 * 60, // 7:00 AM
        arrivalTime: 7 * 60 * 60 + 30 * 60, // 7:30 AM
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 9 * 60 * 60 // 9:00 AM
    },
    {
        activityCategory: 'leisure',
        activity: 'leisureArtsMusicCulture',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: true,
        // Set the shortcut to one of the places from p1
        shortcut: '${tripDiary[0]}.visitedPlaces.${tripDiary[0].visitedPlaces[2]}',
        name: null, // Question won't show
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 10 * 60 * 60, // 10:00
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 12 * 60 * 60 // 12:00
    },
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'restaurant',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: true,
        // Set the shortcut to one of the places from p1
        shortcut: '${tripDiary[0]}.visitedPlaces.${tripDiary[0].visitedPlaces[3]}',
        name: null, // Question won't show
        previousWorkPlaceName: null,
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 13 * 60 * 60, // 13:00
        nextPlaceCategory: 'wentBackHome',
        departureTime: 14 * 60 * 60 // 14:00
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
        arrivalTime: 15 * 60 * 60, // 15:20
        nextPlaceCategory: 'stayedThereUntilTheNextDay',
        departureTime: null // Question won't show.
    }
];

// Define the segments for this test scenario
// FIXME We should be able to also check the correct values, now we only know the fields are present
const segmentsP2: commonUITestsHelpers.Segment[] = [
    {
        // This segment should be prefilled from the other person, changing to carPassenger
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: undefined,
        mode: null,
        driver: undefined, // The driver of the carPassenger mode should be the other person
        hasNextMode: false,
        commonTrip: null
    },
    {
        // This segment should be prefilled from the other person
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: undefined,
        mode: undefined,
        subwayStationStart: undefined,
        subwayStationEnd: undefined,
        hasNextMode: false,
        commonTrip: null
    },
    {
        // Third trip has many segments, they should be filled again
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'transitHeavy',
        mode: 'transitLRRT',
        remStationStart: 'mcgill',
        remStationEnd: 'edouardMontpetit',
        hasNextMode: true
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'transitHeavy',
        mode: 'transitRRT',
        subwayStationStart: 'edouardMontpetit',
        subwayStationEnd: 'castelnau',
        hasNextMode: false,
        commonTrip: null
    },
    {
        // This segment should be prefilled from the other person, changing to carDriver
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: undefined,
        mode: undefined,
        vehicleOccupancy: 4,
        hasNextMode: false,
        commonTrip: null
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
        householdCarSharing: 'no',
        householdBikesharing: 'no',
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
    expectedNextSection: 'selectFreqPerson'
});

/********** Need to select the current person responding ********/
commonUITestsHelpers.fillSelectFreqPerson({
    context,
    householdSize: 2,
    selectedPerson: '${tripDiary[0].personId}'
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
barriers.barriersTripText = 'Home to Marché Jean-Talon at 7:00';
commonUITestsHelpers.fillBarriersSectionTests({
    context,
    householdSize: 1,
    barriersSection: barriers
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
        burdenQuestionsVisible: false
    }
});

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 2 });
