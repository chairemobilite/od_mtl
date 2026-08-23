import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import moment from 'moment';
// eslint-disable-next-line n/no-extraneous-import
import { test, expect } from '@playwright/test';
import * as testHelpers from 'evolution-frontend/tests/ui-testing/testHelpers';

// Function to run in the `afterAll` hook to delete the participant interview, to allow retries to reset the state to its original value
export const deleteParticipantInterview = async (email: string) => {
    try {
        // Delete the participant interview with the email
        await knex('sv_participants').del().whereILike('email', `${email}`);
    } catch (error) {
        console.error(`Error deleting participant with email ${email}`, error);
    }
};

// Modify the CommonTestParameters type with survey parameters
export type CommonTestParametersModify = testHelpers.CommonTestParameters & {
    householdSize?: number;
    addressIsFilled?: boolean;
};

export type HouseholdTestParameters = testHelpers.CommonTestParameters & {
    householdMembers: HouseholdMember[];
};

export type HomeTestParameters = testHelpers.CommonTestParameters & {
    addressIsFilled?: boolean;
    home?: HomeSection;
};

/**
 * Listen to the first survey update route to set the assignedDay to a weekday,
 * to make weekend/week cases deterministic
 * @param param0 The web page
 */
export const assignWeekDayToInterview = ({ page }: { page: any }) => {
    // Listen to the first `survey/updateInterview` call
    page.route('**/survey/updateInterview', async (route) => {
        const request = route.request();
        const postData = request.postData();
        const currentIsoWeekday = moment().isoWeekday();

        // For monday, assign last friday (-2 is last friday, ie 5 (friday) - 7 (last week))
        // For sunday, assign current friday
        // All other days will assign the day before
        const date =
            currentIsoWeekday === 1
                ? moment().weekday(-2).format('YYYY-MM-DD')
                : currentIsoWeekday === 7
                    ? moment().weekday(5).format('YYYY-MM-DD')
                    : moment()
                        .weekday(currentIsoWeekday - 1)
                        .format('YYYY-MM-DD');

        const payload = !postData ? {} : JSON.parse(postData);

        // Modify the payload to set the assignedDay
        payload.valuesByPath = {
            ...(payload.valuesByPath ?? {}),
            // add/override fields here
            'response._assignedDay': date
        };

        // Since it was assigned by "client" interception, the server will not
        // assign it, but we still need to send it back to the application, so
        // we listen to the reply and add the _assignedDay there too
        const response = await route.fetch({
            postData: JSON.stringify(payload),
            headers: request.headers()
        });

        const responseBody = await response.text();
        let jsonResponse = JSON.parse(responseBody);

        // Modify the incoming response payload
        jsonResponse = {
            ...jsonResponse,
            updatedValuesByPath: {
                ...jsonResponse.updatedValuesByPath,
                'response._assignedDay': date
            }
        };

        // Complete the route to finish the loop
        await route.fulfill({
            status: response.status(),
            headers: response.headers(),
            body: JSON.stringify(jsonResponse)
        });

        // The job is done, stop listening for this route
        page.unroute('**/survey/updateInterview');
    });
};

