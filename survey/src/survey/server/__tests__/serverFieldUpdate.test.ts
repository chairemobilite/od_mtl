
import moment from 'moment-business-days';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import { ObjectReadableMock } from 'stream-mock';
import updateCallbacks, * as serverFieldUpdateFct from '../serverFieldUpdate';
import _cloneDeep from 'lodash/cloneDeep';
import each from 'jest-each';
import { getPreFilledResponseByPath } from 'evolution-backend/lib/services/interviews/serverFieldUpdate';
import { InterviewAttributes } from 'evolution-common/lib/services/questionnaire/types';
import interviewsDbQueries from 'evolution-backend/lib/models/interviews.db.queries';
import participantsDbQueries from 'evolution-backend/lib/models/participants.db.queries';
import RandomUtils from 'chaire-lib-common/lib/utils/RandomUtils';
import { getTransitSummary } from 'evolution-backend/lib/services/routing';
import '../serverValidations'; // Make sure access code format validation is registered

jest.useFakeTimers();

jest.mock('evolution-backend/lib/models/interviews.db.queries', () => ({
    getInterviewsStream: jest.fn().mockImplementation(() => new ObjectReadableMock([]))
}));
const getInterviewStreamMock = interviewsDbQueries.getInterviewsStream as jest.MockedFunction<typeof interviewsDbQueries.getInterviewsStream>;
jest.mock('evolution-backend/lib/models/participants.db.queries', () => ({
    getById: jest.fn().mockResolvedValue({ username: '1111-1111-H1A 1A1' })
}));
const getParticipantByIdMock = participantsDbQueries.getById as jest.MockedFunction<typeof participantsDbQueries.getById>;

jest.mock('chaire-lib-common/lib/utils/RandomUtils', () => ({
    randomFromDistribution: jest.fn()
}));
const randomMock = RandomUtils.randomFromDistribution as jest.MockedFunction<typeof RandomUtils.randomFromDistribution>;

jest.mock('evolution-backend/lib/services/interviews/serverFieldUpdate', () => ({
    getPreFilledResponseByPath: jest.fn().mockResolvedValue({})
}));
const preFilledMock = getPreFilledResponseByPath as jest.MockedFunction<typeof getPreFilledResponseByPath>;
jest.mock('evolution-backend/lib/services/routing', () => ({
    getTransitSummary: jest.fn()
}));
const summaryMock = getTransitSummary as jest.MockedFunction<typeof getTransitSummary>;

