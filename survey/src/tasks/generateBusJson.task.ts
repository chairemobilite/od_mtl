/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import taskWrapper from 'chaire-lib-backend/lib/tasks/taskWrapper';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { writeFileSync } from 'fs';
import deburr from 'lodash/deburr';

import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';

export function slugify(...parts: Array<string | null | undefined>): string {
    // Join the strings with '_'
    const joined = parts.filter((p) => p !== null && p !== '').join('_');
    // Remove accents
    const deaccented = deburr(joined);
    // Put all lower case
    const lower = deaccented.toLowerCase();
    // Replace forbidden characters by hyphens, keeping only alphanumeric, underscore and hyphens
    const replaced = lower.replace(/[^a-z0-9\-_]+/g, '-');
    // Remove hyphens at the beginning and end
    return replaced.replace(/(^-+|-+$)/g, '');
}

/**
 * Generate the json file containing bus routes from exported data from
 * Transition.
 *
 * The csv file data can be obtained by running the following SQL query on the
 * Transition database containing the scneario data for transit validation.
 * Change the scenario IDs in the where clause to match current scenarios.
 *
 * ```
 * COPY (select distinct ag.acronym, corrected_acronym, lines.shortname, lines.longname, lines.color, concat(lpad(lines.shortname, 5, '0'), ag.acronym) as sortableShortname
 * from demo_transition.tr_transit_lines lines
 * inner join (select id, acronym, case
 *         when acronym like 'exo%' then 'exo'
 *         when acronym like '%_2026' then left(acronym, -5)
 *         else acronym
 *         end as corrected_acronym
 *         from demo_transition.tr_transit_agencies ag) ag on ag.id = lines.agency_id
 * inner join demo_transition.tr_transit_schedules sched on sched.line_id = lines.id
 *  inner join demo_transition.tr_transit_scenario_services tscs on tscs.service_id = sched.service_id
 * inner join demo_transition.tr_transit_scenarios sc on sc.id = tscs.scenario_id
 * where lines.mode = 'bus' and sc.id in ('ad438798-e0b2-4e08-a3bd-b944fee418e1', '80da3027-8ad6-4f80-89d6-23d0ae3dec1c', '23f9c86f-e161-4af3-9102-ecf81bedc473')
 * order by ag.acronym, sortableShortname) TO '/tmp/transitBusLines.csv' WITH (FORMAT CSV, HEADER);
 * ```
 */
class GenerateBusJsonFile {
    async run(argv: { [key: string]: unknown }): Promise<void> {
        try {
            // Require arguments for input and output files
            const fileName = argv['file'];
            if (typeof fileName !== 'string') {
                throw 'Must specify the csv file containing the transition bus routes\' query data with --file /absolute/path/to/file';
            }
            if (!fileManager.fileExistsAbsolute(fileName as string)) {
                throw `File ${fileName} does not exist. It must be the absolute path to the file`;
            }
            const outFile = argv['outFile'];
            if (typeof outFile !== 'string') {
                throw 'Must specify the file to export the data to --outFile /absolute/path/to/file';
            }
            const currentData: {
                // Acronym of the transit agency, to match transition results
                agencyAcronym: string;
                // The line shortname, to match transition results
                lineShortname: string;
                // Line slug, must be unique, to use as key in bus route choices
                slug: string;
                // The user visible name for this line
                name: string;
                // The line color if available
                color: string;
            }[] = [];
            const uniqueSlugs: Record<string, boolean> = {};
            await parseCsvFile(
                fileName,
                (data, rowNum) => {
                    const { acronym, corrected_acronym, shortname, color, longname } = data;

                    const slug = slugify(corrected_acronym, shortname, longname);
                    if (uniqueSlugs[slug] !== undefined) {
                        throw new Error(`Bus line slugs should be unique. We have 2 identical slugs for ${slug}`);
                    }
                    uniqueSlugs[slug] = true;
                    currentData.push({
                        agencyAcronym: acronym,
                        lineShortname: shortname,
                        slug: slug,
                        color: _isBlank(color) ? undefined : color,
                        name: [corrected_acronym, shortname, longname].join(' ')
                    });
                },
                { header: true }
            );
            // Write json to file
            writeFileSync(outFile, JSON.stringify(currentData, null, 4));
            console.log(`Wrote ${outFile} with transfer matrix data`);
        } catch (error) {
            console.error('Error creating metro station transfer matrix', error);
            throw error;
        }
    }
}

taskWrapper(new GenerateBusJsonFile())
    .then(() => {
        console.log('Done generating the bus routes json file');
        // eslint-disable-next-line n/no-process-exit
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error executing task generateBusJsonFile', err);
        // eslint-disable-next-line n/no-process-exit
        process.exit(1);
    });