// Generate a random access code in the format 0123-4567 from 0000-0000 to 9999-9999
export const generateRandomAccessCode = () =>
    `${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

// For fields values: `null` means the widget is not visible, an undefined value
// means the widget is visible, but should be left untouched.
export type HouseholdMember = {
    personIndex: number;
    nickname: string;
    age: number;
    gender: string | null;
    genderCustom: string | null;
    drivingLicenseOwnership: string | null;
    carSharingMember: string | null;
    bikesharingUsage: string | null;
    // bikesharingMembership: string | null;
    usedTransitInLast30Days: string | null;
    transitPass: string[] | null;
    transitFare: string | null;
    transitFareWarning: string[] | null;
    hasDisability: string | null;
    disabilities?: string[] | null;
    disabilitiesSpecify?: string | null;
    mobilityAssistiveDevices?: string[] | null;
    mobilityAssistiveDevicesSpecify?: string | null;
    mostUsedMobilityAssistiveDevice?: string | null;
    useParatransit?: string | null;
    useParatransitFrequency?: string | null;
    useParatransitTransitFrequency?: string | null;
    studentType: string | null;
    workerType: string | null;
    job: string | null;
    jobType: string | null;
    workPlaceType: string | null;
    workDays: string | null;
    travelToWorkDays: string | null;
    occupation: string | null;
    educationalAttainment: string | null;
};

export type HomeSection = {
    acceptToBeContactedForHelp: string;
    wantToParticipateToDraw: string;
    contactEmail: string | null;
    householdOwnership: string;
    householdSize: number;
    householdCarNumber: string;
    householdTwoWheelNumber: number;
    carParkingAvailableVehicleHousehold: string[] | null;
    carParkingAvailableNoVehicleHousehold: string | null;
    householdCarSharing: string | null;
    householdBicycleNumber: string;
    householdElectricBicycleNumber: string | null;
    householdBikesharing: string | null;
    householdAtLeastOnePersonWithDisability: string | null;
    address: string;
    city: string;
    postalCode: string;
};

export const defaultHome: HomeSection = {
    acceptToBeContactedForHelp: 'yes',
    wantToParticipateToDraw: 'yes',
    contactEmail: 'test@test.com',
    householdOwnership: 'tenant',
    householdSize: 1,
    householdCarNumber: '2',
    householdTwoWheelNumber: 1,
    carParkingAvailableVehicleHousehold: null,
    carParkingAvailableNoVehicleHousehold: null,
    householdCarSharing: null,
    householdBicycleNumber: '2',
    householdElectricBicycleNumber: '1',
    householdBikesharing: null,
    householdAtLeastOnePersonWithDisability: null,
    address: '4898 Avenue du Parc',
    city: 'Montréal',
    postalCode: 'H2V 4E6'
};

export type Segment = {
    segmentIndex: number;
    // Indicate if the segment is expected to be present already or if the participant needs to click the next button
    expectedPrefilled: boolean;
    sameModeAsReverseTrip: boolean | null;
    modePre?: string | null;
    mode?: string | null;
    paidForParking: string | null;
    vehicleOccupancy: number | null;
    driver?: string | null;
    subwayStationStart?: string | null;
    subwayStationEnd?: string | null;
    subwayStationsTransfer?: string[] | null;
    subwayLine: string | null;
    trainStationStart?: string | null;
    trainStationEnd?: string | null;
    remStationStart?: string | null;
    remStationEnd?: string | null;
    planeStationStart: string | null;
    planeStationEnd: string | null;
    intercityRailStationStart: string | null;
    intercityRailStationEnd: string | null;
    intercityBusStationStart: string | null;
    intercityBusStationEnd: string | null;
    busLines: string[] | null;
    busLinesWarning: boolean | null;
    transitAccessMode: string | null;
    intercityAccessMode: string | null;
    onDemandType: string | null;
    tripJunctionQueryString: string | null;
    transitEgressMode: string | null;
    intercityEgressMode: string | null;
    junctionPrivateBus: string | null;
    junctionBusPrivate: string | null;
    junctionPointPaidParking: string | null;
    hasNextMode: boolean | null;
    // Should be shown only in the ep commonTrip if after hasNextMode is false
    commonTrip: string[] | null;
};

/**
 * Default segment with null values for all optional questions
 */
export const defaultSegmentNullValues: Omit<Segment, 'segmentIndex' | 'modePre' | 'mode' | 'hasNextMode'> = {
    expectedPrefilled: false,
    sameModeAsReverseTrip: null, // Question won't show.
    paidForParking: null, // Question won't show.
    vehicleOccupancy: null, // Question won't show.
    driver: null, // Question won't show.
    subwayStationStart: null, // Question won't show.
    subwayStationEnd: null, // Question won't show.
    subwayStationsTransfer: null, // Question won't show.
    subwayLine: null, // Question won't show.
    trainStationStart: null, // Question won't show.
    trainStationEnd: null, // Question won't show.
    remStationStart: null, // Question won't show.
    remStationEnd: null, // Question won't show.
    planeStationStart: null, // Question won't show.
    planeStationEnd: null, // Question won't show.
    intercityRailStationStart: null, // Question won't show.
    intercityRailStationEnd: null, // Question won't show.
    intercityBusStationStart: null, // Question won't show.
    intercityBusStationEnd: null, // Question won't show.
    busLines: null, // Question won't show.
    busLinesWarning: null, // Question won't show.
    transitAccessMode: null, // Question won't show.
    intercityAccessMode: null, // Question won't show.
    onDemandType: null, // Question won't show.
    tripJunctionQueryString: null, // Question won't show.
    transitEgressMode: null, // Question won't show.
    intercityEgressMode: null, // Question won't show.
    junctionBusPrivate: null, // Question won't show.
    junctionPrivateBus: null, // Question won't show.
    junctionPointPaidParking: null, // Question won't show.
    commonTrip: null // Question won't show.
};

// TODO: Consider moving the householdMembers array to the individual test files for easier customization per test case.
/** Female, full time worker, part time student, carsharing member with transitPass, hybrid work and school places */
export const defaultPerson1: HouseholdMember = {
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
    studentType: 'partTime',
    job: 'administration',
    jobType: 'administration',
    workPlaceType: 'hybrid',
    workDays: '4',
    travelToWorkDays: '3',
    educationalAttainment: 'postSecondaryBelowBachelorEducation',
    occupation: null, // Question won't show.
    // FIXME For now the question is always shown, until https://github.com/chairemobilite/evolution/issues/1608 is resolved, or we actually have the `home.RA` field set
    bikesharingUsage: 'no'
    // bikesharingMembership: null
};
/**
 * Male, part time worker, full time student, no driving license, with transitPass, hybrid work and school places
 */
export const defaultPerson2: HouseholdMember = {
    personIndex: 1,
    nickname: 'John',
    age: 35,
    gender: 'male',
    genderCustom: null,
    drivingLicenseOwnership: 'no',
    carSharingMember: null, // Question won't show.
    usedTransitInLast30Days: 'no',
    transitPass: null,
    transitFare: null,
    transitFareWarning: null,
    hasDisability: 'yes',
    disabilities: ['hearing', 'cognitiveOrPsychic'],
    disabilitiesSpecify: null,
    mobilityAssistiveDevices: [],
    mobilityAssistiveDevicesSpecify: null,
    mostUsedMobilityAssistiveDevice: null,
    useParatransit: 'yes',
    useParatransitFrequency: null, // Question won't show, need special ep
    useParatransitTransitFrequency: null, // Question won't show, need special ep
    workerType: 'fullTime',
    studentType: 'partTime',
    job: 'commis comptable',
    jobType: 'administration',
    workPlaceType: 'onLocation',
    workDays: null, // Question won't show
    travelToWorkDays: '5', // Question won't show
    educationalAttainment: 'postSecondaryBelowBachelorEducation',
    occupation: null, // Question won't show.
    // FIXME For now the question is always shown, until https://github.com/chairemobilite/evolution/issues/1608 is resolved, or we actually have the `home.RA` field set
    bikesharingUsage: 'no'
    // bikesharingMembership: null
};

export type VisitedPlace = {
    activityCategory?: string | null;
    activity: string | null;
    onTheRoadPreviousPlaceActivity: string | null;
    onTheRoadNextPlaceCategory: string | null;
    previousWorkPlaceName: string | null;
    alreadyVisitedBySelfOrAnotherHouseholdMember: boolean | null;
    shortcut: string | null;
    name: string | null;
    _previousPreviousDepartureTime: number | null;
    _previousArrivalTime: number | null;
    _previousDepartureTime: number | null;
    arrivalTime: number | null;
    nextPlaceCategory: string | null;
    departureTime: number | null;
};

export type TravelBehavior = {
    noWorkTripReason: string | null;
    usualWorkPlace: {
        name: string;
    } | null;
    usualWorkPlaceCommuting: string | null;
    hasSchoolPlace: string | null;
    usualSchoolPlace: {
        name: string;
    } | null;
    noSchoolTripReason: string | null;
};

export const defaultTravelBehavior: TravelBehavior = {
    noWorkTripReason: null,
    usualWorkPlace: null,
    usualWorkPlaceCommuting: null,
    hasSchoolPlace: null,
    usualSchoolPlace: null,
    noSchoolTripReason: null
};

// Default person is worker and student and no trips, so we will those values
export const defaultTravelBehaviorWhenNoTrip: TravelBehavior = {
    noWorkTripReason: 'noWork',
    usualWorkPlace: { name: 'Bombardier' },
    usualWorkPlaceCommuting: 'walk',
    hasSchoolPlace: 'yes',
    usualSchoolPlace: {
        name: 'Université de Montréal, Campus de la Montagne'
    },
    noSchoolTripReason: 'distanceLearning'
};

export type LongDistanceSection = {
    madeLongDistanceTrips: 'yes' | 'no' | 'dontKnow';
    frequencySeptemberDecember: string | null;
    frequencyJanuaryApril: string | null;
    frequencyMayAugust: string | null;
    wantToParticipateInSurvey: string | null;
    wantToParticipateInSurveyEmail: string | null;
};

export type OmissionsSection = {
    toddlerDaycare: 'yes' | 'no' | null;
    toddlerDaycareDropoff: string[] | null;
    toddlerDaycareDropoffMode: string | null;
    toddlerDaycarePickup: string[] | null;
    toddlerDaycarePickupMode: string | null;
    hasOmittedTrips: 'yes' | 'no' | null;
    hasOmittedTripsIntro: string | null; // Text that appears in the info text
    hasOmittedTripsActivity: string[] | null;
    hasOmittedTripsMode: string[] | null;
};

export const defaultOmissionsSection: OmissionsSection = {
    toddlerDaycare: 'no',
    toddlerDaycareDropoff: null,
    toddlerDaycareDropoffMode: null,
    toddlerDaycarePickup: null,
    toddlerDaycarePickupMode: null,
    hasOmittedTrips: 'no',
    hasOmittedTripsIntro: null,
    hasOmittedTripsActivity: null,
    hasOmittedTripsMode: null
};

export const defaultLongDistance: LongDistanceSection = {
    madeLongDistanceTrips: 'no',
    frequencySeptemberDecember: null,
    frequencyJanuaryApril: null,
    frequencyMayAugust: null,
    wantToParticipateInSurvey: null,
    wantToParticipateInSurveyEmail: null
};

/********* Tests access code section */
type AccessCodeSection = {
    accessCode?: string; // undefined => no change to the value, visible
    accessCodeIsCorrect?: true | null; // undefined => no change, but value visible; null => invisible; value => check the value
    expectedNextSection?: string;
};
export const fillAccessCodeSectionTests = ({
    context,
    accessCode
}: testHelpers.CommonTestParameters & { accessCode: AccessCodeSection }) => {
    // Test checkbox first to allow entering invalid codes
    // Test checkbox widget accessCodeIsCorrectConfirmation with conditional isAccessCodeInvalidConditional with choices accessCodeConfirmChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (accessCode.accessCodeIsCorrect === null) {
        testHelpers.inputVisibleTest({ context, path: 'accessCodeIsCorrect', isVisible: false });
    } else {
        if (accessCode.accessCodeIsCorrect !== undefined) {
            testHelpers.inputCheckboxTest({ context, path: 'accessCodeIsCorrect', values: ['accessCodeConfirmOk'] });
        } else {
            testHelpers.inputVisibleTest({ context, path: 'accessCodeIsCorrect', isVisible: true });
        }
    }

    // Test string widget accessCode
    if (accessCode.accessCode !== undefined) {
        testHelpers.inputStringTest({ context, path: 'accessCode', value: accessCode.accessCode });
    }

    // Test nextbutton widget accessCode_confirm
    testHelpers.inputNextButtonTest({
        context,
        text: 'Confirm',
        nextPageUrl: `survey/${accessCode.expectedNextSection ?? 'home'}`
    });
};

/********** Tests home section **********/
export const fillHomeSectionTests = ({ context, home = defaultHome, addressIsFilled = true }: HomeTestParameters) => {
    const householdSize = home.householdSize;

    // Verify the home navigation is active
    testHelpers.verifyNavBarButtonStatus({ context, buttonText: 'home', buttonStatus: 'active', isDisabled: false });

    // Test radio widget acceptToBeContactedForHelp with choices yesNo
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({ context, path: 'acceptToBeContactedForHelp', value: home.acceptToBeContactedForHelp });

    // Test radio widget wantToParticipateToDraw with choices yesNo
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({ context, path: 'wantToParticipateToDraw', value: home.wantToParticipateToDraw });

    // Test string widget contactEmail with conditional acceptsToBeContactedForHelp
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (home.contactEmail === null) {
        // Test infotext widget contactInformationIntro with conditional acceptsToBeContactedForHelp
        /* @link file://./../src/survey/common/conditionals.tsx */
        testHelpers.waitTextVisible({
            context,
            text: 'Please enter the email so we can contact you',
            isVisible: false
        });
        testHelpers.inputVisibleTest({
            context,
            path: 'contactEmail',
            isVisible: false
        });
    } else {
        // Test infotext widget contactInformationIntro with conditional acceptsToBeContactedForHelp
        /* @link file://./../src/survey/common/conditionals.tsx */
        testHelpers.waitTextVisible({ context, text: 'Please enter the email so we can contact you' });
        testHelpers.inputStringTest({
            context,
            path: 'contactEmail',
            value: home.contactEmail
        });
    }

    if (!addressIsFilled) {
        testHelpers.waitTextVisible({
            context,
            text: 'Address pre-filled according to the access code.',
            isVisible: false
        });

        // Test string widget home_address
        testHelpers.inputStringTest({ context, path: 'home.address', value: home.address });

        // Test string widget home_city
        testHelpers.inputStringTest({ context, path: 'home.city', value: home.city });

        // Test string widget home_postalCode
        testHelpers.inputStringTest({ context, path: 'home.postalCode', value: home.postalCode });

        // Test custom widget home_geography
        testHelpers.inputMapFindPlaceTest({ context, path: 'home.geography' });
    } else {
        // FIXME Validate the address is filled correctly. For now, we just
        // assume the value is there otherwise the test will fail later when
        // trying to change section

        // Test visibility of address inputs, without filling any values
        testHelpers.waitTextVisible({ context, text: 'Your address has been pre-filled based on your access code.' });
        testHelpers.inputVisibleTest({ context, path: 'home.address', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'home.city', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'home.postalCode', isVisible: true });
    }

    // Test radio widget householdOwnership with choices householdOwnershipChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({ context, path: 'household.ownership', value: home.householdOwnership });

    // Test radionumber widget household_size
    testHelpers.inputRadioTest({ context, path: 'household.size', value: String(householdSize) });

    // Test radionumber widget household_carNumber
    testHelpers.inputRadioTest({ context, path: 'household.carNumber', value: home.householdCarNumber });

    // Test radionumber widget household_twoWheelNumber
    testHelpers.inputRadioTest({ context, path: 'household.twoWheelNumber', value: home.householdTwoWheelNumber });

    // Test radionumber widget household_bicycleNumber
    testHelpers.inputRadioTest({ context, path: 'household.bicycleNumber', value: home.householdBicycleNumber });

    // Test radionumber widget household_electricBicycleNumber with conditional hasHouseholdBicycleConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (home.householdElectricBicycleNumber === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.electricBicycleNumber',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.electricBicycleNumber',
            value: home.householdElectricBicycleNumber
        });
    }

    // Test checkbox widget home_carParkingsAvailableVehicleHousehold with conditional carParkingHomeWithVehicleConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (home.carParkingAvailableVehicleHousehold === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'home.carParkingAvailableVehicleHousehold',
            isVisible: false
        });
    } else {
        testHelpers.inputCheckboxTest({
            context,
            path: 'home.carParkingAvailableVehicleHousehold',
            values: home.carParkingAvailableVehicleHousehold
        });
    }

    // Test radio widget home_carParkingsAvailableNoVehicleHousehold with conditional carParkingHomeWithoutVehicleConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (home.carParkingAvailableNoVehicleHousehold === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'home.carParkingAvailableNoVehicleHousehold',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'home.carParkingAvailableNoVehicleHousehold',
            value: home.carParkingAvailableNoVehicleHousehold
        });
    }

    // Test radio widget household_carsharing with conditional sharingMobilitiesConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (home.householdCarSharing === null) {
        testHelpers.inputVisibleTest({ context, path: 'household.carsharing', isVisible: false });
    } else {
        testHelpers.inputRadioTest({ context, path: 'household.carsharing', value: home.householdCarSharing });
    }

    // Test radio widget household_bikesharing with conditional sharingMobilitiesConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (home.householdBikesharing === null) {
        testHelpers.inputVisibleTest({ context, path: 'household.bikesharing', isVisible: false });
    } else {
        testHelpers.inputRadioTest({ context, path: 'household.bikesharing', value: home.householdBikesharing });
    }

    // Test radio widget household_atLeastOnePersonWithDisability with conditional hasHouseholdSize2OrMoreConditional with choices yesNoPreferNotToAnswer
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (householdSize === 1 || home.householdAtLeastOnePersonWithDisability === null) {
        testHelpers.inputVisibleTest({ context, path: 'household.atLeastOnePersonWithDisability', isVisible: false });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.atLeastOnePersonWithDisability',
            value: home.householdAtLeastOnePersonWithDisability
        });
    }

    // Test nextbutton widget home_save
    testHelpers.inputNextButtonTest({ context, text: 'Save and continue', nextPageUrl: '/survey/household' });

    // Verify the home navigation is completed
    testHelpers.verifyNavBarButtonStatus({ context, buttonText: 'home', buttonStatus: 'completed', isDisabled: false });
};

/********** Tests household section **********/
export const fillHouseholdSectionTests = ({ context, householdSize = 1 }: CommonTestParametersModify) => {
    // Verify the household navigation is active
    testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'household',
        buttonStatus: 'active',
        isDisabled: false
    });

    // Test custom widget householdMembers
    testHelpers.waitTextVisible({ context, text: 'Household members' });

    const householdMembersData = [defaultPerson1];

    // Add additional household members based on householdSize, only if the data
    // is not set. This is for legacy tests that were not providing household
    // members
    if (householdSize >= 2) {
        householdMembersData.push(defaultPerson2);
    }
    fillHouseholdSectionWithMembersTests({ context, householdMembers: householdMembersData });
};

export const fillHouseholdSectionWithMembersTests = ({ context, householdMembers }: HouseholdTestParameters) => {
    // Add tests for each household member
    householdMembers.forEach((person: HouseholdMember, index) => {
        // Build a string for personId (e.g., "${personId[0]}") using a template literal to avoid immediate interpolation
        const personIdString = `\${personId[${index}]}`;

        // Test number widget personAge
        testHelpers.inputStringTest({
            context,
            path: `household.persons.${personIdString}.age`,
            value: person.age.toString()
        });

        // Test string widget personNickname with conditional hasHouseholdSize2OrMoreConditional
        /* @link file://./../src/survey/common/conditionals.tsx */
        if (householdMembers.length === 1) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.nickname`,
                isVisible: false
            });
        } else {
            testHelpers.inputStringTest({
                context,
                path: `household.persons.${personIdString}.nickname`,
                value: person.nickname
            });
        }

        // Test radio widget personGender with conditional displayGenderIfSexAtBirthPreferNotAnswerCustomConditional with choices maleFemaleCustomPreferNotToAnswer
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.gender === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.gender`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.gender`,
                value: person.gender
            });
        }

        // Test radio widget personDrivingLicenseOwnership with conditional ifAge16OrMoreConditional with choices yesNoDontKnow
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.drivingLicenseOwnership === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.drivingLicenseOwnership`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.drivingLicenseOwnership`,
                value: person.drivingLicenseOwnership
            });
        }

        // Test radio widget personCarSharingMember with conditional hasDrivingLicenseConditional with choices yesNoDontKnow
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.carSharingMember === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.carsharingMember`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.carsharingMember`,
                value: person.carSharingMember
            });
        }

        // Test radio widget personBikesharingUsage with conditional bikesharingConditional with choices yesNoDontKnow
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.bikesharingUsage === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.bikesharingUsage`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.bikesharingUsage`,
                value: person.bikesharingUsage
            });
        }

        // Test radio widget personUsedTransitInLast30Days with conditional ifAge5orMoreConditional with choices yesNoDontKnow
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.usedTransitInLast30Days === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.usedTransitInLast30Days`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.usedTransitInLast30Days`,
                value: person.usedTransitInLast30Days
            });
        }

        // Test checkbox widget personTransitPass with conditional transitPassConditional with choices transitPassType
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.transitPass === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.transitPass`,
                isVisible: false
            });
        } else {
            testHelpers.inputCheckboxTest({
                context,
                path: `household.persons.${personIdString}.transitPass`,
                values: person.transitPass
            });
        }

        // Test radio widget personTransitFare with conditional transitFareConditional with choices transitFareType
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.transitFare === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.transitFare`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.transitFare`,
                value: person.transitFare
            });
        }

        // Test checkbox widget personTransitFareWarning with conditional transitFareWarningCustomConditional with choices transitFareWarning
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.transitFareWarning === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.transitFareWarning`,
                isVisible: false
            });
        } else {
            // Keep empty if there is no choice selected, this question should be optional
            if (person.transitFareWarning.length > 0) {
                testHelpers.inputCheckboxTest({
                    context,
                    path: `household.persons.${personIdString}.transitFareWarning`,
                    values: person.transitFareWarning
                });
            } else {
                testHelpers.inputVisibleTest({
                    context,
                    path: `household.persons.${personIdString}.transitFareWarning`,
                    isVisible: true
                });
            }
        }

        // Test radio widget personHasDisability with conditional hasOnePersonWithDisabilityOrHhSize1CustomConditional with choices yesNoPreferNotToAnswer
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.hasDisability === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.hasDisability`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.hasDisability`,
                value: person.hasDisability
            });
        }

        // Test checkbox widget personDisabilities with conditional hasDisabilityConditional with choices disabilities
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.disabilities === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.disabilities`,
                isVisible: false
            });
        } else {
            if (person.disabilities !== undefined && person.disabilities.length > 0) {
                testHelpers.inputCheckboxTest({
                    context,
                    path: `household.persons.${personIdString}.disabilities`,
                    values: person.disabilities
                });
            } else {
                testHelpers.inputVisibleTest({
                    context,
                    path: `household.persons.${personIdString}.disabilities`,
                    isVisible: true
                });
            }
        }

        // Test string widget personDisabilitiesSpecify with conditional personDisabilityIsOtherConditional
        /* @link file://./../src/survey/common/conditionals.tsx */
        if (person.disabilitiesSpecify === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.disabilitiesSpecify`,
                isVisible: false
            });
        } else {
            if (person.disabilitiesSpecify !== undefined) {
                testHelpers.inputStringTest({
                    context,
                    path: `household.persons.${personIdString}.disabilitiesSpecify`,
                    value: person.disabilitiesSpecify
                });
            } else {
                testHelpers.inputVisibleTest({
                    context,
                    path: `household.persons.${personIdString}.disabilitiesSpecify`,
                    isVisible: true
                });
            }
        }

        // Test checkbox widget personMobilityAssistiveDevices with conditional hasDisabilityConditional with choices mobilityAssistiveDevices
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.mobilityAssistiveDevices === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.mobilityAssistiveDevices`,
                isVisible: false
            });
        } else {
            if (person.mobilityAssistiveDevices !== undefined && person.mobilityAssistiveDevices.length > 0) {
                testHelpers.inputCheckboxTest({
                    context,
                    path: `household.persons.${personIdString}.mobilityAssistiveDevices`,
                    values: person.mobilityAssistiveDevices
                });
            } else {
                testHelpers.inputVisibleTest({
                    context,
                    path: `household.persons.${personIdString}.mobilityAssistiveDevices`,
                    isVisible: true
                });
            }
        }

        // Test string widget personMobilityAssistiveDevicesSpecify with conditional personAssistiveDevicesIsOtherConditional
        /* @link file://./../src/survey/common/conditionals.tsx */
        if (person.mobilityAssistiveDevicesSpecify === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.mobilityAssistiveDevicesSpecify`,
                isVisible: false
            });
        } else {
            if (person.mobilityAssistiveDevicesSpecify !== undefined) {
                testHelpers.inputStringTest({
                    context,
                    path: `household.persons.${personIdString}.mobilityAssistiveDevicesSpecify`,
                    value: person.mobilityAssistiveDevicesSpecify
                });
            } else {
                testHelpers.inputVisibleTest({
                    context,
                    path: `household.persons.${personIdString}.mobilityAssistiveDevicesSpecify`,
                    isVisible: true
                });
            }
        }

        // Test radio widget personMostUsedMobilityAssistiveDevice with conditional mostUsedMobilityAssistiveDeviceCustomConditional with choices mostUsedMobilityAssistiveDeviceCustomChoices
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.mostUsedMobilityAssistiveDevice === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.mostUsedMobilityAssistiveDevice`,
                isVisible: false
            });
        } else {
            if (person.mostUsedMobilityAssistiveDevice !== undefined) {
                testHelpers.inputRadioTest({
                    context,
                    path: `household.persons.${personIdString}.mostUsedMobilityAssistiveDevice`,
                    value: person.mostUsedMobilityAssistiveDevice
                });
            } else {
                testHelpers.inputVisibleTest({
                    context,
                    path: `household.persons.${personIdString}.mostUsedMobilityAssistiveDevice`,
                    isVisible: true
                });
            }
        }

        // Test radio widget personUseParatransit with conditional hasDisabilityConditional with choices yesNoPreferNotToAnswer
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.useParatransit === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.useParatransit`,
                isVisible: false
            });
        } else {
            if (person.useParatransit !== undefined) {
                testHelpers.inputRadioTest({
                    context,
                    path: `household.persons.${personIdString}.useParatransit`,
                    value: person.useParatransit
                });
            } else {
                testHelpers.inputVisibleTest({
                    context,
                    path: `household.persons.${personIdString}.useParatransit`,
                    isVisible: true
                });
            }
        }

        // Test radio widget personDisabilitiesFrequenciesParatransit with conditional paratransitFrequenciesConditional with choices paratransitFrequencies
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.useParatransitFrequency === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.disabilitiesFrequenciesParatransit`,
                isVisible: false
            });
        } else {
            if (person.useParatransitFrequency !== undefined) {
                testHelpers.inputRadioTest({
                    context,
                    path: `household.persons.${personIdString}.disabilitiesFrequenciesParatransit`,
                    value: person.useParatransitFrequency
                });
            } else {
                testHelpers.inputVisibleTest({
                    context,
                    path: `household.persons.${personIdString}.disabilitiesFrequenciesParatransit`,
                    isVisible: true
                });
            }
        }

        // Test radio widget personDisabilitiesFrequenciesTransit with conditional paratransitFrequenciesConditional with choices paratransitFrequenciesTransit
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.useParatransitTransitFrequency === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.disabilitiesFrequenciesTransit`,
                isVisible: false
            });
        } else {
            if (person.useParatransitTransitFrequency !== undefined) {
                testHelpers.inputRadioTest({
                    context,
                    path: `household.persons.${personIdString}.disabilitiesFrequenciesTransit`,
                    value: person.useParatransitTransitFrequency
                });
            } else {
                testHelpers.inputVisibleTest({
                    context,
                    path: `household.persons.${personIdString}.disabilitiesFrequenciesTransit`,
                    isVisible: true
                });
            }
        }

        // Test radio widget personStudentType with conditional ifAge16OrMoreConditional with choices participationStatusStudent
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.studentType === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.studentType`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.studentType`,
                value: person.studentType
            });
        }

        // Test radio widget personWorkerType with conditional ifAge14orMoreConditional with choices participationStatusWorker
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.workerType === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.workerType`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.workerType`,
                value: person.workerType
            });
        }

        // Test string widget personJob with conditional isWorkerConditional
        /* @link file://./../src/survey/common/conditionals.tsx */
        if (person.job === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.job`,
                isVisible: false
            });
        } else {
            testHelpers.inputStringTest({
                context,
                path: `household.persons.${personIdString}.job`,
                value: person.job
            });
        }

        // Test radio widget personJobType with conditional isWorkerConditional with choices jobTypes
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.jobType === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.jobType`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.jobType`,
                value: person.jobType
            });
        }

        // Test radio widget personWorkPlaceType with conditional isWorkerConditional with choices workPlaceTypeChoices
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.workPlaceType === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.workPlaceType`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.workPlaceType`,
                value: person.workPlaceType
            });
        }

        if (person.workDays === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.workDays`,
                isVisible: false
            });
        } else {
            // Test radionumber widget personWorkDays with conditional personWorkDaysConditional
            /* @link file://./../src/survey/common/conditionals.tsx */
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.workDays`,
                value: person.workDays
            });
        }

        if (person.travelToWorkDays === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.travelToWorkDays`,
                isVisible: false
            });
        } else {
            // Test custom widget personTravelToWorkDays with conditional personWorkTripDaysConditional
            /* @link file://./../src/survey/common/conditionals.tsx */
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.travelToWorkDays`,
                value: person.travelToWorkDays
            });
        }

        // Test radio widget personEducationalAttainment with conditional ifAge15OrMoreConditional with choices educationalAttainment
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.educationalAttainment === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.educationalAttainment`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.educationalAttainment`,
                value: person.educationalAttainment
            });
        }

        // Test radio widget personOccupation with conditional personOccupationCustomConditional with choices personOccupation
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (person.occupation === null) {
            testHelpers.inputVisibleTest({
                context,
                path: `household.persons.${personIdString}.occupation`,
                isVisible: false
            });
        } else {
            testHelpers.inputRadioTest({
                context,
                path: `household.persons.${personIdString}.occupation`,
                value: person.occupation
            });
        }
    });

    // Test nextbutton widget household_save
    testHelpers.inputNextButtonTest({
        context,
        text: 'Save and continue',
        nextPageUrl: '/survey/tripsIntro'
    });

    // Verify the household navigation is completed
    testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'household',
        buttonStatus: 'completed',
        isDisabled: false
    });
};

const testTripDiaryHeaderVisibility = ({ context, householdSize = 1 }: CommonTestParametersModify) => {
    // Test custom widget activePersonTitle with conditional hasHouseholdSize2OrMoreConditional
    // Test custom widget buttonSwitchPerson
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (householdSize === 1) {
        testHelpers.inputVisibleTest({ context, path: 'activePersonTitle', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'buttonSwitchPerson', isVisible: false });
    } else {
        testHelpers.waitTextVisible({ context, text: '’s interview' });
        // FIXME: The following visibility tests for 'buttonSwitchPerson' fails because it is not an input. It is not a button and we should support button visibility tests
        // testHelpers.inputVisibleTest({ context, path: 'buttonSwitchPerson', isVisible: true });
    }
};

/********** Tests selectPerson section **********/
export const fillSelectPersonSectionTests = ({ context, householdSize = 1 }: CommonTestParametersModify) => {
    if (householdSize === 1) {
        // If household size is 1, skip the selectPerson section
        return;
    }

    // Verify the selectPerson navigation is active
    testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'selectPerson',
        buttonStatus: 'active',
        isDisabled: false
    });

    // Test custom widget selectPerson
    testHelpers.inputRadioTest({
        context,
        path: 'household.persons.${activePersonId}.selected',
        value: '${personId[0]}' // Select the first person value
    });

    // TODO: Test custom widget personNewPerson
    // Implement custom test

    // Test nextbutton widget buttonSelectPersonConfirm
    testHelpers.inputNextButtonTest({
        context,
        text: 'Select this person and continue',
        nextPageUrl: '/survey/tripsIntro'
    });

    // Verify the selectPerson navigation is completed
    // testHelpers.verifyNavBarButtonStatus({
    //     context,
    //     buttonText: 'selectPerson',
    //     buttonStatus: 'completed',
    //     isDisabled: true
    // });
};

/********** Tests tripsIntro section **********/
export type TripsIntroTestParameters = CommonTestParametersModify & {
    hasTrips: boolean;
    expectPopup?: boolean;
    departurePlaceIsHome?: 'yes' | 'no';
    departurePlaceOther?: string | null;
    expectedNextSection: string;
};
export const fillTripsintroSectionTests = ({
    context,
    householdSize = 1,
    hasTrips,
    expectPopup = false,
    departurePlaceIsHome = 'yes',
    departurePlaceOther = null,
    expectedNextSection
}: TripsIntroTestParameters) => {
    // Verify the tripsIntro navigation is active
    testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'trips',
        buttonStatus: 'active',
        isDisabled: false
    });

    // Test custom widget personNewPerson
    if (expectPopup) {
        // Note: In JavaScript regex, ".*" does not match newlines, so it only matches within a single line.
        // Note: "[\s\S]*" matches any character including newlines, so it is used here to match any content (including line breaks) between 'trips' and 'Continue'.
        testHelpers.inputPopupButtonTest({
            context,
            text: 'Continue',
            popupText: /We will ask you to specify.* trips[\s\S]*Continue/i
        });
    }

    testTripDiaryHeaderVisibility({ context, householdSize });

    // Test custom widget personWhoWillAnswerForThisPerson
    if (householdSize >= 2) {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.whoWillAnswerForThisPerson',
            value: '${activePersonId}' // Select the current person
        });
    }

    // Test custom widget personDidTrips
    testHelpers.inputRadioTest({
        context,
        path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.personDidTrips',
        value: hasTrips ? 'yes' : 'no'
    });

    // TODO: Test custom widget personDidTripsChangeConfirm
    // Implement custom test

    // TODO: Test custom widget visitedPlacesIntro
    // Implement custom test

    // Test custom widget personDeparturePlaceIsHome
    if (hasTrips) {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.departurePlaceIsHome',
            value: departurePlaceIsHome
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.departurePlaceIsHome',
            isVisible: false
        });
    }

    // Test radio widget personDeparturePlaceOther with conditional departurePlaceOtherCustomConditional with choices departurePlaceOtherChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (!hasTrips || departurePlaceOther === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.departurePlaceOther',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.departurePlaceOther',
            value: departurePlaceOther
        });
    }

    // Test infotext widget tripsIntroOutro
    testHelpers.waitTextVisible({
        context,
        text: 'Your answers will be used to assess how road and public transit networks are used and will remain entirely confidential'
    });

    // Test nextbutton widget tripsIntro_save
    testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: `/survey/${expectedNextSection}` });

    // Verify the tripsIntro navigation is completed
    testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'trips',
        buttonStatus: expectedNextSection === 'end' ? 'completed' : 'active', // Trips section is still active if the next section is not 'end'
        isDisabled: false
    });
};

// TODO: We should use interviewablePersonCount and not householdSize
// TODO: Because we can only get visited places of interviawablePerson.
/********** Tests visitedPlaces section **********/
export const fillVisitedPlacesSectionTests = ({
    context,
    householdSize = 1,
    visitedPlaces,
    journeyStartsAtHome = true
}: CommonTestParametersModify & { visitedPlaces: VisitedPlace[]; journeyStartsAtHome?: boolean }) => {
    testTripDiaryHeaderVisibility({ context, householdSize });

    // Test custom widget personVisitedPlacesTitle
    // FIXME Currently, every is self-respondent and should be asked at second person time, but support also proxy respondents
    // if (householdSize === 1) {
    testHelpers.waitTextVisible({ context, text: 'Places you went on' });
    // } else {
    //    testHelpers.waitTextVisible({ context, text: `Places ${householdMembers[0].nickname} went on` });
    // }

    // Test custom widget personVisitedPlaces
    // Implement custom test

    // Test custom widget personVisitedPlacesMap
    // Implement custom test

    // Add tests for each visited places
    visitedPlaces.forEach((place: VisitedPlace, index) => {
        fillOneVisitedPlace({ context, place }); // Fill a visited place from start to confirmation
        // If it is not the last place, wait for the next place title to be
        // displayed, otherwise, the next test will race with the update and may
        // use the previous active visited place ID
        if (index !== visitedPlaces.length - 1) {
            // Wait for the next location to be visible. If journey starts at
            // home, the first visited place in the array (at index 0) is the
            // second location (after home), so "location #2". We wait for
            // `index + 3` to be visible. Otherwise, the first place in array is
            // location #1, so we wait for `index + 2`.
            const nextLocationSequence = journeyStartsAtHome ? index + 3 : index + 2;
            testHelpers.waitTextVisible({ context, text: `Location #${nextLocationSequence}` });
        }
    });

    // Test custom widget buttonCancelVisitedPlace
    // Implement custom test

    // Test custom widget buttonDeleteVisitedPlace
    // Implement custom test

    // Test custom widget buttonVisitedPlacesConfirmNextSection with conditional lastPlaceEnteredCustomConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    testHelpers.inputNextButtonTest({
        context,
        text: 'Confirm locations and continue',
        nextPageUrl: '/survey/segments'
    });
};

