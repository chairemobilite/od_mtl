/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import taskWrapper from 'chaire-lib-backend/lib/tasks/taskWrapper';
import { writeFileSync } from 'fs';

import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import zat from '../survey/geojson/zat_artm.json';

const zatFC = zat as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;

/**
 * Input file is a csv with the orig and destination zat for which we want to
 * calculate barriers. It is transformed into a json object with the keys being
 * the number of the origin zat and the values are an array of 0 or 1 values
 * whether to use this zat x zat mapping. Array is initialized to `false` and
 * set to `true` for every orig/dest zat pair in the csv file.
 */
class createZatMatrix {
    async run(argv: { [key: string]: unknown }): Promise<void> {
        try {
            // Require arguments for input and output files
            const fileName = argv['file'];
            if (typeof fileName !== 'string') {
                throw 'Must specify the csv file the zat matrix --file /absolute/path/to/file';
            }
            if (!fileManager.fileExistsAbsolute(fileName as string)) {
                throw `File ${fileName} does not exist. It must be the absolute path to the file`;
            }
            const outFile = argv['outFile'];
            if (typeof outFile !== 'string') {
                throw 'Must specify the file to export the data to --outFile /absolute/path/to/file';
            }
            const currentData: Record<number, number[]> = {};

            // Getting maxZat, there are some numbers that are skipped, but if
            // there is not that many an array with the maxZat count remains
            // better than a map object.
            const maxZat = zatFC.features.reduce((max, f) => (f.properties.zt23 > max ? f.properties.zt23 : max), 0);
            console.log('Maximum zat ID: %d, zat features length: %d', maxZat, zatFC.features.length);

            for (const feature of zatFC.features) {
                const zt23 = feature.properties?.zt23;
                if (typeof zt23 === 'number') {
                    currentData[zt23] = Array(maxZat).fill(0);
                }
            }

            await parseCsvFile(
                fileName,
                (data) => {
                    const { zt_orig, zt_dest } = data;
                    const originZat = Number.parseInt(zt_orig as string, 10);
                    const destinationZat = Number.parseInt(zt_dest as string, 10);

                    if (Number.isInteger(originZat) && Number.isInteger(destinationZat)) {
                        const row = currentData[originZat];
                        if (row === undefined || destinationZat < 1 || destinationZat > maxZat) {
                            console.warn('Skipping unknown zat pair: %s -> %s', zt_orig, zt_dest);
                            return;
                        }
                        row[destinationZat - 1] = 1;
                    }
                },
                { header: true }
            );
            // Write json to file
            const entries = Object.entries(currentData).map(([key, value]) => {
                const line = `  "${JSON.stringify(Number(key))}": ${JSON.stringify(value)}`;
                return line;
            });
            const json = [
                'export const zatXzatEligibilityMatrix = {',
                ...entries.map((line, index) => `${line}${index < entries.length - 1 ? ',' : ''}`),
                '}'
            ].join('\n');
            writeFileSync(outFile, `${json}\n`);
            console.log(`Wrote ${outFile} with zat matrix data`);
        } catch (error) {
            console.error('Error creating the zat matrix file', error);
            throw error;
        }
    }
}

taskWrapper(new createZatMatrix())
    .then(() => {
        console.log('Done creating the zat matrix file');
        // eslint-disable-next-line n/no-process-exit
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error executing task createZatMatrix', err);
        // eslint-disable-next-line n/no-process-exit
        process.exit(1);
    });
