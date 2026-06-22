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
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import metroStations from '../survey/geojson/stations_metro.json';

const metroStationsFC = metroStations as GeoJSON.FeatureCollection<GeoJSON.Point>;

class createMetroTransferMatrix {
    async run(argv: { [key: string]: unknown }): Promise<void> {
        try {
            // Require arguments for input and output files
            const fileName = argv['file'];
            if (typeof fileName !== 'string') {
                throw 'Must specify the csv file containing metro transfer data --file /absolute/path/to/file';
            }
            if (!fileManager.fileExistsAbsolute(fileName as string)) {
                throw `File ${fileName} does not exist. It must be the absolute path to the file`;
            }
            const outFile = argv['outFile'];
            if (typeof outFile !== 'string') {
                throw 'Must specify the file to export the data to --outFile /absolute/path/to/file';
            }
            const currentData: Record<
                string,
                Record<string, { display: boolean; value?: string; choices?: { value: string; label?: string }[] }>
            > = {};
            await parseCsvFile(
                fileName,
                (data, rowNum) => {
                    const { station_1, station_2, afficher_qs, valeur_affectee, reponses_ok } = data;

                    // Initialize staion data
                    if (currentData[station_1] === undefined) {
                        currentData[station_1] = {};
                    }
                    // If there is no transfer, just ignore from output file
                    if (!(afficher_qs === '0' && valeur_affectee === 'none')) {
                        const reponses_possibles = (reponses_ok as string).split('|');
                        const display = afficher_qs === '1';
                        if (!display) {
                            // Save the single value to use
                            currentData[station_1][station_2] = {
                                display: display,
                                value: reponses_possibles[0]
                            };
                        } else {
                            // Save an array of possible choices, with the label a comma-separated list of station names
                            // Leave label empty for 'none', as the translation will be internationalized
                            currentData[station_1][station_2] = {
                                display: display,
                                choices: reponses_possibles.map((reponse) => {
                                    if (reponse === 'none') {
                                        return {
                                            value: 'none'
                                        };
                                    }
                                    const choices = reponse.split('&');
                                    const labels = choices.map((station) => {
                                        const feat = metroStationsFC.features.find(
                                            (metroStation) => metroStation.id === station
                                        );
                                        if (feat === undefined) {
                                            console.log('impossible de trouver la station', station);
                                        }
                                        return feat.properties.nom;
                                    });
                                    return {
                                        value: reponse,
                                        label: labels.join(', ')
                                    };
                                })
                            };
                        }
                    }
                },
                { header: true }
            );
            // Write json to file
            writeFileSync(outFile, JSON.stringify(currentData));
            console.log(`Wrote ${outFile} with transfer matrix data`);
        } catch (error) {
            console.error('Error creating metro station transfer matrix', error);
        }
    }
}

taskWrapper(new createMetroTransferMatrix())
    .then(() => {
        console.log('Done creating the metro station transfer matrix');
        // eslint-disable-next-line n/no-process-exit
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error executing task createMetroTransferMatrix', err);
        // eslint-disable-next-line n/no-process-exit
        process.exit(1);
    });