// Fill a visited place from start to confirmation
// Return the active place ID to be used for next tests if needed
const fillOneVisitedPlace = ({ context, place }: { context: any; place: VisitedPlace }) => {
    // Test custom widget visitedPlaceActivityCategory
    if (place.activityCategory === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.activityCategory',
            isVisible: false
        });
    } else {
        if (place.activityCategory !== undefined) {
            testHelpers.inputRadioTest({
                context,
                path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.activityCategory',
                value: place.activityCategory
            });
        } else {
            testHelpers.inputVisibleTest({
                context,
                path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.activityCategory',
                isVisible: true
            });
        }
    }

    // Test custom widget visitedPlaceActivity
    if (place.activity === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.activity',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.activity',
            value: place.activity
        });
    }

    // Test custom widget visitedPlaceOnTheRoadDepartureType
    if (place.onTheRoadPreviousPlaceActivity === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.onTheRoadPreviousPlaceActivity',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.onTheRoadPreviousPlaceActivity',
            value: place.onTheRoadPreviousPlaceActivity
        });
    }

    // Test custom widget visitedPlacePreviousWorkPlaceName
    if (place.previousWorkPlaceName === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}._previousWorkPlace.name',
            isVisible: false
        });
    } else {
        testHelpers.inputStringTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}._previousWorkPlace.name',
            value: place.previousWorkPlaceName
        });
    }

    // Test custom widget visitedPlacePreviousWorkPlaceGeography
    if (place.previousWorkPlaceName === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}._previousWorkPlace.geography',
            isVisible: false
        });
    } else {
        testHelpers.inputMapFindPlaceTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}._previousWorkPlace.geography'
        });
    }

    // Test radio widget visitedPlaceAlreadyVisited with conditional alreadyVisitedPlaceCustomConditional with choices yesNo
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (place.alreadyVisitedBySelfOrAnotherHouseholdMember === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.alreadyVisitedBySelfOrAnotherHouseholdMember',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.alreadyVisitedBySelfOrAnotherHouseholdMember',
            value: place.alreadyVisitedBySelfOrAnotherHouseholdMember
        });
    }

    // Test custom widget visitedPlaceShortcut
    if (place.shortcut === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.shortcut',
            isVisible: false
        });
    } else {
        testHelpers.inputSelectTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.shortcut',
            value: place.shortcut
        });
    }

    // Test custom widget visitedPlaceName
    if (place.name === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.name',
            isVisible: false
        });
    } else {
        testHelpers.inputStringTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.name',
            value: place.name
        });
    }

    // Test custom widget visitedPlaceGeography
    if (place.name === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.geography',
            isVisible: false
        });
    } else {
        testHelpers.inputMapFindPlaceTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.geography'
        });
    }

    // Test custom widget visitedPlacePreviousPreviousDepartureTime
    if (place._previousPreviousDepartureTime === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}._previousPreviousDepartureTime',
            isVisible: false
        });
    }

    // Test custom widget visitedPlacePreviousArrivalTime
    if (place._previousArrivalTime === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}._previousArrivalTime',
            isVisible: false
        });
    }

    // Test custom widget visitedPlacePreviousDepartureTime
    if (place._previousDepartureTime === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}._previousDepartureTime',
            isVisible: false
        });
    } else {
        testHelpers.inputSelectTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}._previousDepartureTime',
            value: String(place._previousDepartureTime)
        });
    }

    // Test custom widget visitedPlaceArrivalTime
    if (place.arrivalTime === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.arrivalTime',
            isVisible: false
        });
    } else {
        testHelpers.inputSelectTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.arrivalTime',
            value: String(place.arrivalTime)
        });
    }

    // Test custom widget visitedPlaceNextPlaceCategory
    if (place.nextPlaceCategory === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.nextPlaceCategory',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.nextPlaceCategory',
            value: place.nextPlaceCategory
        });
    }

    // Test radio widget visitedPlaceOnTheRoadArrivalType with conditional currentPlaceWorkOnTheRoadAndNoNextPlaceCustomConditional with choices onTheRoadArrivalTypeCustomChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (place.onTheRoadNextPlaceCategory === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.onTheRoadNextPlaceCategory',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.onTheRoadNextPlaceCategory',
            value: place.onTheRoadNextPlaceCategory
        });
    }

    // Test custom widget visitedPlaceDepartureTime
    if (place.departureTime === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.departureTime',
            isVisible: false
        });
    } else {
        testHelpers.inputSelectTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.visitedPlaces.${activeVisitedPlaceId}.departureTime',
            value: String(place.departureTime)
        });
    }

    // Test custom widget buttonSaveVisitedPlace
    testHelpers.inputNextButtonTest({ context, text: 'Confirm', nextPageUrl: '/survey/visitedPlaces' });
};

