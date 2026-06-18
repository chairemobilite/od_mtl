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
const accessCode = '7357-3116';

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
        householdSize: 3,
        householdCarSharing: 'yes',
        householdBikesharing: 'yes',
        householdAtLeastOnePersonWithDisability: 'no'
    }
});

/********** Tests household section **********/
// A parent and 2 children
const parent = {
    ...commonUITestsHelpers.defaultPerson1,
    nickname: 'Serge',
    hasDisability: null
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
    hasDisability: null,
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
const child2 = {
    personIndex: 0,
    nickname: 'Olivia',
    age: 2,
    gender: null,
    genderCustom: null,
    drivingLicenseOwnership: null,
    carSharingMember: null,
    usedTransitInLast30Days: null,
    transitPass: null,
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
commonUITestsHelpers.fillHouseholdSectionWithMembersTests({ context, householdMembers: [parent, child1, child2] });

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
    nextSection: 'omissions',
    travelBehavior
});

/********** Tests omissions section **********/
const omissions = _cloneDeep(commonUITestsHelpers.defaultOmissionsSection);
// Filling the most fields as possible, to cover all the conditional checks.
omissions.toddlerDaycare = 'yes';
omissions.toddlerDaycareDropoff = ['yes', 'no']; // FIXME: This should be filled with the actual values.
omissions.toddlerDaycareDropoffMode = 'walk';
omissions.toddlerDaycarePickup = ['yes', 'no']; // FIXME: This should be filled with the actual values.
omissions.toddlerDaycarePickupMode = 'walk';
// Omission block is not shown for this case
omissions.hasOmittedTrips = null;
omissions.hasOmittedTripsIntro = null;
omissions.hasOmittedTripsActivity = null;
omissions.hasOmittedTripsMode = null;
commonUITestsHelpers.fillOmissionsSectionTests({
    context,
    householdSize: 1,
    omissions,
    nextSection: 'end'
});

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
