import { updatePathsWithZonesIntersectingPoint } from '../serverHelpers';

// Ensure survey area is loaded
jest.mock('evolution-common/lib/config/project.config', () => ({
    __esModule: true,
    default: {
        ...jest.requireActual('evolution-common/lib/config/project.config').default,
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