/********** Tests Segments section **********/
export const fillSegmentsSectionTests = ({
    context,
    householdSize = 1,
    segments,
    expectedNextSection = 'end'
}: CommonTestParametersModify & { segments: Segment[]; expectedNextSection?: string }) => {
    testTripDiaryHeaderVisibility({ context, householdSize });

    // Test custom widget segmentsPersonTripsTitle
    // Implement custom test

    // Test custom widget personVisitedPlacesMap
    // Implement custom test

    // Test custom widget personTrips
    // Implement custom test

    // Test custom widget segmentIntro
    // Implement custom test

    // Test custom widget segments
    // Implement custom test

    // Fill a segment from start to confirmation
    // Add tests for each household member
    segments.forEach((segment: Segment) => {
        // Fill a segment from start to confirmation
        // TODO: Implement multiple mode of transport for a trip
        fillOneSegmentTests({ context, index: segment.segmentIndex, segment });
    });

    // Test custom widget buttonConfirmNextSection with conditional lastPlaceEnteredCustomConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    testHelpers.inputNextButtonTest({
        context,
        text: 'Confirm modes of transportation and continue',
        nextPageUrl: `/survey/${expectedNextSection}`
    });
};

// Fill a segment from start to confirmation
const fillOneSegmentTests = ({
    context,
    index,
    segment
}: CommonTestParametersModify & { index: number; segment: Segment }) => {
    // Build a string for segmentId (e.g., "${segmentId[0]}") using a template literal to avoid immediate interpolation
    const segmentIdString = `\${segmentId[${index}]}`;

    // Test the group object button, if the segment is not expected to exist already
    if (!segment.expectedPrefilled && index > 0) {
        testHelpers.inputNextButtonTest({
            context,
            text: 'Select the next mode of transport',
            nextPageUrl: '/survey/segments'
        });
    }

    // Test custom widget segmentSameModeAsReverseTrip
    if (segment.sameModeAsReverseTrip === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.sameModeAsReverseTrip`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.sameModeAsReverseTrip`,
            value: String(segment.sameModeAsReverseTrip)
        });
    }

    // Test custom widget segmentModePre
    if (segment.modePre === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.modePre`,
            isVisible: false
        });
    } else if (segment.modePre !== undefined) {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.modePre`,
            value: segment.modePre
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.modePre`,
            isVisible: true
        });
    }

    // Test custom widget segmentMode
    if (segment.mode === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.mode`,
            isVisible: false
        });
    } else if (segment.mode !== undefined) {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.mode`,
            value: segment.mode
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.mode`,
            isVisible: true
        });
    }

    // Test radio widget segmentPaidForParking with conditional isCarDriverAndDestinationWorkCustomConditional with choices yesNoDontKnow
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (segment.paidForParking === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.paidForParking`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.paidForParking`,
            value: String(segment.paidForParking)
        });
    }

    // Test radionumber widget segmentVehicleOccupancy
    if (segment.vehicleOccupancy === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.vehicleOccupancy`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.vehicleOccupancy`,
            value: String(segment.vehicleOccupancy)
        });
    }

    // Test custom widget segmentDriver
    if (segment.driver === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.driver`,
            isVisible: false
        });
    } else if (segment.driver !== undefined) {
        testHelpers.inputSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.driver`,
            value: String(segment.driver)
        });
    } else {
        // FIXME Visibility tests do not seem to work with select widgets, cannot validate its presence
        // testHelpers.inputVisibleTest({
        //     context,
        //     path: `true.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.driver`,
        //     isVisible: true
        // });
    }

    // Test custom widget segmentBusLines
    if (segment.subwayStationStart === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayStationStart`,
            isVisible: false
        });
    } else if (segment.subwayStationStart !== undefined) {
        testHelpers.inputMultiSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayStationStart`,
            values: segment.subwayStationStart
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayStationStart`,
            isVisible: true
        });
    }

    // Test custom widget segmentBusLines
    if (segment.subwayStationEnd === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayStationEnd`,
            isVisible: false
        });
    } else if (segment.subwayStationEnd !== undefined) {
        testHelpers.inputMultiSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayStationEnd`,
            values: segment.subwayStationEnd
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayStationEnd`,
            isVisible: true
        });
    }

    // Test custom widget subwayStationsTransfer
    if (segment.subwayStationsTransfer === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayStationsTransfer`,
            isVisible: false
        });
    } else if (segment.subwayStationsTransfer !== undefined) {
        testHelpers.inputCheckboxTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayStationsTransfer`,
            values: segment.subwayStationsTransfer
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayStationsTransfer`,
            isVisible: true
        });
    }

    // Test custom widget subwayLine
    if (segment.subwayLine === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayLine`,
            isVisible: false
        });
    } else if (segment.subwayLine !== undefined) {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayLine`,
            value: segment.subwayLine
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.subwayLine`,
            isVisible: true
        });
    }

    // Test custom widget trainStationStart
    if (segment.trainStationStart === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.trainStationStart`,
            isVisible: false
        });
    } else if (segment.trainStationStart !== undefined) {
        testHelpers.inputMultiSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.trainStationStart`,
            values: segment.trainStationStart
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.trainStationStart`,
            isVisible: true
        });
    }

    // Test custom widget trainStationEnd
    if (segment.trainStationEnd === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.trainStationEnd`,
            isVisible: false
        });
    } else if (segment.trainStationEnd !== undefined) {
        testHelpers.inputMultiSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.trainStationEnd`,
            values: segment.trainStationEnd
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.trainStationEnd`,
            isVisible: true
        });
    }

    // Test custom widget remStationStart
    if (segment.remStationStart === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.remStationStart`,
            isVisible: false
        });
    } else if (segment.remStationStart !== undefined) {
        testHelpers.inputMultiSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.remStationStart`,
            values: segment.remStationStart
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.remStationStart`,
            isVisible: true
        });
    }

    // Test custom widget remStationEnd
    if (segment.remStationEnd === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.remStationEnd`,
            isVisible: false
        });
    } else if (segment.remStationEnd !== undefined) {
        testHelpers.inputMultiSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.remStationEnd`,
            values: segment.remStationEnd
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.remStationEnd`,
            isVisible: true
        });
    }

    // Test custom widget segmentPlaneStationStart
    if (segment.planeStationStart === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.planeStationStart`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.planeStationStart`,
            value: segment.planeStationStart
        });
    }

    // Test custom widget segmentPlaneStationEnd
    if (segment.planeStationEnd === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.planeStationEnd`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.planeStationEnd`,
            value: segment.planeStationEnd
        });
    }

    // Test custom widget segmentIntercityRailStationStart
    if (segment.intercityRailStationStart === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityRailStationStart`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityRailStationStart`,
            value: segment.intercityRailStationStart
        });
    }

    // Test custom widget segmentIntercityRailStationEnd
    if (segment.intercityRailStationEnd === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityRailStationEnd`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityRailStationEnd`,
            value: segment.intercityRailStationEnd
        });
    }

    // Test custom widget segmentIntercityBusStationStart
    if (segment.intercityBusStationStart === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityBusStationStart`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityBusStationStart`,
            value: segment.intercityBusStationStart
        });
    }

    // Test custom widget segmentIntercityBusStationEnd
    if (segment.intercityBusStationEnd === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityBusStationEnd`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityBusStationEnd`,
            value: segment.intercityBusStationEnd
        });
    }

    // Test custom widget segmentBusLines
    if (segment.busLines === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.busLines`,
            isVisible: false
        });
    } else {
        testHelpers.inputMultiSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.busLines`,
            values: segment.busLines
        });
    }

    // Test custom widget segmentBusLinesWarning
    if (segment.busLinesWarning === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.busLinesWarning`,
            isVisible: false
        });
    } else {
        // Implement custom test
    }

    // Test custom widget transitAccessMode
    if (segment.transitAccessMode === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.transitAccessMode`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.transitAccessMode`,
            value: segment.transitAccessMode
        });
    }

    // Test custom widget segmentIntercityAccessMode
    if (segment.intercityAccessMode === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityAccessMode`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityAccessMode`,
            value: segment.intercityAccessMode
        });
    }

    // Test radio widget segmentOnDemandType with conditional isTransitAndNotNationaleCustomConditional with choices onDemandCustomChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (segment.onDemandType === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.onDemandType`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.onDemandType`,
            value: segment.onDemandType
        });
    }

    // Test radio widget segmentTransitEgressMode with conditional isTransitModeAndDistanceToDestinationCustomConditional with choices transitModesChoices
    if (segment.transitEgressMode === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.transitEgressMode`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.transitEgressMode`,
            value: segment.transitEgressMode
        });
    }

    // Test radio widget segmentIntercityEgressMode with conditional isIntercityAndDestinationInTerritoryCustomConditional with choices intercityModesChoices
    if (segment.intercityEgressMode === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityEgressMode`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.intercityEgressMode`,
            value: segment.intercityEgressMode
        });
    }

    // Test radio widget segmentJunctionPrivateBus with conditional junctionPrivateBusCustomConditional with choices tripJunctionCustomChoices
    if (segment.junctionPrivateBus === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.junctionPrivateBus`,
            isVisible: false
        });
    } else {
        testHelpers.inputMultiSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.junctionPrivateBus`,
            values: segment.junctionPrivateBus
        });
    }

    // Test radio widget segmentJunctionBusPrivate with conditional junctionBusPrivateCustomConditional with choices tripJunctionCustomChoices
    if (segment.junctionBusPrivate === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.junctionBusPrivate`,
            isVisible: false
        });
    } else {
        testHelpers.inputMultiSelectTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.junctionBusPrivate`,
            values: segment.junctionBusPrivate
        });
    }

    // Test radio widget segmentJunctionPointPaidParking with conditional junctionPaidParkingCustomConditional with choices junctionPointPaidParkingChoices
    if (segment.junctionPointPaidParking === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.junctionPointPaidParking`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.junctionPointPaidParking`,
            value: segment.junctionPointPaidParking
        });
    }

    // TODO: Implement multiple segments to the same trip by changing this value to 'true'
    // Test custom widget segmentHasNextMode
    if (segment.hasNextMode === null) {
        testHelpers.inputVisibleTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.hasNextMode`,
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: `household.persons.\${activePersonId}.journeys.\${activeJourneyId}.trips.\${activeTripId}.segments.${segmentIdString}.hasNextMode`,
            value: String(segment.hasNextMode)
        });
    }

    // Click on the next button if segment does not have next mode
    if (segment.hasNextMode !== true) {
        // See if the commonTrip field should be present and display it
        // Test checkbox widget personTripsCommonTripWith with conditional commonTripCustomConditional with choices commonTripCustomChoices
        /* @link file://./../src/survey/common/conditionals.tsx */
        /* @link file://./../src/survey/common/choices.tsx */
        if (segment.commonTrip === null) {
            testHelpers.inputVisibleTest({
                context,
                path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.trips.${activeTripId}.commonTripWith',
                isVisible: false
            });
        } else {
            testHelpers.inputCheckboxTest({
                context,
                path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.trips.${activeTripId}.commonTripWith',
                values: segment.commonTrip
            });
        }

        testHelpers.inputNextButtonTest({ context, text: 'Confirm this trip', nextPageUrl: '/survey/segments' });
    }
};

