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
// household, should go directly to end section after travel behavior.
const email = 'one-person-no-trips-noUsualLocation@test.com';
const accessCode = '7357-1125';

// Configure the tests to run in serial mode (one after the other)
test.describe.configure({ mode: 'serial' });

// Initialize the test page and add it to the context
test.beforeAll(async ({ browser }) => {
    context.page = await testHelpers.initializeTestPage(browser, context.objectDetector);
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
const person = _cloneDeep(commonUITestsHelpers.defaultPerson1);
// Person does not have a fixed work place. Also, ra is 8, so a few questions are not asked
person.workPlaceType = 'remote';
person.workDays = null;
person.travelToWorkDays = null;
person.carSharingMember = null;
person.bikesharingUsage = null;
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
// No work trip reason as it is remote, and the person has no school place
travelBehavior.noWorkTripReason = null;
travelBehavior.usualWorkPlace = null;
travelBehavior.usualWorkPlaceCommuting = null;
travelBehavior.hasSchoolPlace = 'no';
travelBehavior.usualSchoolPlace = null;
travelBehavior.noSchoolTripReason = null;
commonUITestsHelpers.fillTravelBehaviorSectionTests({
    context,
    householdSize: 1,
    nextSection: 'end',
    travelBehavior
});

/********** Tests end section **********/
commonUITestsHelpers.fillEndSectionTests({ context, householdSize: 1 });

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 1 });

// Logout and log back in with same credentials, shoud log in directly
testHelpers.logoutTest({ context });
