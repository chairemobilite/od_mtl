// Ce fichier contient des fonctions qui ne dépendent pas d'evolution-frontend
// ou backend, donc peut être importer autant dans le frontend que dans le
// backend

import { booleanPointInPolygon } from '@turf/turf';
import raZones from '../geojson/RA.json';

const raZonesFeatureCollection = raZones as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;

export const getPointZone = (homeGeography: GeoJSON.Feature<GeoJSON.Point>): number | null => {
    const homeRegion = raZonesFeatureCollection.features.find((raZone) =>
        booleanPointInPolygon(homeGeography.geometry, raZone)
    );
    return homeRegion !== undefined ? homeRegion.properties.RA23 : null;
};