export const fillTravelBehaviorSectionTests = ({
    context,
    householdSize = 1,
    travelBehavior,
    nextSection: expectedNextSection = 'end'
}: CommonTestParametersModify & { travelBehavior: TravelBehavior; nextSection: string }) => {
    testTripDiaryHeaderVisibility({ context, householdSize });

    // Test custom widget personNoWorkTripIntro
    // Implement custom test

    // Test select widget personNoWorkTripReason with conditional shouldAskForNoWorkTripReasonCustomConditional with choices noWorkTripReasonChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (travelBehavior.noWorkTripReason === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.noWorkTripReason',
            isVisible: false
        });
    } else {
        testHelpers.inputSelectTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.noWorkTripReason',
            value: travelBehavior.noWorkTripReason
        });
    }

    // Test the usual workplace, or its absence in this section
    if (travelBehavior.usualWorkPlace === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.usualWorkPlace.name',
            isVisible: false
        });
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.usualWorkPlace.geography',
            isVisible: false
        });
    } else {
        // Test string widget personUsualWorkPlaceName with conditional hasWorkingLocationConditional
        /* @link file://./../src/survey/common/conditionals.tsx */
        testHelpers.inputStringTest({
            context,
            path: 'household.persons.${activePersonId}.usualWorkPlace.name',
            value: travelBehavior.usualWorkPlace!.name
        });

        // Test custom widget personUsualWorkPlaceGeography with conditional hasWorkingLocationConditional
        /* @link file://./../src/survey/common/conditionals.tsx */
        testHelpers.inputMapFindPlaceTest({
            context,
            path: 'household.persons.${activePersonId}.usualWorkPlace.geography'
        });
    }

    // Test radio widget personUsualWorkPlaceCommuting with conditional hasWorkingLocationNotSetCustomConditional with choices usualWorkPlaceCommutingModes
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (travelBehavior.usualWorkPlaceCommuting === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.usualWorkPlaceCommuting',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.usualWorkPlaceCommuting',
            value: travelBehavior.usualWorkPlaceCommuting
        });
    }

    // Test radio widget personHasSchoolPlace with conditional shouldAskForNoSchoolTripFollowupCustomConditional with choices yesNo
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (travelBehavior.hasSchoolPlace === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.hasSchoolPlace',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.persons.${activePersonId}.hasSchoolPlace',
            value: travelBehavior.hasSchoolPlace
        });
    }

    // Test the usual school place, or its absence
    if (travelBehavior.usualSchoolPlace === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.usualSchoolPlace.name',
            isVisible: false
        });
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.usualSchoolPlace.geography',
            isVisible: false
        });
    } else {
        // Test string widget personUsualSchoolPlaceName with conditional hasSchoolLocationNotSetConditional
        /* @link file://./../src/survey/common/conditionals.tsx */
        testHelpers.inputStringTest({
            context,
            path: 'household.persons.${activePersonId}.usualSchoolPlace.name',
            value: travelBehavior.usualSchoolPlace!.name
        });

        // Test custom widget personUsualSchoolPlaceGeography
        testHelpers.inputMapFindPlaceTest({
            context,
            path: 'household.persons.${activePersonId}.usualSchoolPlace.geography'
        });
    }

    // Implement custom test

    // Test custom widget personNoSchoolTripIntro
    // Implement custom test

    // Test select widget personNoSchoolTripReason with conditional hasSchoolLocationNotSetConditional with choices noSchoolTripReasonChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (travelBehavior.noSchoolTripReason === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.noSchoolTripReason',
            isVisible: false
        });
    } else {
        testHelpers.inputSelectTest({
            context,
            path: 'household.persons.${activePersonId}.journeys.${activeJourneyId}.noSchoolTripReason',
            value: travelBehavior.noSchoolTripReason
        });
    }

    // Test nextbutton widget
    testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: `/survey/${expectedNextSection}` });

    // Verify the trips navigation is completed when leaving the trips flow
    testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'trips',
        // Trips section is still active if the next section is not one of 'longDistance', 'end', or 'omissions'
        buttonStatus:
            expectedNextSection === 'longDistance' ||
            expectedNextSection === 'end' ||
            expectedNextSection === 'omissions' ||
            expectedNextSection === 'frequencies'
                ? 'completed'
                : 'active',
        isDisabled: false
    });
};

