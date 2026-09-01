// eslint-disable-next-line n/no-extraneous-import
import { test, expect } from '@playwright/test';
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

// Survey credentials. This household's home is out of territory
const email = 'out-of-territory@test.com';
const accessCode = '735-711-126';

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
const homeValues = {
    ...commonUITestsHelpers.defaultHome,
    address: '221b Baker street',
    city: 'London',
    postalCode: 'H2V 4E6' // arbitrary postal code because the page expects one
};
commonUITestsHelpers.fillHomeSectionWidgetsTests({ context, home: homeValues, addressIsFilled: false });

// There should be a warning on home location, go to completed if home not in territory

// Click on the next button
test('Click next button with outside home 1', async () => {
    // Click on Save button
    const button = context.page.getByRole('button', { name: 'Save and continue' });
    await button.scrollIntoViewIfNeeded();
    await button.click();

    // Wait for any confirmation dialog that might appear and accept it
    const confirmDialog = context.page.getByRole('dialog');
    await confirmDialog.scrollIntoViewIfNeeded();
});

// Click on the revalidate button
test('Click on the reverify geography', async () => {
    // Wait for any confirmation dialog that might appear and accept it
    const confirmDialog = context.page.getByRole('dialog');
    const confirmButton = confirmDialog.getByRole('button', { name: 'Reverify the geography' });
    await confirmButton.click();
});

// Expect to be in the page again
testHelpers.inputVisibleTest({
    context,
    path: 'home.address',
    isVisible: true
});

test('Click next button with outside home 2', async () => {
    // Click on Save button
    const button = context.page.getByRole('button', { name: 'Save and continue' });
    await button.scrollIntoViewIfNeeded();
    await button.click();

    // Wait for any confirmation dialog that might appear and accept it
    const confirmDialog = context.page.getByRole('dialog');
    await confirmDialog.scrollIntoViewIfNeeded();
});

// Click on the confirm button
test('Click next button and confirm out of territory', async () => {
    // Wait for any confirmation dialog that might appear and accept it
    const confirmDialog = context.page.getByRole('dialog');
    const confirmButton = confirmDialog.getByRole('button', { name: 'I confirm geography is correct' });
    await confirmButton.click();

    await expect(context.page).toHaveURL('/survey/completed');
});

/********** Tests completed section **********/
// Manually test visibility as only this test makes use of it
testHelpers.waitTextVisible({ context, text: 'If you do not reside there, your responses cannot be used.' });
testHelpers.waitTextVisible({ context, text: 'Thank you for your participation!', isVisible: false });
testHelpers.waitTextVisible({
    context,
    text: 'Thank you for taking the time to complete this questionnaire.',
    isVisible: false
});

// Logout and log back in with same credentials, shoud log in directly
testHelpers.logoutTest({ context });
