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
const postalCode = 'G5A 1E7';
const accessCode = '7357-1114';

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
        householdCarSharing: 'yes',
        householdBikesharing: 'yes',
        householdAtLeastOnePersonWithDisability: 'yes'
    }
});

/********** Tests household section **********/
// Add transit data for both persons to test the conditional visibilities of transit-related questions
// Person1 has transit pass outside tariff zone
const person1: commonUITestsHelpers.HouseholdMember = {
    ...commonUITestsHelpers.defaultPerson1,
    usedTransitInLast30Days: 'yes',
    transitPass: ['transitPassARTM'],
    transitFare: 'ABC',
    transitFareWarning: []
};
// person 2 has tickets only, with disabilities with some questions left unanswered
const person2: commonUITestsHelpers.HouseholdMember = {
    ...commonUITestsHelpers.defaultPerson2,
    usedTransitInLast30Days: 'yes',
    transitPass: ['tickets'],
    transitFare: null,
    transitFareWarning: null,
    hasDisability: 'yes',
    disabilities: ['hearing', 'cognitiveOrPsychic'],
    disabilitiesSpecify: null,
    mobilityAssistiveDevices: undefined,
    mobilityAssistiveDevicesSpecify: null,
    mostUsedMobilityAssistiveDevice: null,
    useParatransit: 'yes',
    useParatransitFrequency: undefined,
    useParatransitTransitFrequency: undefined // Question won't show, need special ep
};
commonUITestsHelpers.fillHouseholdSectionWithMembersTests({ context, householdMembers: [person1, person2] });

/********** Tests selectPerson section **********/
// Skipped in normal workflow

/********** Tests tripsIntro section for first person **********/
commonUITestsHelpers.fillTripsintroSectionTests({
    context,
    householdSize: 2,
    hasTrips: false,
    expectPopup: true,
    expectedNextSection: 'travelBehavior'
});

/********** Tests travelBehavior section for first person **********/
// Clone the default values to avoid modifying the default object, but keep defaults for other fields
const travelBehaviorP1 = _cloneDeep(commonUITestsHelpers.defaultTravelBehaviorWhenNoTrip);
commonUITestsHelpers.fillTravelBehaviorSectionTests({
    context,
    householdSize: 2,
    nextSection: 'tripsIntro',
    travelBehavior: travelBehaviorP1
});

/********** Tests tripsIntro section for second person **********/
commonUITestsHelpers.fillTripsintroSectionTests({
    context,
    householdSize: 2,
    hasTrips: false,
    expectPopup: true,
    expectedNextSection: 'travelBehavior'
});

/********** Tests travelBehavior section for second person **********/
// Define travel behavior data
const travelBehaviorP2 = _cloneDeep(commonUITestsHelpers.defaultTravelBehaviorWhenNoTrip);
travelBehaviorP2.noWorkTripReason = 'other';
travelBehaviorP2.usualWorkPlace = {
    name: 'Hôtel de ville de Brossard'
};
commonUITestsHelpers.fillTravelBehaviorSectionTests({
    context,
    householdSize: 2,
    nextSection: 'end',
    travelBehavior: travelBehaviorP2
});

/********** Tests end section **********/
const endSection = {
    ...commonUITestsHelpers.defaultEnd,
    householdType: 'oneFamilyOnly',
    householdTypeSpecify: 'coupleWithoutChild'
};
commonUITestsHelpers.fillEndSectionTests({ context, householdSize: 2, endSection });

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 2 });
