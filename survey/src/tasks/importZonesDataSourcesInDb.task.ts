/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';
import taskWrapper from 'chaire-lib-backend/lib/tasks/taskWrapper';

import { ImportZonesFromGeojson } from 'chaire-lib-backend/lib/tasks/zones/importZonesFromGeojson';

const zonesToImport = [
    {
        name: 'isInTerritory',
        shortname: 'isInTerritory',
        ['zones-file']: path.resolve(__dirname, '../survey/geojson/surveyArea.geojson'),
        preMessage: '** Utiliser `a_VALIDE` comme shortname et `a_OBJET` comme name'
    },
    {
        name: 'RA',
        shortname: 'RA',
        ['zones-file']: path.resolve(__dirname, '../survey/geojson/RA.json'),
        preMessage: '** Utiliser `RA23` comme shortname et `NOM` comme name'
    },
    {
        name: 'zat_artm',
        shortname: 'zat',
        ['zones-file']: path.resolve(__dirname, '../survey/geojson/zat_artm.json'),
        preMessage: '** Utiliser `zt23` comme shortname et name'
    }
];

class ImportZonesDataSourcesInDb {
    async run(argv: { [key: string]: unknown }): Promise<void> {
        let zonesInError = 0;
        for (const zoneToImport of zonesToImport) {
            try {
                // preMessage indique quels champs choisir, car la tâche d'import n'est pas interactive
                console.log(zoneToImport.preMessage);
                const newZoneTask = new ImportZonesFromGeojson();
                await newZoneTask.run(zoneToImport);

                console.log(`imported zone ${zoneToImport.name}`);
            } catch (error) {
                console.error(`an error occurred while importing zone ${zoneToImport.name}: ${error}`);
                zonesInError++;
            }
        }
        if (zonesInError > 0) {
            throw new Error('Some zones did not import correctly');
        }
    }
}

taskWrapper(new ImportZonesDataSourcesInDb())
    .then(() => {
        console.log('Done importing zones in the database');
        // eslint-disable-next-line n/no-process-exit
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error executing task ImportZonesDataSourcesInDb', err);
        // eslint-disable-next-line n/no-process-exit
        process.exit(1);
    });
