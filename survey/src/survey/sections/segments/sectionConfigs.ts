import _merge from 'lodash/merge';
import * as odSurveyHelper from 'evolution-common/lib/services/odSurvey/helpers';
import { SectionConfig } from 'evolution-common/lib/services/questionnaire/types';
import { SegmentsSectionFactory } from 'evolution-common/lib/services/questionnaire/sections/segments/sectionSegments';
import { widgetsNames } from './widgetsNames';
import { isCommonTripSampleMatch, updateHouseholdSizeFromPersonCount } from '../../common/customHelpers';
import { widgetFactoryOptions } from '../../common/helper';
import { getResponse } from 'evolution-common/lib/utils/helpers';

export const currentSectionName: string = 'segments';
const nextSectionName: SectionConfig['nextSection'] = 'travelBehavior';

const segmentSectionConfig = new SegmentsSectionFactory(
    { type: 'segments', enabled: true },
    widgetFactoryOptions
).getSectionConfig();
// Config for the section
// FIXME Now using the builtin config for this section. Kept to make sure there's a section available for now. Remove when https://github.com/chairemobilite/evolution/issues/1531 is fixed
export const sectionConfig: SectionConfig = {
    ...segmentSectionConfig,
    // FIXME Remove this line when the next section becomes travelBehavior
    nextSection: nextSectionName,
    onSectionEntry: (interview, iterationContext) => {
        // Get values to update from the original segment section configuration
        const valuesToUpdate = segmentSectionConfig.onSectionEntry(interview, iterationContext);

        // If common trip partial sample, add the person ID of the first person
        // to enter this section
        if (isCommonTripSampleMatch(interview)) {
            const refPersonId = getResponse(interview, '_commonTripRefPersonId', null);
            if (refPersonId === null && iterationContext && iterationContext.length > 0) {
                const personId = iterationContext[iterationContext.length - 1];
                valuesToUpdate['response._commonTripRefPersonId'] = personId;
            }
        }

        return valuesToUpdate;
    }
};

export default sectionConfig;
