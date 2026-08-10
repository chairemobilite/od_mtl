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
// household, should go to frequency section.
const email = 'one-person-no-trips-and-freqattitudinalbarriers@test.com';
const accessCode = '735-711-119';

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
    hasTrips: false,
    expectPopup: false,
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

// Go to the next section by clicking the next button
testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/attitudinal' });

/********** Tests attitudinal section **********/
const attitudinal = _cloneDeep(commonUITestsHelpers.defaultAttitudinal);
commonUITestsHelpers.fillAttitudinalSectionTests({
    context,
    householdSize: 1,
    attitudinalSection: attitudinal
});

// Go to the next section by clicking the next button, should be the end section
// as there is no trips for barriers
testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/end' });

/********** Tests end section **********/
commonUITestsHelpers.fillEndSectionTests({ context, householdSize: 1 });

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 1 });

// Logout and log back in with same credentials, shoud log in directly
testHelpers.logoutTest({ context });
