// eslint-disable-next-line n/no-extraneous-import
import { test } from '@playwright/test';
import _cloneDeep from 'lodash/cloneDeep';
import * as testHelpers from 'evolution-frontend/tests/ui-testing/testHelpers';
import * as surveyTestHelpers from 'evolution-frontend/tests/ui-testing/surveyTestHelpers';
import { SurveyObjectDetector } from 'evolution-frontend/tests/ui-testing/SurveyObjectDetectors';
import * as commonUITestsHelpers from './common-UI-tests-helpers';
import { downtownSimpleChainsPlusComplexChain, femaleHybridWorker } from './test-case-data';

// Test case for sameMode ep, with transit trips that should be copied from
// previous and complex chains also.

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
    // FIXME This part should be added in the initializeTestPage function,
    // direcly in Evolution. Here for now to avoid having to update Evolution
    // again just yet.
    context.page.on('response', async (response: any) => {
        try {
            if (!response.url().includes('survey/updateInterview')) {
                return;
            }
            const text = await response.text();
            if (!text) {
                return;
            }
            const parsed = JSON.parse(text);
            const valuesByPath = parsed && parsed['updatedValuesByPath'];
            if (valuesByPath !== undefined && Object.keys(valuesByPath).length > 0) {
                context.objectDetector.detectSurveyObjects(valuesByPath);
            }
        } catch (err) {
            // ignore parse errors or other response read issues
            console.log('got error', err);
        }
    });
});

test.afterAll(async () => {
    // Delete the participant after the test
    await commonUITestsHelpers.deleteParticipantInterview(email);
});

/********** Start the survey **********/
// Start the survey using the email provided
const email = 'one-person-with-transit-trips-sameModeTrue@test.com';
const accessCode = '735-711-312';
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
    visitedPlaces: downtownSimpleChainsPlusComplexChain,
    journeyStartsAtHome: true
});

/********** Tests segments section **********/
// Métro entre domicile et marché jean-talon, sameMode pour le retour
// Métro et REM entre domicile et université, sameMode pour le retour
// FIXME Ajout du métro quand multiples segments seront supportés pour un trip
// Marche dans la soirée au centre-ville, sameMode pour les 2 autres segments
const segments: commonUITestsHelpers.Segment[] = [
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'transit',
        mode: 'transitRRT',
        subwayStationStart: 'placeDArmes',
        subwayStationEnd: 'jeanTalon',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        sameModeAsReverseTrip: true,
        modePre: null,
        mode: null,
        subwayStationStart: 'jeanTalon',
        subwayStationEnd: 'squareVictoriaOaci',
        hasNextMode: null
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'transit',
        mode: 'transitRRT',
        subwayStationStart: 'placeDArmes',
        subwayStationEnd: 'bonaventure',
        hasNextMode: true
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        modePre: 'transit',
        mode: 'transitLRRT',
        remStationStart: 'gareCentrale',
        remStationEnd: 'edouardMontpetit',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        sameModeAsReverseTrip: true,
        modePre: 'transit',
        mode: 'transitLRRT',
        remStationStart: 'edouardMontpetit',
        remStationEnd: 'gareCentrale',
        hasNextMode: null
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 1,
        expectedPrefilled: true,
        sameModeAsReverseTrip: null,
        modePre: 'transit',
        mode: 'transitRRT',
        subwayStationStart: 'bonaventure',
        subwayStationEnd: 'placeDArmes',
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        modePre: 'walk',
        mode: null,
        hasNextMode: false
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        sameModeAsReverseTrip: true,
        modePre: null,
        mode: null,
        hasNextMode: null
    },
    {
        ...commonUITestsHelpers.defaultSegmentNullValues,
        segmentIndex: 0,
        sameModeAsReverseTrip: true,
        modePre: null,
        mode: null,
        hasNextMode: null
    }
];
commonUITestsHelpers.fillSegmentsSectionTests({
    context,
    householdSize: 1,
    segments,
    expectedNextSection: 'longDistance'
});

/********** Tests longDistance section **********/
// With long distance trips
const longDistance: commonUITestsHelpers.LongDistanceSection = {
    madeLongDistanceTrips: 'yes',
    frequencySeptemberDecember: '00_00',
    frequencyJanuaryApril: '01_03',
    frequencyMayAugust: '04_12',
    wantToParticipateInSurvey: 'yes',
    wantToParticipateInSurveyEmail: 'test@test.org'
};
commonUITestsHelpers.fillLongDistanceSectionTests({ context, householdSize: 1, longDistanceSection: longDistance });

/********** Tests end section **********/
commonUITestsHelpers.fillEndSectionTests({
    context,
    householdSize: 1,
    endSection: {
        ...commonUITestsHelpers.defaultEnd,
        burdenQuestionsVisible: true
    }
});

/********** Tests completed section **********/
commonUITestsHelpers.fillCompletedSectionTests({ context, householdSize: 1 });