const baseInterview: InterviewAttributes = {
    response: {
        household: {
            size: 1,
            tripsDate: '2022-09-26',
            persons: {
                a12345: {
                    age: 56,
                    gender: 'female',
                    occupation: 'fullTimeStudent',
                    journeys: {
                        j1: {
                            _sequence: 1,
                            _uuid: 'j1',
                            personDidTrips: 'yes',
                            visitedPlaces: {
                                p1: {
                                    geography: { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.1, 45.1] }, properties: { lastAction: 'shortcut' }},
                                    activity: 'service',
                                    arrivalTime: 42900,
                                    departureTime: 45000,
                                    nextPlaceCategory: 'visitedAnotherPlace'
                                } as any,
                                p2: {
                                    geography: { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.3, 45.0] }, properties: { lastAction: 'shortcut' }},
                                    activity: 'service',
                                    arrivalTime: 46800,
                                    departureTime: 54000,
                                    nextPlaceCategory: 'visitedAnotherPlace'
                                } as any
                            },
                            trips: {
                                t1: {
                                    _originVisitedPlaceUuid: 'p1',
                                    _destinationVisitedPlaceUuid: 'p2',
                                    segments: {
                                        s1: {
                                            _sequence: 1,
                                            mode: 'transitBus'
                                        }
                                    }
                                }
                            }
                        }
                    }
                } as any
            }
        } as any,
        _previousDay: '2022-09-12',
        _activePersonId: 'a12345'
    },
    id: 1,
    uuid: 'arbitrary',
    participant_id: 1,
    is_completed: false,
    validations: {},
    is_valid: true
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('access code update', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        config.postalCodeRegion = 'quebec';
        config.accessCodeFormat = '0000-0000';
    });

    const updateCallback = (updateCallbacks.find((callback) => callback.field === 'accessCodeConfirm') as any).callback;
    
    test('properly formatted access code, with data', async () => {
        const interview = _cloneDeep(baseInterview);

        // Prepare data to return
        const prefillData = {
            'home.address': '123 Main St',
            'home.city': 'Montreal',
            'home.postalCode': 'H1A 1A1',
            'home._addressIsPrefilled': true
        }
        preFilledMock.mockResolvedValueOnce(prefillData);
        interview.response.accessCode = '1111-1111';
        const updateResult = await updateCallback(interview, true);

        expect(preFilledMock).toHaveBeenCalledWith('1111-1111', interview);
        expect(updateResult).toEqual({ ...prefillData, _accessCodeConfirmed: true });
    });

    each([
        ['11111111', '1111-1111'],
        ['1111 1111', '1111-1111'],
        ['1111  1111', '1111-1111'],
    ]).test('access code to reformat, without data, so no confirm %s', async (accessCode, expected) => {
        const interview = _cloneDeep(baseInterview);
        interview.response.accessCode = accessCode;
        // Fill the partial sample to avoid computing them here
        interview.response.ep = { exclusive: 'mtmd', commonTrip: true, sameMode: false };
        preFilledMock.mockResolvedValueOnce({});

        const updateResult = await updateCallback(interview, true);
        expect(preFilledMock).toHaveBeenCalledWith(expected, interview);
        expect(updateResult).toEqual({ accessCode: expected, _accessCodeConfirmed: false });
    });

    test('undefined access code', async() => {
        const interview = _cloneDeep(baseInterview);
        interview.response.accessCode = undefined;

        expect(await updateCallback(interview, undefined)).toEqual({ });
        expect(preFilledMock).not.toHaveBeenCalled();
    });

    test('invalid access code', async() => {
        const interview = _cloneDeep(baseInterview);
        interview.response.accessCode = 'invalid';

        expect(await updateCallback(interview, true)).toEqual({ });
        expect(preFilledMock).not.toHaveBeenCalled();
    });

    test('already confirmed access code', async() => {
        const interview = _cloneDeep(baseInterview);
        interview.response._accessCodeConfirmed = true;
        interview.response.accessCode = '1111-1111';

        expect(await updateCallback(interview, true)).toEqual({ });
        expect(preFilledMock).not.toHaveBeenCalled();
    });

    test('error in get prefilled', async () => {
        const interview = _cloneDeep(baseInterview);
        interview.response.accessCode = '11111111';

        preFilledMock.mockRejectedValueOnce(new Error('Error getting prefilled data'));
        const updateResult = await updateCallback(interview, true);
        expect(preFilledMock).toHaveBeenCalledWith('1111-1111', interview);
        expect(updateResult).toEqual({ });
    });

    test.each([
        { 
            title: 'ep.exclusive, ep.commonTrip and ep.sameMode already set',
            interviewResponseData: { ep: { exclusive: 'freqBarriers', commonTrip: true, sameMode: false }, _assignedWeekDayIso: 1 /* monday */ },
            prefillData: { 'home.address': '123 Main St' },
            randomValues: [],
            expected: { 'home.address': '123 Main St', 'home._addressIsPrefilled': true }
        },
        {
            title: 'eps in the prefill data',
            prefillData: { 'home.address': '123 Main St', 'home.preData': { 'ep.exclusive': 'omission', 'ep.commonTrip': false, 'ep.sameMode': true } },
            randomValues: [],
            expected: { 'home.address': '123 Main St', 'home._addressIsPrefilled': true, 'home.preData': { 'ep.exclusive': 'omission', 'ep.commonTrip': false, 'ep.sameMode': true }, 'ep.exclusive': 'omission', 'ep.commonTrip': false, 'ep.sameMode': true }
        },
        {
            title: 'no previous or prefilled data, code unconfirmed by participant, no prefill',
            prefillData: {},
            randomValues: [],
            expected: { _accessCodeConfirmed: false }
        },
        {
            title: 'no previous or prefilled data, code confirmed by participant, should calculate',
            interviewResponseData: { accessCodeIsCorrect: ['accessCodeConfirmOk'], _assignedWeekDayIso: 1 /* monday */ },
            prefillData: {},
            randomValues: [0.4, 0.32, 0.64],
            expected: { 'ep.exclusive': 'paidParking', 'ep.commonTrip': true, 'ep.sameMode': false }
        },
        {
            title: 'some previous and prefilled eps',
            interviewResponseData: { ep: { exclusive: 'omission' }, _assignedWeekDayIso: 1 /* monday */ },
            prefillData: { 'home.preData': { 'ep.commonTrip': false } },
            randomValues: [0.4],
            expected: { 'home.preData': { 'ep.commonTrip': false }, 'ep.commonTrip': false, 'ep.sameMode': true }
        },
        {
            title: 'convert prefilled eps to valid booleish values',
            interviewResponseData: { ep: { exclusive: 'omission' }, _assignedWeekDayIso: 1 /* monday */ },
            prefillData: { 'home.preData': { 'ep.commonTrip': 'no', 'ep.sameMode': 'true' } },
            randomValues: [],
            expected: { 'home.preData': { 'ep.commonTrip': 'no', 'ep.sameMode': 'true' }, 'ep.commonTrip': false, 'ep.sameMode': true }
        },
        {
            title: 'calculate eps when not valid booleish values or invalid current value',
            interviewResponseData: { ep: { exclusive: 'invalidValue' }, _assignedWeekDayIso: 1 /* monday */ },
            prefillData: { 'home.preData': { 'ep.commonTrip': 'hello', 'ep.sameMode': 234 } },
            randomValues: [0, 0.5, 0.7],
            expected: { 'home.preData': { 'ep.commonTrip': 'hello', 'ep.sameMode': 234 }, 'ep.exclusive': 'householdType', 'ep.commonTrip': true, 'ep.sameMode': false }
        },
        {
            title: 'use different probabilities for weekends',
            interviewResponseData: { ep: { exclusive: 'invalidValue' }, _assignedWeekDayIso: 6 /* saturday */ },
            prefillData: { 'home.preData': { } },
            randomValues: [1, 0.2, 0.7],
            expected: { 'home.preData': { }, 'ep.exclusive': 'householdType', 'ep.commonTrip': true, 'ep.sameMode': false }
        },
        {
            title: 'sameMode and commonTrip 0 when exclusive is mtmd',
            interviewResponseData: { _assignedWeekDayIso: 2 /* tuesday */ },
            prefillData: { 'home.preData': { } },
            randomValues: [0.9998, 0.2, 0.3],
            expected: { 'home.preData': { }, 'ep.exclusive': 'mtmd', 'ep.commonTrip': false, 'ep.sameMode': false }
        },
    ])('test the partial sample initialization with case $title', async ({ interviewResponseData, prefillData, randomValues, expected }) => {
        // Assign the interview response data for the test case, after setting an arbitrary test access code
        const interview = _cloneDeep(baseInterview);
        interview.response.accessCode = '1111-1111';
        if (interviewResponseData !== undefined) {
            Object.assign(interview.response, interviewResponseData);
        }
        
        // Mock the random function to return the specified values for the test case
        const randomMock = jest.spyOn(Math, 'random');
        randomValues.forEach((value, index) => {
            randomMock.mockReturnValueOnce(value);
        });

        // Mock the getPrefilledForAccessCode to return the prefillData for the test case
        preFilledMock.mockResolvedValueOnce(prefillData);

        // Call the update callback and check the result
        const updateResult = await updateCallback(interview, true);
        // Random mock should have been called only if partial sample were necessary
        expect(randomMock).toHaveBeenCalledTimes(randomValues.length);
        expect(updateResult).toEqual({ _accessCodeConfirmed: true, ...expected });

        // Restore the original Math.random function        
        randomMock.mockRestore();
    });

    test.each([
        { title: 'RA1', expected: 1, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'Point', coordinates: [-73.5636531, 45.4998788] } } },
        { title: 'RA8', expected: 8, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'Point', coordinates: [-73.6890569, 45.2877987] } } },
        { title: 'outside zone', expected: null, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'Point', coordinates: [-72.9151298, 45.2640302] } } }
    ])('test home region assignation with geometry $title', async ({ expected, geography }) => {
        const interview = _cloneDeep(baseInterview);
        interview.response.accessCode = '1111-1111';

        // Prepare data to return
        const prefillData = {
            'home.address': '123 Main St',
            'home.city': 'Montreal',
            'home.postalCode': 'H1A 1A1',
            'home._addressIsPrefilled': true,
            'home.geography': geography
        }
        preFilledMock.mockResolvedValueOnce(prefillData);
        const updateResult = await updateCallback(interview, true);

        expect(preFilledMock).toHaveBeenCalledWith('1111-1111', interview);
        expect(updateResult['home.RA']).toEqual(expected);
    });

});