/********** Tests Omissions section **********/
export const fillOmissionsSectionTests = ({
    context,
    householdSize = 1,
    omissions = defaultOmissionsSection,
    nextSection: expectedNextSection = 'end'
}: CommonTestParametersModify & { omissions?: OmissionsSection; nextSection?: string }) => {
    // Verify the omissions navigation is active
    // FIXME Enable this test once it works see https://github.com/chairemobilite/od_mtl/issues/132
    /* testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'end',
        buttonStatus: 'active',
        isDisabled: false
    }); */

    // Test radio widget toddlerDaycare with conditional toddlerDaycareCustomConditional with choices yesNo
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (omissions.toddlerDaycare === null) {
        testHelpers.inputVisibleTest({ context, path: 'omissions.toddlerDaycare', isVisible: false });
    } else {
        testHelpers.inputRadioTest({ context, path: 'omissions.toddlerDaycare', value: omissions.toddlerDaycare });
    }

    // Test checkbox widget toddlerDaycareDropoff with conditional toddlerDaycareConditional with choices person14PlusCustomChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (omissions.toddlerDaycareDropoff === null) {
        testHelpers.inputVisibleTest({ context, path: 'omissions.toddlerDaycareDropoff', isVisible: false });
    } else {
        testHelpers.inputCheckboxTest({
            context,
            path: 'omissions.toddlerDaycareDropoff',
            values: omissions.toddlerDaycareDropoff
        });
    }

    // Test radio widget toddlerDaycareDropoffMode with conditional toddlerDaycareConditional with choices toddlerDaycareMode
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (omissions.toddlerDaycareDropoffMode === null) {
        testHelpers.inputVisibleTest({ context, path: 'omissions.toddlerDaycareDropoffMode', isVisible: false });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'omissions.toddlerDaycareDropoffMode',
            value: omissions.toddlerDaycareDropoffMode
        });
    }

    // Test checkbox widget toddlerDaycarePickup with conditional toddlerDaycareConditional with choices person14PlusCustomChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (omissions.toddlerDaycarePickup === null) {
        testHelpers.inputVisibleTest({ context, path: 'omissions.toddlerDaycarePickup', isVisible: false });
    } else {
        testHelpers.inputCheckboxTest({
            context,
            path: 'omissions.toddlerDaycarePickup',
            values: omissions.toddlerDaycarePickup
        });
    }

    // Test radio widget toddlerDaycarePickupMode with conditional toddlerDaycareConditional with choices toddlerDaycareMode
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (omissions.toddlerDaycarePickupMode === null) {
        testHelpers.inputVisibleTest({ context, path: 'omissions.toddlerDaycarePickupMode', isVisible: false });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'omissions.toddlerDaycarePickupMode',
            value: omissions.toddlerDaycarePickupMode
        });
    }

    // Test radio widget hasOmittedTrips with conditional hasOmittedTripsConditional with choices yesNo
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (omissions.hasOmittedTrips === null) {
        testHelpers.inputVisibleTest({ context, path: 'omissions.hasOmittedTrips', isVisible: false });
    } else {
        testHelpers.inputRadioTest({ context, path: 'omissions.hasOmittedTrips', value: omissions.hasOmittedTrips });
    }

    // Test infotext widget hasOmittedTripsIntro with conditional hasOmittedTripsSpecifyConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (omissions.hasOmittedTripsIntro === null) {
        testHelpers.waitTextVisible({ context, text: 'for your unreported trips', isVisible: false });
    } else {
        testHelpers.waitTextVisible({ context, text: omissions.hasOmittedTripsIntro });
    }

    // Test checkbox widget hasOmittedTripsActivity with conditional hasOmittedTripsSpecifyConditional with choices hasOmittedTripsActivities
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (omissions.hasOmittedTripsActivity === null) {
        testHelpers.inputVisibleTest({ context, path: 'omissions.hasOmittedTripsActivity', isVisible: false });
    } else {
        testHelpers.inputCheckboxTest({
            context,
            path: 'omissions.hasOmittedTripsActivity',
            values: omissions.hasOmittedTripsActivity
        });
    }

    // Test checkbox widget hasOmittedTripsMode with conditional hasOmittedTripsSpecifyConditional with choices hasOmittedTripsModes
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (omissions.hasOmittedTripsMode === null) {
        testHelpers.inputVisibleTest({ context, path: 'omissions.hasOmittedTripsMode', isVisible: false });
    } else {
        testHelpers.inputCheckboxTest({
            context,
            path: 'omissions.hasOmittedTripsMode',
            values: omissions.hasOmittedTripsMode
        });
    }

    // Test nextbutton widget buttonCompleteOmissionsSection
    testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: `/survey/${expectedNextSection}` });

    // Verify the end navigation is still active as we need the `end` section completed
    // FIXME Enable this test once it works see https://github.com/chairemobilite/od_mtl/issues/132
    // testHelpers.verifyNavBarButtonStatus({ context, buttonText: 'End', buttonStatus: 'active', isDisabled: false });
};

/********** Tests Longdistance section **********/
export type LongDistanceTestParameters = CommonTestParametersModify & {
    longDistanceSection?: LongDistanceSection;
};
export const fillLongDistanceSectionTests = ({
    context,
    longDistanceSection = defaultLongDistance
}: LongDistanceTestParameters) => {
    const hasTrips = longDistanceSection.madeLongDistanceTrips === 'yes';

    // Verify the omissions navigation is active as it is this section's parent
    // FIXME Enable this test once it works see https://github.com/chairemobilite/od_mtl/issues/132
    /* testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'end',
        buttonStatus: 'active',
        isDisabled: false
    }); */

    // Test radio widget householdMadeLongDistanceTripsInLastYear with choices yesNoDontKnow
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'household.madeLongDistanceTripsInLastYear',
        value: longDistanceSection.madeLongDistanceTrips
    });

    // Test range widget householdLongDistanceTripsMayAugust with conditional madeLongDistanceTripsConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (hasTrips) {
        testHelpers.inputRadioTest({
            context,
            path: 'household.longDistanceTripsMayAugust',
            value: longDistanceSection.frequencyMayAugust!
        });
    } else {
        testHelpers.inputVisibleTest({ context, path: 'household.longDistanceTripsMayAugust', isVisible: false });
    }

    // Test range widget householdLongDistanceTripsJanuaryApril with conditional madeLongDistanceTripsConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (hasTrips) {
        testHelpers.inputRadioTest({
            context,
            path: 'household.longDistanceTripsJanuaryApril',
            value: longDistanceSection.frequencyJanuaryApril!
        });
    } else {
        testHelpers.inputVisibleTest({ context, path: 'household.longDistanceTripsJanuaryApril', isVisible: false });
    }

    // Test range widget householdLongDistanceTripsSeptemberDecember with conditional madeLongDistanceTripsConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (hasTrips) {
        testHelpers.inputRadioTest({
            context,
            path: 'household.longDistanceTripsSeptemberDecember',
            value: longDistanceSection.frequencySeptemberDecember!
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.longDistanceTripsSeptemberDecember',
            isVisible: false
        });
    }

    // Test radio widget wouldLikeToParticipateToLongDistanceSurvey with conditional madeLongDistanceTripsConditional with choices yesNo
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (hasTrips) {
        testHelpers.inputRadioTest({
            context,
            path: 'household.wouldLikeToParticipateToLongDistanceSurvey',
            value: longDistanceSection.wantToParticipateInSurvey!
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.wouldLikeToParticipateToLongDistanceSurvey',
            isVisible: false
        });
    }

    // Test string widget wouldLikeToParticipateToLongDistanceSurveyContactEmail with conditional wantToParticipateInLongDistanceSurveyConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (longDistanceSection.wantToParticipateInSurvey === 'yes') {
        testHelpers.inputStringTest({
            context,
            path: 'household.wouldLikeToParticipateToLongDistanceSurveyContactEmail',
            value: longDistanceSection.wantToParticipateInSurveyEmail!
        });
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: 'household.wouldLikeToParticipateToLongDistanceSurveyContactEmail',
            isVisible: false
        });
    }

    // Test nextbutton widget buttonCompleteLongDistanceSection
    testHelpers.inputNextButtonTest({ context, text: 'Continue', nextPageUrl: '/survey/end' });

    // Verify the longDistance navigation is still active as we need the `end` section completed
    // FIXME Enable this test once it works see https://github.com/chairemobilite/od_mtl/issues/132
    // testHelpers.verifyNavBarButtonStatus({ context, buttonText: 'End', buttonStatus: 'active', isDisabled: false });
};

/********** Tests for attitudinal section **********/
export type BarriersDisabilitySection = {
    barriersDisabilityPersonCheck: 'yes' | 'no' | null;
    barriersDisabilityTripText: string | null; // Null won't check the text, otherwise validate the text here
    barriersDisabilityFrequency: string | null;
    barriersDisabilityReliability: string | null;
    barriersDisabilityWalk: string | null;
    barriersDisabilityTime: string | null;
    barriersDisabilityTransfer: string | null;
    barriersDisabilitySecurity: string | null;
    barriersDisabilityUniversalAccessibility: string | null;
    barriersDisabilityPlanning: string | null;
    barriersDisabilityCourtesy: string | null;
};

// Set defaults, with values for barriers and disability invisible
export const defaultBarriersDisabilities: BarriersDisabilitySection = {
    barriersDisabilityPersonCheck: null,
    barriersDisabilityTripText: null,
    barriersDisabilityFrequency: '0',
    barriersDisabilityReliability: '1',
    barriersDisabilityWalk: '2',
    barriersDisabilityTime: '3',
    barriersDisabilityTransfer: '4',
    barriersDisabilitySecurity: '-1',
    barriersDisabilityUniversalAccessibility: null,
    barriersDisabilityPlanning: null,
    barriersDisabilityCourtesy: null
};

export type BarriersDisabilityTestParameters = CommonTestParametersModify & {
    barriersDisabilitySection?: BarriersDisabilitySection;
};

export const fillBarriersDisabilitySectionTests = ({
    context,
    householdSize,
    barriersDisabilitySection = defaultBarriersDisabilities
}: BarriersDisabilityTestParameters) => {
    if (barriersDisabilitySection.barriersDisabilityPersonCheck === null) {
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityIsPersonAvailable', isVisible: true });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilityIsPersonAvailable',
            value: barriersDisabilitySection.barriersDisabilityPersonCheck
        });
    }

    // Test the visibility of the disability barriers questions depending on if the person is available
    if (barriersDisabilitySection.barriersDisabilityPersonCheck === 'no') {
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityFrequency', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityReliability', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityWalk', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityTime', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityTransfer', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilitySecurity', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityUniversalAccessibility', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityPlanning', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityCourtesy', isVisible: false });
        // Section is completed
        return;
    } else {
        if (barriersDisabilitySection.barriersDisabilityTripText !== null) {
            testHelpers.waitTextVisible({ context, text: barriersDisabilitySection.barriersDisabilityTripText });
        }
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityFrequency', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityReliability', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityWalk', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityTime', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityTransfer', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilitySecurity', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityUniversalAccessibility', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityPlanning', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersDisabilityCourtesy', isVisible: true });
    }

    // Fill all non-null widgets for the disability block

    // Test radio widget barriersDisabilityFrequency with conditional hasBarrierDisabilityTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersDisabilitySection.barriersDisabilityFrequency !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilityFrequency',
            value: barriersDisabilitySection.barriersDisabilityFrequency
        });
    }

    // Test radio widget barriersDisabilityReliability with conditional hasBarrierDisabilityTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersDisabilitySection.barriersDisabilityReliability !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilityReliability',
            value: barriersDisabilitySection.barriersDisabilityReliability
        });
    }

    // Test radio widget barriersDisabilityWalk with conditional hasBarrierDisabilityTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersDisabilitySection.barriersDisabilityWalk !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilityWalk',
            value: barriersDisabilitySection.barriersDisabilityWalk
        });
    }

    // Test radio widget barriersDisabilityTime with conditional hasBarrierDisabilityTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersDisabilitySection.barriersDisabilityTime !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilityTime',
            value: barriersDisabilitySection.barriersDisabilityTime
        });
    }

    // Test radio widget barriersDisabilityTransfer with conditional hasBarrierDisabilityTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersDisabilitySection.barriersDisabilityTransfer !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilityTransfer',
            value: barriersDisabilitySection.barriersDisabilityTransfer
        });
    }

    // Test radio widget barriersDisabilitySecurity with conditional hasBarrierDisabilityTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersDisabilitySection.barriersDisabilitySecurity !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilitySecurity',
            value: barriersDisabilitySection.barriersDisabilitySecurity
        });
    }

    // Test radio widget barriersDisabilityUniversalAccessibility with conditional hasBarrierDisabilityTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersDisabilitySection.barriersDisabilityUniversalAccessibility !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilityUniversalAccessibility',
            value: barriersDisabilitySection.barriersDisabilityUniversalAccessibility
        });
    }

    // Test radio widget barriersDisabilityPlanning with conditional hasBarrierDisabilityTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersDisabilitySection.barriersDisabilityPlanning !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilityPlanning',
            value: barriersDisabilitySection.barriersDisabilityPlanning
        });
    }

    // Test radio widget barriersDisabilityCourtesy with conditional hasBarrierDisabilityTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersDisabilitySection.barriersDisabilityCourtesy !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersDisabilityCourtesy',
            value: barriersDisabilitySection.barriersDisabilityCourtesy
        });
    }
};

