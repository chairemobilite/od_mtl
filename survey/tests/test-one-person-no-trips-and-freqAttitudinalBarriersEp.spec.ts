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
const postalCode = 'J6A 8G4';
const accessCode = '7357-1119';

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
commonUITestsHelpers.fillHomeSectionTests({ context });

/********** Tests household section **********/
commonUITestsHelpers.fillHouseholdSectionTests({ context, householdSize: 1 });

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

/********** Tests frequency section **********/
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