describe('home geography update', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    })
    const updateCallback = (updateCallbacks.find((callback) => callback.field === 'home.geography') as any).callback;

    test.each([
        { title: 'RA1', expected: 1, expectedZat: 20, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'Point', coordinates: [-73.5636531, 45.4998788] } } },
        { title: 'RA8', expected: 8, expectedZat: 1295, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'Point', coordinates: [-73.6890569, 45.2877987] } } },
        { title: 'outside zone', expected: null, expectedZat: null, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'Point', coordinates: [-72.9151298, 45.2640302] } } },
        { title: 'not a point', expected: null, expectedZat: null, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'LineString', coordinates: [[-72.9151298, 45.2640302], [-72.92, 45.26], [-72.88, 45.44], [-72.234, 45.123]] } } },
        { title: 'not a geojson feature', expected: null, expectedZat: null, geography: 'a string value' },
        { title: 'undefined', expected: null, expectedZat: null, geography: undefined }
    ])('test home geography update: $title', async ({ expected, geography, expectedZat }) => {
        const interview = _cloneDeep(baseInterview);

        const updateResult = await updateCallback(interview, geography);

        expect(updateResult['home.RA']).toEqual(expected);
        expect(updateResult['home.zat']).toEqual(expectedZat);
    });
});

describe('test survey day assignation', function () {

    beforeEach(() => {
        jest.clearAllMocks();
    })
    const updateCallback = (updateCallbacks.find((callback) => callback.field === '_previousDay') as any).callback;

    test('Day already assigned', async () => {
        const interview = _cloneDeep(baseInterview);
        interview.response._assignedDay = interview.response._previousDay;
        expect(await updateCallback(interview, interview.response._previousDay)).toEqual({});
        expect(randomMock).not.toHaveBeenCalled();
    });

    test('No data for days, should be previous day', async () => {
        // Prepare less than 500 interviews to be returned for the assigned day update
        const interviews: any[] = [];
        interviews.push({ response: { _assignedDay: '2022-09-09' } as any});
        interviews.push({ response: { _assignedDay: '2022-09-09' } as any});
        interviews.push({ response: { _assignedDay: '2022-09-09' } as any});
        interviews.push({ response: { } as any});
        getInterviewStreamMock.mockReturnValue(new ObjectReadableMock(interviews) as any);

        // Update the assigned day rates
        await serverFieldUpdateFct.updateAssignedDayRates();

        // Validate call to get assigned day rates, the filter should be with a completed at data, for completed and not invalid interviews
        expect(getInterviewStreamMock).toHaveBeenCalledTimes(1);
        expect(getInterviewStreamMock).toHaveBeenCalledWith({ 
            filters: { 'response._completedAt': expect.anything(), 'response._isCompleted': { value: true }, 'is_valid': { value: false, op: 'not' } },
            select: { responseType: 'correctedIfAvailable', includeAudits: false }
        });
        
        // Do the update callback with those data
        const interview = _cloneDeep(baseInterview);
        expect(await updateCallback(interview, interview.response._previousDay)).toEqual({ '_assignedDay': interview.response._previousDay, '_assignedWeekDayIso': 1 /* monday */ });
        expect(randomMock).not.toHaveBeenCalled();
    });

    test('No data for days, but previous days is sunday and is possible', async () => {
        randomMock.mockReturnValue(2);

        const interview = _cloneDeep(baseInterview);
        // Previous day is sunday, should not call random as there are assigned days on weekends.
        expect(await updateCallback(interview, '2022-09-11')).toEqual({ '_assignedDay': '2022-09-11', '_assignedWeekDayIso': 7 /* sunday */ });
        expect(randomMock).not.toHaveBeenCalled();
    });

    test('Should be called with probabilities, when more than 500 days', async() => {
        // Return 20 for 2 previous days (sunday, saturday, which will give higher probabilities for friday), 100 last friday, 400 thursday, 400 wednesday
        const interviews: any[] = [];
        for (let i = 0; i < 20; i++) {
            interviews.push({ response: { _assignedDay: '2024-09-22' }});
        };
        for (let i = 0; i < 20; i++) {
            interviews.push({ response: { _assignedDay: '2024-09-21' }});
        };
        for (let i = 0; i < 100; i++) {
            interviews.push({ response: { _assignedDay: '2024-09-20' }});
        };
        for (let i = 0; i < 400; i++) {
            interviews.push({ response: { _assignedDay: '2024-09-19' }});
        };
        for (let i = 0; i < 400; i++) {
            interviews.push({ response: { _assignedDay: '2024-09-18' }});
        };
        getInterviewStreamMock.mockReturnValue(new ObjectReadableMock(interviews) as any);

        // Update the assigned day rates
        await serverFieldUpdateFct.updateAssignedDayRates();

        // Return 3 days ago
        randomMock.mockReturnValue(2);

        // Use a previous day of sunday
        const interview = _cloneDeep(baseInterview);
        interview.response._previousDay = '2024-09-22';
        expect(await updateCallback(interview, '2024-09-22')).toEqual({ '_assignedDay': '2024-09-20', '_assignedWeekDayIso': 5 /* friday */ });
        expect(randomMock).toHaveBeenCalledTimes(1);
        const randomParams = randomMock.mock.calls[0];
        // weekend should not have high probability
        expect(randomParams[0][0]).toBeGreaterThan(0);
        expect(randomParams[0][1]).toBeGreaterThan(0);
        expect(randomParams[0][2]).toBeGreaterThan(0);
        // 2 days ago should have higher probability
        expect(randomParams[0][2]).toBeGreaterThan(randomParams[0][0]);
        expect(randomParams[0][2]).toBeGreaterThan(randomParams[0][1]);
        // thursday should have a probability
        expect(randomParams[0][3]).toBeGreaterThan(0);
        expect(randomParams[2]).toEqual((randomParams[0] as number[]).reduce((sum, current) => sum + current, 0));
    });

    test('With a holiday', async() => {
        // Add a holiday for october 10, 2022
        moment.updateLocale('en', {
            holidays: ['2022-10-10'],
            holidayFormat: 'YYYY-MM-DD' ,
        });
        // Return 200 for previous day (monday), 300 last friday, 200 wednesday, 200 tuesday
        const interviews: any[] = [];
        for (let i = 0; i < 200; i++) {
            interviews.push({ response: { _assignedDay: '2024-09-23' }});
        };
        for (let i = 0; i < 300; i++) {
            interviews.push({ response: { _assignedDay: '2024-09-20' }});
        };
        for (let i = 0; i < 200; i++) {
            interviews.push({ response: { _assignedDay: '2024-09-19' }});
        };
        for (let i = 0; i < 200; i++) {
            interviews.push({ response: { _assignedDay: '2024-09-18' }});
        };
        getInterviewStreamMock.mockReturnValue(new ObjectReadableMock(interviews) as any);

        randomMock.mockReturnValue(3);

        // Use a holiday as previous day
        const interview = _cloneDeep(baseInterview);
        interview.response._previousDay = '2022-10-10';
        expect(await updateCallback(interview, interview.response._previousDay)).toEqual({ '_assignedDay': '2022-10-07', '_assignedWeekDayIso': 5 /* friday */ });
       
        expect(randomMock).toHaveBeenCalledTimes(1);
        const randomParams = randomMock.mock.calls[0];
        // Monday should be 0 (holiday), sunday and saturday should have lower probabilities than friday (3 days ago)
        expect(randomParams[0][0]).toEqual(0);
        expect(randomParams[0][1]).toBeGreaterThan(0);
        expect(randomParams[0][2]).toBeGreaterThan(0);
        // 3 days ago should have higher probability
        expect(randomParams[0][3]).toBeGreaterThan(randomParams[0][0]);
        expect(randomParams[0][3]).toBeGreaterThan(randomParams[0][1]);
        expect(randomParams[0][3]).toBeGreaterThan(randomParams[0][2]);
        expect(randomParams[2]).toEqual((randomParams[0] as number[]).reduce((sum, current) => sum + current, 0));
    });

});