/*********** Tests for select freq person ***********/
export type SelectFreqTestParameters = CommonTestParametersModify & {
    selectedPerson: string;
};
export const fillSelectFreqPerson = ({ context, selectedPerson }: SelectFreqTestParameters) => {
    // Test radio widget selectFreqPerson with choices hhAge16PlusCustomChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({ context, path: '_freqPersonId', value: selectedPerson });
    // Test nextbutton widget buttonCompleteSelectFreqPersonSection
    testHelpers.inputNextButtonTest({ context, text: 'Confirm', nextPageUrl: 'survey/frequencies' });
};

/********** Tests for frequencies section **********/
export type FrequenciesSection = {
    anyTripModeFrequenciesWalk: string;
    anyTripModeFrequenciesBicycle: string;
    anyTripModeFrequenciesTransit: string;
    anyTripModeFrequenciesCarPassenger: string;
    anyTripModeFrequenciesCarDriver: string | null;
};

// Set defaults if set, with car driver invisible by default
export const defaultFrequencies: FrequenciesSection = {
    anyTripModeFrequenciesWalk: '2to4daysPerWeek',
    anyTripModeFrequenciesBicycle: '2to4daysPerWeek',
    anyTripModeFrequenciesTransit: '2to4daysPerWeek',
    anyTripModeFrequenciesCarPassenger: '2to4daysPerWeek',
    anyTripModeFrequenciesCarDriver: null
};

export type FrequenciesTestParameters = CommonTestParametersModify & {
    frequencySection?: FrequenciesSection;
};

export const fillFrequenciesSectionTests = ({
    context,
    householdSize,
    frequencySection = defaultFrequencies
}: FrequenciesTestParameters) => {
    // Verify the end navigation is active as it is this section's parent
    // FIXME Enable this test once it works see https://github.com/chairemobilite/od_mtl/issues/132
    /* testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'end',
        buttonStatus: 'active',
        isDisabled: false
    }); */

    // Test infotext widget anyTripModeFrequenciesIntro
    testHelpers.waitTextVisible({
        context,
        text: 'For all your trips, regardless of the activity (work, studies, leisure, services, shopping, accompanying someone, etc.)'
    });

    // Test radio widget anyTripModeFrequenciesWalk with choices anyTripModeFrequenciesChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.anyTripModeFrequenciesWalk',
        value: frequencySection.anyTripModeFrequenciesWalk
    });

    // Test radio widget anyTripModeFrequenciesBicycle with choices anyTripModeFrequenciesChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.anyTripModeFrequenciesBicycle',
        value: frequencySection.anyTripModeFrequenciesBicycle
    });

    // Test radio widget anyTripModeFrequenciesTransit with choices anyTripModeFrequenciesChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.anyTripModeFrequenciesTransit',
        value: frequencySection.anyTripModeFrequenciesTransit
    });

    // Test radio widget anyTripModeFrequenciesCarPassenger with choices anyTripModeFrequenciesChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.anyTripModeFrequenciesCarPassenger',
        value: frequencySection.anyTripModeFrequenciesCarPassenger
    });

    // Test radio widget anyTripModeFrequenciesCarDriver with conditional hasDrivingLicenseConditional with choices anyTripModeFrequenciesChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (frequencySection.anyTripModeFrequenciesCarDriver === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'freqAttitudinal.anyTripModeFrequenciesCarDriver',
            isVisible: false
        });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'freqAttitudinal.anyTripModeFrequenciesCarDriver',
            value: frequencySection.anyTripModeFrequenciesCarDriver
        });
    }
};

/********** Tests for attitudinal section **********/
export type AttitudinalSection = {
    attitudinalOpinion: string;
    attitudinalCar: string;
    attitudinalTransitGoodQuality: string;
    attitudinalFamiliarWithTransit: string;
    attitudinalRequireHighLevel: string;
    attitudinalEasyWithoutCar: string;
    attitudinalGoodAccessImportant: string;
};

// Set defaults if set, with car driver invisible by default
export const defaultAttitudinal: AttitudinalSection = {
    attitudinalOpinion: '-2',
    attitudinalCar: '-1',
    attitudinalTransitGoodQuality: '0',
    attitudinalFamiliarWithTransit: '1',
    attitudinalRequireHighLevel: '2',
    attitudinalEasyWithoutCar: '2',
    attitudinalGoodAccessImportant: '-2'
};

export type AttitudinalTestParameters = CommonTestParametersModify & {
    attitudinalSection?: AttitudinalSection;
};

export const fillAttitudinalSectionTests = ({
    context,
    householdSize,
    attitudinalSection = defaultAttitudinal
}: AttitudinalTestParameters) => {
    // Verify the end navigation is active as it is this section's parent
    // FIXME Enable this test once it works see https://github.com/chairemobilite/od_mtl/issues/132
    /* testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'end',
        buttonStatus: 'active',
        isDisabled: false
    }); */

    // Test infotext widget attitudinalIntro
    testHelpers.waitTextVisible({
        context,
        text: 'For this set of questions, we ask you to indicate how much you agree or disagree with a specific statement.'
    });

    // Test radio widget attitudinalOpinion with choices attitudinalChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.attitudinalOpinion',
        value: attitudinalSection.attitudinalOpinion
    });

    // Test radio widget attitudinalCar with choices attitudinalChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.attitudinalCar',
        value: attitudinalSection.attitudinalCar
    });

    // Test radio widget attitudinalTransitGoodQuality with choices attitudinalChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.attitudinalTransitGoodQuality',
        value: attitudinalSection.attitudinalTransitGoodQuality
    });

    // Test radio widget attitudinalFamiliarWithTransit with choices attitudinalChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.attitudinalFamiliarWithTransit',
        value: attitudinalSection.attitudinalFamiliarWithTransit
    });

    // Test radio widget attitudinalRequiereHightLevel with choices attitudinalChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.attitudinalRequireHighLevel',
        value: attitudinalSection.attitudinalRequireHighLevel
    });

    // Test radio widget attitudinalEasyWithoutCar with choices attitudinalChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.attitudinalEasyWithoutCar',
        value: attitudinalSection.attitudinalEasyWithoutCar
    });

    // Test radio widget attitudinalGoodAccessImportant with choices attitudinalChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'freqAttitudinal.attitudinalGoodAccessImportant',
        value: attitudinalSection.attitudinalGoodAccessImportant
    });
};

/********** Tests for attitudinal section **********/
export type BarriersSection = {
    barriersVisible: boolean;
    barriersTripText: string | null; // Null won't check the text, otherwise validate the text here
    barriersFrequency: string | null;
    barriersReliability: string | null;
    barriersWalk: string | null;
    barriersTime: string | null;
    barriersTransfer: string | null;
    barriersSecurity: string | null;
    barriersPlanning: string | null;
};

// Set defaults, with values for barriers and disability invisible
export const defaultBarriers: BarriersSection = {
    barriersVisible: true,
    barriersTripText: null,
    barriersFrequency: '0',
    barriersReliability: '1',
    barriersWalk: '2',
    barriersTime: '3',
    barriersTransfer: '4',
    barriersSecurity: '0',
    barriersPlanning: '-1'
};

export type BarriersTestParameters = CommonTestParametersModify & {
    barriersSection?: BarriersSection;
};

export const fillBarriersSectionTests = ({
    context,
    householdSize,
    barriersSection = defaultBarriers
}: BarriersTestParameters) => {
    // Verify the end navigation is active as it is this section's parent
    // FIXME Enable this test once it works see https://github.com/chairemobilite/od_mtl/issues/132
    /* testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'end',
        buttonStatus: 'active',
        isDisabled: false
    }); */

    // Test the visibility of the barriers questions
    if (!barriersSection.barriersVisible) {
        testHelpers.inputVisibleTest({ context, path: 'barriersFrequency', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersReliability', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersWalk', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersTime', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersTransfer', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersSecurity', isVisible: false });
        testHelpers.inputVisibleTest({ context, path: 'barriersPlanning', isVisible: false });
    } else {
        if (barriersSection.barriersTripText !== null) {
            testHelpers.waitTextVisible({ context, text: barriersSection.barriersTripText });
        }
        testHelpers.inputVisibleTest({ context, path: 'barriersFrequency', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersReliability', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersWalk', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersTime', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersTransfer', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersSecurity', isVisible: true });
        testHelpers.inputVisibleTest({ context, path: 'barriersPlanning', isVisible: true });
    }

    // Fill all non-null values for the widgets of the barrier block

    // Test radio widget barriersFrequency with conditional hasBarrierTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersSection.barriersFrequency !== null) {
        testHelpers.inputRadioTest({ context, path: 'barriersFrequency', value: barriersSection.barriersFrequency });
    }

    // Test radio widget barriersReliability with conditional hasBarrierTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersSection.barriersReliability !== null) {
        testHelpers.inputRadioTest({
            context,
            path: 'barriersReliability',
            value: barriersSection.barriersReliability
        });
    }

    // Test radio widget barriersWalk with conditional hasBarrierTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersSection.barriersWalk !== null) {
        testHelpers.inputRadioTest({ context, path: 'barriersWalk', value: barriersSection.barriersWalk });
    }

    // Test radio widget barriersTime with conditional hasBarrierTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersSection.barriersTime !== null) {
        testHelpers.inputRadioTest({ context, path: 'barriersTime', value: barriersSection.barriersTime });
    }

    // Test radio widget barriersTransfer with conditional hasBarrierTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersSection.barriersTransfer !== null) {
        testHelpers.inputRadioTest({ context, path: 'barriersTransfer', value: barriersSection.barriersTransfer });
    }

    // Test radio widget barriersSecurity with conditional hasBarrierTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersSection.barriersSecurity !== null) {
        testHelpers.inputRadioTest({ context, path: 'barriersSecurity', value: barriersSection.barriersSecurity });
    }

    // Test radio widget barriersPlanning with conditional hasBarrierTripConditional with choices barriersChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (barriersSection.barriersPlanning !== null) {
        testHelpers.inputRadioTest({ context, path: 'barriersPlanning', value: barriersSection.barriersPlanning });
    }
};

