import { updatePathsWithZonesIntersectingPoint } from '../serverHelpers';
import { getActualPreviousDay } from '../serverHelpers';
import config from 'evolution-common/lib/config/project.config';

// Ensure survey area is loaded
jest.mock('evolution-common/lib/config/project.config', () => ({
    __esModule: true,
    default: {
        ...jest.requireActual('evolution-common/lib/config/project.config').default,
        timezone: 'America/Montreal',
        surveyAreaGeojsonPath: '../../../survey/src/survey/geojson/surveyArea.geojson'
    }
}));

describe('updatePathsWithZonesIntersectingPoint', () => {
    const cases = [
        {
            title: 'RA1',
            geography: {
                type: 'Feature',
                properties: { lastAction: 'preGeocoded' },
                geometry: { type: 'Point', coordinates: [-73.5636531, 45.4998788] }
            },
            expectedRA: 1,
            expectedZat: 20,
            expectedInTerritory: true,
            expectedArtmTerritory: true,
            expectedOnDemandTransitZone: false
        },
        {
            title: 'RA8',
            geography: {
                type: 'Feature',
                properties: { lastAction: 'preGeocoded' },
                geometry: { type: 'Point', coordinates: [-73.6890569, 45.2877987] }
            },
            expectedRA: 8,
            expectedZat: 1295,
            expectedInTerritory: true,
            expectedArtmTerritory: true,
            expectedOnDemandTransitZone: false
        },
        {
            title: 'in on demand transit zone',
            geography: {
                type: 'Feature',
                properties: { lastAction: 'preGeocoded' },
                geometry: { type: 'Point', coordinates: [-73.3732819, 45.47785548458] }
            },
            expectedRA: 5,
            expectedZat: 1751,
            expectedInTerritory: true,
            expectedArtmTerritory: true,
            expectedOnDemandTransitZone: true
        },
        {
            title: 'in territory but not artm',
            geography: {
                type: 'Feature',
                properties: { lastAction: 'preGeocoded' },
                geometry: { type: 'Point', coordinates: [-74.35752421, 45.61226747] }
            },
            expectedRA: 7,
            expectedZat: null,
            expectedInTerritory: true,
            expectedArtmTerritory: false,
            expectedOnDemandTransitZone: false
        },
        {
            title: 'outside zone',
            geography: {
                type: 'Feature',
                properties: { lastAction: 'preGeocoded' },
                geometry: { type: 'Point', coordinates: [-72.9151298, 45.2640302] }
            },
            expectedRA: null,
            expectedZat: null,
            expectedInTerritory: false,
            expectedArtmTerritory: false,
            expectedOnDemandTransitZone: false
        }
    ];

    test.each(cases)('fills zone properties for $title', ({ geography, expectedRA, expectedZat, expectedInTerritory, expectedArtmTerritory, expectedOnDemandTransitZone }) => {
        const res = updatePathsWithZonesIntersectingPoint(geography as any, 'home.geography');
        expect(res['home.geography.properties.RA']).toBe(expectedRA);
        expect(res['home.geography.properties.zat']).toBe(expectedZat);
        expect(res['home.geography.properties.isInTerritory']).toBe(expectedInTerritory);
        expect(res['home.geography.properties.isArtmZone']).toBe(expectedArtmTerritory);
        expect(res['home.geography.properties.isOnDemandTransitZone']).toBe(expectedOnDemandTransitZone);
    });
});

describe('getActualPreviousDay', () => {
    const defaultTimezone = config.timezone;

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        config.timezone = defaultTimezone;
    });

    test.each([
        ['2026-09-02T02:00:00-04:00', '2026-08-31'],
        ['2026-09-02T05:00:00-04:00', '2026-09-01'],
        // 8am in America/Montreal
        ['2026-09-02T03:00:00-09:00', '2026-09-01'],
        // 8pm, september 1st in America/Montreal
        ['2026-09-02T05:00:00+07:00', '2026-08-31'],
        // 1am in America/Montreal
        ['2026-09-02T05:00:00Z', '2026-08-31']
    ])('uses the trip diary rollover for server time %s: %s', (currentServerTime, expectedPreviousDay) => {
        jest.setSystemTime(new Date(currentServerTime));

        expect(getActualPreviousDay()).toEqual(expectedPreviousDay);
    });

    test.each([
        ['Asia/Tokyo', '2026-09-02T23:00:00Z', '2026-09-02'], // 8am in tokyo time
        ['America/Vancouver', '2026-09-02T10:00:00Z', '2026-08-31'] // 3AM in vancouver time
    ])('uses the configured %s timezone when determining the previous day', (timezone, currentServerTime, expectedPreviousDay) => {
        config.timezone = timezone as typeof config.timezone;
        jest.setSystemTime(new Date(currentServerTime));

        expect(getActualPreviousDay()).toEqual(expectedPreviousDay);
    });
});
