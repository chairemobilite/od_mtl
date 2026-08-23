/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import taskWrapper from 'chaire-lib-backend/lib/tasks/taskWrapper';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { writeFileSync } from 'fs';

import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import busRoutes from '../survey/config/busRoutes.json';
import { slugify } from './generateBusJson.task';

class createJunctionGeojson {
    async run(argv: { [key: string]: unknown }): Promise<void> {
        try {
            // Require arguments for input and output files
            const fileName = argv['file'];
            if (typeof fileName !== 'string') {
                throw 'Must specify the csv file containing the junction point geojson --file /absolute/path/to/file';
            }
            if (!fileManager.fileExistsAbsolute(fileName as string)) {
                throw `File ${fileName} does not exist. It must be the absolute path to the file`;
            }
            const outFile = argv['outFile'];
            if (typeof outFile !== 'string') {
                throw 'Must specify the file to export the data to --outFile /absolute/path/to/file';
            }
            const junctionFeatures: Record<number, GeoJSON.Feature<GeoJSON.Point>> = {};
            const featureCollection = JSON.parse(fileManager.readFileAbsolute(fileName));
            let found = 0;
            let notFound = 0;
            for (const feature of featureCollection.features) {
                // Incoming feature has id, nom and ligne properties
                const { id, nom, ligne } = feature.properties;
                const { coordinates } = feature.geometry;

                // Find existing junctionFeature by ID in the junctionFeature, or initialize it
                const currentFeature = junctionFeatures[id] ?? {
                    type: 'Feature',
                    id: slugify(nom),
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            Math.round(coordinates[0] * 1000000) / 1000000,
                            Math.round(coordinates[1] * 1000000) / 1000000
                        ]
                    },
                    properties: {
                        id: id,
                        nom,
                        lines: []
                    }
                };
                junctionFeatures[id] = currentFeature;

                // Ligne has format agency_lineShortname, split it
                const [acronym, lineName] = ligne.split('_');

                // Find lines from busRoutes, such that agencyAcronym contains (case insensivive) the agency name and lineShortname matches lineShortname from 'ligne'
                const actualBusRoute = busRoutes.find(
                    (route) => route.agencyAcronym.toLowerCase().includes(acronym) && route.lineShortname === lineName
                );

                // If no line found, log, otherwise, add the line to the 'lines' property of the junction, if it does not exist yet
                if (actualBusRoute === undefined) {
                    console.log('No bus route found for line %s and %s', acronym, lineName);
                    notFound++;
                } else if (!currentFeature.properties.lines.includes(actualBusRoute.slug)) {
                    currentFeature.properties.lines.push(actualBusRoute.slug);
                    found++;
                }
            }
            // Save the junctionFeatures as featureCollection in outfile
            const featureCount = Object.keys(junctionFeatures).length;
            const outputLines = [
                '{"type":"FeatureCollection","features":[',
                ...Object.values(junctionFeatures).map(
                    (feature, index) => `${JSON.stringify(feature)}${index < featureCount - 1 ? ',' : ''}`
                ),
                ']}'
            ];
            writeFileSync(outFile, outputLines.join('\n'));
            console.log('Wrote output.json with one feature per line with %d found and %d not found', found, notFound);
        } catch (error) {
            console.error('Error creating junction geojson file', error);
            throw error;
        }
    }
}

taskWrapper(new createJunctionGeojson())
    .then(() => {
        console.log('Done creating the junction geojson file');
        // eslint-disable-next-line n/no-process-exit
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error executing task', err);
        // eslint-disable-next-line n/no-process-exit
        process.exit(1);
    });
