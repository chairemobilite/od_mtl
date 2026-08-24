import _merge from 'lodash/merge';
import customSurveySections from './sections';
import { widgets } from './widgetsConfigs';
import { widgetFactoryOptions } from './common/helper';
import {
    getAndValidateSurveySections,
    SectionConfig,
    QuestionnaireConfiguration
} from 'evolution-common/lib/services/questionnaire/types';
import { QuestionnaireFactory } from 'evolution-common/lib/services/questionnaire';
import {
    addPrefilledSegmentNote,
    getCommonTripReminderOptionsForVisitedPlaces,
    getPreviousModeSameModePartialSample
} from './common/customHelpers';

import { getResponse } from 'evolution-common/lib/utils/helpers';
import { isCommonTripSampleMatch } from './common/commonHelpers';
import { questionnaireConfiguration } from './questionnaireConfigBase';

const questionnaireConfigFrontend: QuestionnaireConfiguration = {
    ...questionnaireConfiguration,
    tripDiary: {
        ...questionnaireConfiguration.tripDiary,
        sections: {
            ...questionnaireConfiguration.tripDiary.sections,
            segments: {
                ...questionnaireConfiguration.tripDiary.sections.segments,
                additionalLabelOptionFunctions: {
                    segmentSameModeAsReverseTrip: getPreviousModeSameModePartialSample,
                    segmentIntro: addPrefilledSegmentNote
                }
            },
            visitedPlaces: {
                ...questionnaireConfiguration.tripDiary.sections.visitedPlaces,
                additionalLabelOptionFunctions: {
                    visitedPlaceActivityCategory: getCommonTripReminderOptionsForVisitedPlaces(),
                    visitedPlacePreviousDepartureTime: getCommonTripReminderOptionsForVisitedPlaces(['activity']),
                    visitedPlaceArrivalTime: getCommonTripReminderOptionsForVisitedPlaces([
                        'activity',
                        'previousDepartureTime'
                    ]),
                    visitedPlaceNextPlaceCategory: getCommonTripReminderOptionsForVisitedPlaces(['arrivalTime']),
                    visitedPlaceDepartureTime: getCommonTripReminderOptionsForVisitedPlaces(['nextPlaceCategory'])
                }
            }
        }
    }
};

const questionnaireFactory = new QuestionnaireFactory(questionnaireConfigFrontend, widgetFactoryOptions);
const { surveySections, widgetsConfig } = questionnaireFactory.buildSectionsAndWidgets();

const segmentSectionConfigFromFactory = surveySections['segments'];

// Add the segments section to the exported configuration
const segmentConfig: SectionConfig = {
    ...segmentSectionConfigFromFactory,
    // Override the onSectionEntry to get the reference person ID for the common trips questions.
    onSectionEntry: function (interview, iterationContext) {
        // Get values to update from the original segment section configuration
        const segmentValuesToUpdate = segmentSectionConfigFromFactory.onSectionEntry!(interview, iterationContext);

        // If common trip partial sample, add the person ID of the first person
        // to enter this section
        if (isCommonTripSampleMatch(interview)) {
            const refPersonId = getResponse(interview, '_commonTripRefPersonId', null);
            if (refPersonId === null && iterationContext && iterationContext.length > 0) {
                const personId = iterationContext[iterationContext.length - 1];
                segmentValuesToUpdate['response._commonTripRefPersonId'] = personId;
            }
        }

        return segmentValuesToUpdate;
    }
};

const visitedPlacesSectionConfigFromFactory = surveySections['visitedPlaces'];

// Add the section configs to the exported configuration. Unordered, but should be fine.
const validatedSections = getAndValidateSurveySections({
    ...customSurveySections,
    visitedPlaces: visitedPlacesSectionConfigFromFactory,
    segments: segmentConfig
});

// Widgets defined in the interview will override the ones from the section factory, if any
const allWidgetConfig = Object.assign({}, widgetsConfig, widgets);

export { validatedSections as surveySections, allWidgetConfig as widgetsConfig };