describe('test complete survey', function () {

    beforeEach(() => {
        jest.clearAllMocks();
    })
    const updateCallback = (updateCallbacks.find((callback) => callback.field === '_interviewFinished') as any).callback;

    test('_interviewFinished is not `true`', async () => {
        const interview = _cloneDeep(baseInterview);
        expect(await updateCallback(interview, 'somestring')).toEqual({});
    });

    test('Interview not set as completed', async () => {
        const interview = _cloneDeep(baseInterview);
        expect(await updateCallback(interview, true)).toEqual({ '_isCompleted': true, '_completedAt': expect.any(Number) });
    });

    test('Interview already set as completed', async () => {
        const interview = _cloneDeep(baseInterview);
        interview.response._isCompleted = true;
        interview.response._completedAt = 1234567890; // Arbitrary timestamp
        expect(await updateCallback(interview, true)).toEqual({});
    });

});

describe('visited place geography update', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    })
    const updateCallback = (updateCallbacks.find((callback) => (callback.field as {regex: string}).regex !== undefined && (callback.field as {regex: string}).regex.includes('visitedPlaces') && (callback.field as {regex: string}).regex.includes('geography')) as any).callback;

    test.each([
        { title: 'zat 20', expected: 20, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'Point', coordinates: [-73.5636531, 45.4998788] } } },
        { title: 'zat 1295', expected: 1295, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'Point', coordinates: [-73.6890569, 45.2877987] } } },
        { title: 'outside zone', expected: null, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'Point', coordinates: [-72.9151298, 45.2640302] } } },
        { title: 'not a point', expected: null, geography: { type: 'Feature', properties: { lastAction: 'preGeocoded' }, geometry: { type: 'LineString', coordinates: [[-72.9151298, 45.2640302], [-72.92, 45.26], [-72.88, 45.44], [-72.234, 45.123]] } } },
        { title: 'not a geojson feature', expected: null, geography: 'a string value' },
        { title: 'undefined', expected: null, geography: undefined }
    ])('test visited place geography update: $title', async ({ expected, geography }) => {
        const interview = _cloneDeep(baseInterview);
        const basePath = 'household.persons.a12345.journeys.j1.visitedPlaces.p2';
        const updateResult = await updateCallback(interview, geography, `${basePath}.geography`);

        expect(updateResult[`${basePath}.zat`]).toEqual(expected);
    });
});