/********** Tests end section **********/
export type EndSection = {
    householdType: string | null;
    householdTypeSpecify: string | null;
    householdPluginHybridCarNumber: string | null;
    householdElectricCarNumber: string | null;
    householdIncome: string;
    didRespondForCorrectAssignedDate: string | null;
    didNotRespondForCorrectAssignedDateReasons: string[] | null;
    wouldLikeToParticipateInOtherSurveysChaireMobilite: 'yes' | 'no';
    wouldLikeToParticipateInOtherSurveysChaireMobiliteContactEmail?: string | null;
    householdCommentsOnSurvey?: string;
    burdenQuestionsVisible?: boolean;
    endInterestOfTheSurvey?: number;
    endTimeSpentAnswering?: string;
    endDurationOfTheSurvey?: number;
    endDifficultyOfTheSurvey?: number;
    endBurdenOfTheSurvey?: number;
    endConsideredAbandoningSurvey?: 'yes' | 'no' | 'dontKnow';
};

export const defaultEnd: EndSection = {
    householdType: null,
    householdTypeSpecify: null,
    householdIncome: '100000_149999',
    householdPluginHybridCarNumber: '2',
    householdElectricCarNumber: '0',
    didRespondForCorrectAssignedDate: null,
    didNotRespondForCorrectAssignedDateReasons: null,
    wouldLikeToParticipateInOtherSurveysChaireMobilite: 'yes',
    wouldLikeToParticipateInOtherSurveysChaireMobiliteContactEmail: 'test@example.com',
    householdCommentsOnSurvey: 'Test',

    // Optional questions are not filled by default
    burdenQuestionsVisible: false
};

export type EndTestParameters = CommonTestParametersModify & {
    endSection?: EndSection;
};

export const fillEndSectionTests = ({ context, endSection = defaultEnd }: EndTestParameters) => {
    // Verify the omissions navigation is active as it is this section's parent
    // FIXME Enable this test once it works see https://github.com/chairemobilite/od_mtl/issues/132
    /* testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'end',
        buttonStatus: 'active',
        isDisabled: false
    }); */

    // Test radio widget householdType with conditional householdTypeConditional with choices householdType
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (endSection.householdType === null) {
        testHelpers.inputVisibleTest({ context, path: 'household.type', isVisible: false });
    } else {
        testHelpers.inputRadioTest({ context, path: 'household.type', value: endSection.householdType });
    }

    // Test radio widget householdTypeSpecify with conditional householdTypeSpecifyConditional with choices householdTypeSpecify
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (endSection.householdTypeSpecify === null) {
        testHelpers.inputVisibleTest({ context, path: 'household.typeSpecify', isVisible: false });
    } else {
        testHelpers.inputRadioTest({ context, path: 'household.typeSpecify', value: endSection.householdTypeSpecify });
    }

    // Test radionumber widget householdPluginHybridCarNumber with conditional householdHasCars
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (endSection.householdPluginHybridCarNumber === null) {
        testHelpers.inputVisibleTest({ context, path: 'household.pluginHybridCarNumber', isVisible: false });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.pluginHybridCarNumber',
            value: endSection.householdPluginHybridCarNumber
        });
    }

    // Test radionumber widget householdElectricCarNumber with conditional householdHasCars
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (endSection.householdElectricCarNumber === null) {
        testHelpers.inputVisibleTest({ context, path: 'household.electricCarNumber', isVisible: false });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'household.electricCarNumber',
            value: endSection.householdElectricCarNumber
        });
    }

    // Test select widget householdIncome with choices householdIncomeChoices
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputSelectTest({ context, path: 'household.income', value: endSection.householdIncome });

    // Test radio widget didRespondForCorrectAssignedDate with conditional didRespondForCorrectAssignedDateConditional with choices didRespondForCorrectAssignedDateChoices
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (endSection.didRespondForCorrectAssignedDate === null) {
        testHelpers.inputVisibleTest({ context, path: 'end.didRespondForCorrectAssignedDate', isVisible: false });
    } else {
        testHelpers.inputRadioTest({
            context,
            path: 'end.didRespondForCorrectAssignedDate',
            value: endSection.didRespondForCorrectAssignedDate
        });
    }

    // Test checkbox widget didNotRespondForCorrectAssignedDateReasons with conditional didNotRespondForCorrectAssignedDateConditional with choices didNotRespondForCorrectAssignedDateReasons
    /* @link file://./../src/survey/common/conditionals.tsx */
    /* @link file://./../src/survey/common/choices.tsx */
    if (endSection.didNotRespondForCorrectAssignedDateReasons === null) {
        testHelpers.inputVisibleTest({
            context,
            path: 'end.didNotRespondForCorrectAssignedDateReasons',
            isVisible: false
        });
    } else {
        testHelpers.inputCheckboxTest({
            context,
            path: 'end.didNotRespondForCorrectAssignedDateReasons',
            values: endSection.didNotRespondForCorrectAssignedDateReasons
        });
    }

    // Test radio widget wouldLikeToParticipateInOtherSurveysChaireMobilite with choices yesNo
    /* @link file://./../src/survey/common/choices.tsx */
    testHelpers.inputRadioTest({
        context,
        path: 'end.wouldLikeToParticipateInOtherSurveysChaireMobilite',
        value: endSection.wouldLikeToParticipateInOtherSurveysChaireMobilite
    });

    // Test string widget wouldLikeToParticipateInOtherSurveysChaireMobiliteContactEmail with conditional wantToParticipateInOtherSurveysChaireMobiliteConditional
    /* @link file://./../src/survey/common/conditionals.tsx */
    if (endSection.wouldLikeToParticipateInOtherSurveysChaireMobilite === 'yes') {
        if (typeof endSection.wouldLikeToParticipateInOtherSurveysChaireMobiliteContactEmail === 'string') {
            testHelpers.inputStringTest({
                context,
                path: 'end.wouldLikeToParticipateInOtherSurveysChaireMobiliteContactEmail',
                value: endSection.wouldLikeToParticipateInOtherSurveysChaireMobiliteContactEmail
            });
        }
        // Otherwise, we expect the field to have been filled with the default email
    } else {
        testHelpers.inputVisibleTest({
            context,
            path: 'end.wouldLikeToParticipateInOtherSurveysChaireMobiliteContactEmail',
            isVisible: false
        });
    }

    // Test text widget householdCommentsOnSurvey
    testHelpers.inputStringTest({
        context,
        path: 'end.commentsOnSurvey',
        value: endSection.householdCommentsOnSurvey || ''
    });

    if (endSection.burdenQuestionsVisible) {
        // Test infotext widget optionalIntroText
        testHelpers.waitTextVisible({
            context,
            text: 'The next questions are optional and are added for research purposes. You can complete the interview without answering them.'
        });

        // Test range widget endInterestOfTheSurvey
        if (endSection.endInterestOfTheSurvey !== undefined) {
            testHelpers.inputRangeTest({
                context,
                path: 'end.interestOfTheSurvey',
                value: endSection.endInterestOfTheSurvey,
                sliderColor: 'red-yellow-green'
            });
        } else {
            // FIXME Test visibility of widget when it is possible (https://github.com/chairemobilite/evolution/issues/1710)
        }

        // Test number widget endTimeSpentAnswering
        if (endSection.endTimeSpentAnswering !== undefined) {
            testHelpers.inputStringTest({
                context,
                path: 'end.timeSpentAnswering',
                value: endSection.endTimeSpentAnswering
            });
        } else {
            testHelpers.inputVisibleTest({
                context,
                path: 'end.timeSpentAnswering',
                isVisible: true
            });
        }

        // Test range widget endDurationOfTheSurvey
        if (endSection.endDurationOfTheSurvey !== undefined) {
            testHelpers.inputRangeTest({
                context,
                path: 'end.durationOfTheSurvey',
                value: endSection.endDurationOfTheSurvey,
                sliderColor: 'green-yellow-red'
            });
        } else {
            // FIXME Test visibility of widget when it is possible (https://github.com/chairemobilite/evolution/issues/1710)
        }

        // Test range widget endDifficultyOfTheSurvey
        if (endSection.endDifficultyOfTheSurvey !== undefined) {
            testHelpers.inputRangeTest({
                context,
                path: 'end.difficultyOfTheSurvey',
                value: endSection.endDifficultyOfTheSurvey,
                sliderColor: 'green-yellow-red'
            });
        } else {
            // FIXME Test visibility of widget when it is possible (https://github.com/chairemobilite/evolution/issues/1710)
        }

        // Test range widget endBurdenOfTheSurvey
        if (endSection.endBurdenOfTheSurvey !== undefined) {
            testHelpers.inputRangeTest({
                context,
                path: 'end.burdenOfTheSurvey',
                value: endSection.endBurdenOfTheSurvey,
                sliderColor: 'green-yellow-red'
            });
        } else {
            // FIXME Test visibility of widget when it is possible (https://github.com/chairemobilite/evolution/issues/1710)
        }

        // Test radio widget endConsideredAbandoningSurvey with choices yesNoDontKnow
        /* @link file://./../src/survey/common/choices.tsx */
        if (endSection.endConsideredAbandoningSurvey !== undefined) {
            testHelpers.inputRadioTest({
                context,
                path: 'end.consideredAbandoningSurvey',
                value: endSection.endConsideredAbandoningSurvey
            });
        } else {
            testHelpers.inputVisibleTest({
                context,
                path: 'end.consideredAbandoningSurvey',
                isVisible: true
            });
        }
    } else {
        // Check that all burden questions are invisible
        testHelpers.waitTextVisible({
            context,
            text: 'The next questions are optional and are added for research purposes. You can complete the interview without answering them.',
            isVisible: false
        });

        // Test range widget endInterestOfTheSurvey
        testHelpers.inputVisibleTest({
            context,
            path: 'end.interestOfTheSurvey',
            isVisible: false
        });

        // Test number widget endTimeSpentAnswering
        testHelpers.inputVisibleTest({
            context,
            path: 'end.timeSpentAnswering',
            isVisible: false
        });

        testHelpers.inputVisibleTest({
            context,
            path: 'end.durationOfTheSurvey',
            isVisible: false
        });

        testHelpers.inputVisibleTest({
            context,
            path: 'end.difficultyOfTheSurvey',
            isVisible: false
        });

        testHelpers.inputVisibleTest({
            context,
            path: 'end.burdenOfTheSurvey',
            isVisible: false
        });

        testHelpers.inputVisibleTest({
            context,
            path: 'end.consideredAbandoningSurvey',
            isVisible: false
        });
    }

    // Test nextbutton widget buttonCompleteInterviewWithCompleteSection
    testHelpers.inputNextButtonTest({ context, text: 'Complete the interview', nextPageUrl: '/survey/completed' });

    // Verify the end navigation is completed
    // FIXME Enable this test once it works see https://github.com/chairemobilite/od_mtl/issues/132
    /*
    testHelpers.verifyNavBarButtonStatus({
        context,
        buttonText: 'end',
        buttonStatus: 'activeAndCompleted',
        isDisabled: false
    }); */
};

const artmPanelButtonLabelEn = 'Join « Let\'s talk mobility » panel';
const artmPanelUrlEn = 'https://parlonsmobilite.quebec/en';
const artmPanelTitleEn = /Let['\u2019]s talk mobility/i;

/** Opens the ARTM panel link in a new tab and checks the external page loads correctly. */
export const buttonARTMPanelTest = ({ context }: CommonTestParametersModify) => {
    test(`Click "${artmPanelButtonLabelEn}" opens ARTM panel in a new tab`, async () => {
        const button = context.page.getByRole('button', { name: artmPanelButtonLabelEn });
        await button.scrollIntoViewIfNeeded();

        const popupPromise = context.page.waitForEvent('popup');
        await button.click();
        const popup = await popupPromise;

        await popup.waitForURL(/parlonsmobilite\.quebec\/en\/?/, { timeout: 45000 });
        await popup.waitForLoadState('domcontentloaded');

        const documentResponse = await context.page.request.get(artmPanelUrlEn);
        expect(documentResponse.status()).toBe(200);

        await expect(popup).toHaveTitle(artmPanelTitleEn);

        await popup.close();
    });
};

/********** Tests completed section **********/
export const fillCompletedSectionTests = ({ context, householdSize = 1 }: CommonTestParametersModify) => {
    // Test infotext widget completedText
    testHelpers.waitTextVisible({ context, text: 'Thank you for your participation!' });
    testHelpers.waitTextVisible({
        context,
        text: 'Thank you for taking the time to complete this questionnaire.'
    });

    // Test custom widget buttonARTMPanel (opens external site in a new tab)
    buttonARTMPanelTest({ context });
};
