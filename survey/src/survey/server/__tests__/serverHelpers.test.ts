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
            expectedArtmTerritory: true
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
            expectedArtmTerritory: true
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
            expectedArtmTerritory: false
        }
    ];

    test.each(cases)('fills zone properties for $title', ({ geography, expectedRA, expectedZat, expectedInTerritory, expectedArtmTerritory }) => {
        const res = updatePathsWithZonesIntersectingPoint(geography as any, 'home.geography');
        expect(res['home.geography.properties.RA']).toBe(expectedRA);
        expect(res['home.geography.properties.zat']).toBe(expectedZat);
        expect(res['home.geography.properties.isInTerritory']).toBe(expectedInTerritory);
        expect(res['home.geography.properties.isArtmZone']).toBe(expectedArtmTerritory);
    });
});