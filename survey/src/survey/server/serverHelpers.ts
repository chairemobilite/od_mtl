// Ce fichier contient des fonctions utilisées uniquement dans le backend.
// Idéalement, les fonctions de calculs géographiques avec des geojson complexes
// (zones) devraient s'exécuter uniquement sur le backend pour éviter l'envoi de
// geojson volumineux sur les clients.

import { booleanPointInPolygon } from '@turf/turf';
import zatZones from '../geojson/zat_artm.json';

const zatZonesFeatureCollection = zatZones as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;

export const getZatForPoint = (geography: GeoJSON.Feature<GeoJSON.Point>): number | null => {
    const zat = zatZonesFeatureCollection.features.find((raZone) => booleanPointInPolygon(geography.geometry, raZone));
    return zat !== undefined ? zat.properties.zt23 : null;
};