describe('test transit summary generation', function () {
    const updateCallback = (updateCallbacks.find((callback) => (callback.field as {regex: string}).regex !== undefined && (callback.field as {regex: string}).regex.includes('modePre')) as any).callback;
    const registerUpdateOperationMock = jest.fn();
    let interview = _cloneDeep(baseInterview);;

    beforeEach(() => {
        jest.clearAllMocks();
        // Make sure the assigned day is set
        interview = _cloneDeep(baseInterview);
        interview.response._assignedDay = '2022-09-26'; // A monday
        config.trRoutingScenarios = {
            SE: 'ScenarioDeSemaine',
            SA: 'ScenarioDuSamedi',
            DI: 'ScenarioDuDimanche'
        };
    });

    test('Non transit mode', async () => {
        expect(await updateCallback(interview, 'carPassenger', 'household.persons.a12345.journeys.j1.trips.t1.segments.s1.modePre', registerUpdateOperationMock))
            .toEqual({ ['household.persons.a12345.journeys.j1.trips.t1.segments.s1.trRoutingResult']: undefined });
        expect(registerUpdateOperationMock).not.toHaveBeenCalled();
    });

    test('Transit data', async () => {
        const response = {
            status: 'success' as const,
            nbRoutes: 1,
            lines: [
                {
                    lineUuid: 'luuid',
                    lineShortname: 'lsn',
                    lineLongname: 'lln',
                    agencyUuid: 'auuid',
                    agencyAcronym: 'aa',
                    agencyName: 'an',
                    alternativeCount: 1
                }
            ],
            source: 'unitTest'
        };
        summaryMock.mockResolvedValue(response);
        expect(await updateCallback(interview, 'transit', 'household.persons.a12345.journeys.j1.trips.t1.segments.s1.modePre', registerUpdateOperationMock))
            .toEqual({ });
        expect(registerUpdateOperationMock).toHaveBeenCalledWith({ 
            opName: `transitSummary-73.145.1-73.345`,
            opUniqueId: 1,
            operation: expect.anything()});
        const { operation } = registerUpdateOperationMock.mock.calls[0][0];
        const operationResult = await(operation(() => false));
        expect(operationResult).toEqual({ ['household.persons.a12345.journeys.j1.trips.t1.segments.s1.trRoutingResult']: response });
        expect(summaryMock).toHaveBeenCalledWith(expect.objectContaining({
            origin: (baseInterview.response.household as any).persons.a12345.journeys.j1.visitedPlaces.p1.geography,
            destination: (baseInterview.response.household as any).persons.a12345.journeys.j1.visitedPlaces.p2.geography,
            departureSecondsSinceMidnight: 45000,
            transitScenario: 'ScenarioDeSemaine'
        }));
    });

    test('No routing found, expect undefined', async () => {
        const response = {
            status: 'no_routing_found' as const,
            source: 'unitTest'
        };
        summaryMock.mockResolvedValue(response);
        expect(await updateCallback(interview, 'transit', 'household.persons.a12345.journeys.j1.trips.t1.segments.s1.modePre', registerUpdateOperationMock))
            .toEqual({ });
        expect(registerUpdateOperationMock).toHaveBeenCalledWith({ 
            opName: `transitSummary-73.145.1-73.345`,
            opUniqueId: 1,
            operation: expect.anything()});
        const { operation } = registerUpdateOperationMock.mock.calls[0][0];
        const operationResult = await(operation(() => false));
        expect(operationResult).toEqual({ ['household.persons.a12345.journeys.j1.trips.t1.segments.s1.trRoutingResult']: undefined });
        expect(summaryMock).toHaveBeenCalledWith(expect.objectContaining({
            origin: (baseInterview.response.household as any).persons.a12345.journeys.j1.visitedPlaces.p1.geography,
            destination: (baseInterview.response.household as any).persons.a12345.journeys.j1.visitedPlaces.p2.geography,
            departureSecondsSinceMidnight: 45000,
            transitScenario: 'ScenarioDeSemaine'
        }));
    });

    test('exception in summary, expect undefined', async () => {
        summaryMock.mockRejectedValueOnce('Error');
        expect(await updateCallback(interview, 'transit', 'household.persons.a12345.journeys.j1.trips.t1.segments.s1.modePre', registerUpdateOperationMock))
            .toEqual({ });
        expect(registerUpdateOperationMock).toHaveBeenCalledWith({ 
            opName: `transitSummary-73.145.1-73.345`,
            opUniqueId: 1,
            operation: expect.anything()});
        const { operation } = registerUpdateOperationMock.mock.calls[0][0];
        const operationResult = await(operation(() => false));
        expect(operationResult).toEqual({ ['household.persons.a12345.journeys.j1.trips.t1.segments.s1.trRoutingResult']: undefined });
        expect(summaryMock).toHaveBeenCalledWith(expect.objectContaining({
            origin: (baseInterview.response.household as any).persons.a12345.journeys.j1.visitedPlaces.p1.geography,
            destination: (baseInterview.response.household as any).persons.a12345.journeys.j1.visitedPlaces.p2.geography,
            departureSecondsSinceMidnight: 45000,
            transitScenario: 'ScenarioDeSemaine'
        }));
    });

    test('undefined `registerUpdateOperation`, expect promise to be waited upon', async () => {
        const response = {
            status: 'success' as const,
            nbRoutes: 1,
            lines: [
                {
                    lineUuid: 'luuid',
                    lineShortname: 'lsn',
                    lineLongname: 'lln',
                    agencyUuid: 'auuid',
                    agencyAcronym: 'aa',
                    agencyName: 'an',
                    alternativeCount: 1
                }
            ],
            source: 'unitTest'
        };
        summaryMock.mockResolvedValue(response);
        expect(await updateCallback(interview, 'transit', 'household.persons.a12345.journeys.j1.trips.t1.segments.s1.modePre', undefined))
            .toEqual({ ['household.persons.a12345.journeys.j1.trips.t1.segments.s1.trRoutingResult']: response });
        expect(registerUpdateOperationMock).not.toHaveBeenCalled();
        expect(summaryMock).toHaveBeenCalledWith(expect.objectContaining({
            origin: (baseInterview.response.household as any).persons.a12345.journeys.j1.visitedPlaces.p1.geography,
            destination: (baseInterview.response.household as any).persons.a12345.journeys.j1.visitedPlaces.p2.geography,
            departureSecondsSinceMidnight: 45000,
            transitScenario: 'ScenarioDeSemaine'
        }));
    });

    test('exception in function, expect undefined', async () => {
        // Override the implementation of registerUpdateOperationMock to throw an error
        registerUpdateOperationMock.mockImplementationOnce(() => {
            throw new Error('Error in registerUpdateOperation');
        });
        expect(await updateCallback(interview, 'transit', 'household.persons.a12345.journeys.j1.trips.t1.segments.s1.modePre', registerUpdateOperationMock))
            .toEqual({ ['household.persons.a12345.journeys.j1.trips.t1.segments.s1.trRoutingResult']: undefined });
        expect(registerUpdateOperationMock).toHaveBeenCalledWith({ 
            opName: `transitSummary-73.145.1-73.345`,
            opUniqueId: 1,
            operation: expect.anything()});
    });

    test('Undefined person', async () => {
        expect(await updateCallback(interview, 'transit', 'household.persons.a12345111.journeys.j1.trips.t1.segments.s1.modePre', registerUpdateOperationMock))
            .toEqual({ ['household.persons.a12345.journeys.j1.trips.t1.segments.s1.trRoutingResult']: undefined });
        expect(registerUpdateOperationMock).not.toHaveBeenCalled();
    });

    test('Undefined trip', async () => {
        expect(await updateCallback(interview, 'transit', 'household.persons.a12345.journeys.j1.trips.t2.segments.s1.modePre', registerUpdateOperationMock))
            .toEqual({ ['household.persons.a12345.journeys.j1.trips.t1.segments.s1.trRoutingResult']: undefined });
        expect(registerUpdateOperationMock).not.toHaveBeenCalled();
    });

    test('Transit data, but no scenarios specified in config', async () => {
        config.trRoutingScenarios = undefined;
        expect(await updateCallback(interview, 'transit', 'household.persons.a12345.journeys.j1.trips.t1.segments.s1.modePre', registerUpdateOperationMock))
            .toEqual({ });
        expect(registerUpdateOperationMock).not.toHaveBeenCalled();
    });

    describe('Test transit summary regex field matching', function () {

        const regexToMatch = (updateCallbacks.find((callback) => (callback.field as {regex: string}).regex !== undefined && (callback.field as {regex: string}).regex.includes('modePre')) as any).field.regex;

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('Valid modePre path should match regex', async () => {
            expect('household.persons.a12345.journeys.j1.trips.t1.segments.s1.modePre'.match(regexToMatch)).not.toBeNull();
        });

        test('Valid modePre path with different UUID-like IDs should match regex', async () => {
            expect('household.persons.person_123.journeys.journey-456.trips.trip789.segments.segment_999.modePre'.match(regexToMatch)).not.toBeNull();
        });
        
        test('Valid modePre path with actual UUID format should match regex ', async () => {
            expect('household.persons.550e8400-e29b-41d4-a716-446655440000.journeys.550e8400-e29b-41d4-a716-446655440002.trips.550e8400-e29b-41d4-a716-446655440003.segments.550e8400-e29b-41d4-a716-446655440004.modePre'.match(regexToMatch)).not.toBeNull();
        });

        test('Invalid path with empty person ID should not match regex', async () => {
            expect('household.persons..journeys.j1.trips.t1.segments.s1.modePre'.match(regexToMatch)).toBeNull();
        });

        test('Invalid path with empty journey ID should not match regex', async () => {
            expect('household.persons.a12345.journeys..trips.t1.segments.s1.modePre'.match(regexToMatch)).toBeNull();
        });

        test('Invalid path with empty trip ID should not match regex', async () => {
            expect('household.persons.a12345.journeys.j1.trips..segments.s1.modePre'.match(regexToMatch)).toBeNull();
        });

        test('Invalid path with empty segment ID should not match regex', async () => {
            expect('household.persons.a12345.journeys.j1.trips.t1.segments..modePre'.match(regexToMatch)).toBeNull();
        });

        test('Invalid path with wrong field name should not match regex', async () => {
            expect('household.persons.a12345.journeys.j1.trips.t1.segments.s1.modePost'.match(regexToMatch)).toBeNull();
        });

        test('Invalid path with special characters should not match regex', async () => {
            expect('household.persons.a12345@domain.journeys.j1.trips.t1.segments.s1.modePre'.match(regexToMatch)).toBeNull();
        });

        test('Invalid path with spaces in UUID should not match regex', async () => {
            expect('household.persons.a123 45.journeys.j1.trips.t1.segments.s1.modePre'.match(regexToMatch)).toBeNull();
        });

        test('Partial path should not match regex', async () => {
            expect('household.persons.a12345.modePre'.match(regexToMatch)).toBeNull();
        });

        test('Path with extra segments should not match regex', async () => {
            expect('household.persons.a12345.journeys.j1.trips.t1.segments.s1.extra.modePre'.match(regexToMatch)).toBeNull();
        });

        test('Path with extra response prefix should not match regex', async () => {
            expect('responses.household.persons.a12345.journeys.j1.trips.t1.segments.s1.extra.modePre'.match(regexToMatch)).toBeNull();
        });

        test('Path with extra suffixes should not match regex', async () => {
            expect('household.persons.a12345.journeys.j1.trips.t1.segments.s1.extra.modePre.something'.match(regexToMatch)).toBeNull();
        });

        test('Path with uppercase should not match regex', async () => {
            expect('Household.persons.test.journeys.j1.trips.t1.segments.s1.modePre'.match(regexToMatch)).toBeNull();
        });

        test('Path with single character IDs match regex', async () => {
            // Single character IDs (minimum valid length)
            expect('household.persons.a.journeys.b.trips.c.segments.d.modePre'.match(regexToMatch)).not.toBeNull();
        });

        // IDs starting with allowed special characters
        test('Path with only special characters should match regex', async () => {
            expect('household.persons._test.journeys.-test.trips.test_.segments.test-.modePre'.match(regexToMatch)).not.toBeNull();
        });

        // All numeric IDs
        test('Path with only numeric ids should match regex', async () => {
            expect('household.persons.123.journeys.456.trips.789.segments.012.modePre'.match(regexToMatch)).not.toBeNull();
        });
    });
});
describe('Update trip date when interview paused', () => {
    const updateCallback = (updateCallbacks.find((callback) => callback.field === '_sections._actions') as any).callback;
    let interview = _cloneDeep(baseInterview);

    // Spy on the calculateAssignedDayFromPreviousDay function
    let mockedCalculateAssignedDay: jest.SpyInstance;

    // Reset the spy after tests
    afterEach(() => {
        mockedCalculateAssignedDay!.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        interview = _cloneDeep(baseInterview);
        mockedCalculateAssignedDay = jest.spyOn(
            serverFieldUpdateFct, 
            'calculateAssignedDayFromPreviousDay'
        ).mockImplementation((previousDay: string) => {console.log('in mock'); return previousDay});
    });

    const getFormattedAssignedDay = (daysAgo: number) => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    }

    const removeTripsFromInterview = (interview) => {
        Object.keys((interview.response.household as any).persons).forEach(personId => {
            interview.response.household.persons[personId].journeys = undefined;
        });
    }

    test('Undefined updated field, _assignedDay more than 5 days ago, no trips => should update', async () => {
        interview.updated_at = undefined;
        interview.response._assignedDay = getFormattedAssignedDay(5);
        removeTripsFromInterview(interview);
        const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');
        expect(await updateCallback(interview, [], '_sections._actions'))
            .toEqual({ '_assignedDay': yesterday });
        expect(mockedCalculateAssignedDay).toHaveBeenCalledWith(yesterday);
    });

    test('Undefined updated field, _assignedDay more than 5 days ago, with trips => no update', async () => {
        interview.updated_at = undefined;
        interview.response._assignedDay = getFormattedAssignedDay(5);
        expect(await updateCallback(interview, [], '_sections._actions'))
            .toEqual({  });
    });

    test('Undefined updated field, _assignedDay less than 5 days ago => no update', async () => {
        interview.updated_at = undefined;
        interview.response._assignedDay = getFormattedAssignedDay(2);
        removeTripsFromInterview(interview)
        expect(await updateCallback(interview, [], '_sections._actions'))
            .toEqual({  });
    });

    test('Updated_at < 12 hours ago, _assignedDay more than 5 days ago, no trips => no update', async () => {
        interview.updated_at = moment().subtract(5, 'minutes').format();
        interview.response._assignedDay = getFormattedAssignedDay(10);
        removeTripsFromInterview(interview);
        expect(await updateCallback(interview, [], '_sections._actions'))
            .toEqual({});
    });

    test('Updated_at > 12 hours ago, _assignedDay less than 5 days ago => no update', async () => {
        interview.updated_at = moment().subtract(15, 'hours').format();
        interview.response._assignedDay = getFormattedAssignedDay(2);
        expect(await updateCallback(interview, [], '_sections._actions'))
            .toEqual({ });
    });

    test('Updated_at > 12 hours ago, _assignedDay more than 5 days ago, no trips => should update', async () => {
        interview.updated_at = moment().subtract(15, 'hours').format();
        interview.response._assignedDay = getFormattedAssignedDay(5);
        removeTripsFromInterview(interview);
        const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');
        expect(await updateCallback(interview, [], '_sections._actions'))
            .toEqual({ '_assignedDay': yesterday });
        expect(mockedCalculateAssignedDay).toHaveBeenCalledWith(yesterday);
    });

    test('Updated_at > 12 hours ago, _assignedDay more than 5 days ago, with trips => no update', async () => {
        interview.updated_at = moment().subtract(15, 'hours').format();
        interview.response._assignedDay = getFormattedAssignedDay(5);
        expect(await updateCallback(interview, [], '_sections._actions'))
            .toEqual({ });
    });

    test('Updated_at > 12 hours ago, _assignedDay not set, no trips => no update', async () => {
        interview.updated_at = moment().subtract(15, 'hours').format();
        interview.response._assignedDay = undefined;
        removeTripsFromInterview(interview);
        expect(await updateCallback(interview, [], '_sections._actions'))
            .toEqual({ });
    });
})
