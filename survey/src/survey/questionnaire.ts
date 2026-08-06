import _merge from 'lodash/merge';
import customSurveySections from './sections';
import { widgets } from './widgetsConfigs';
import { getBirdDistanceMeters, widgetFactoryOptions } from './common/helper';
import {
    getAndValidateSurveySections,
    SectionConfig,
    QuestionnaireConfiguration
} from 'evolution-common/lib/services/questionnaire/types';
import { QuestionnaireFactory } from 'evolution-common/lib/services/questionnaire';
import { personVisitedPlacesWidgetsNames } from './sections/visitedPlaces/widgetsNames';
import { segmentsWidgetsNames, personTripsWidgetsNames } from './sections/segments/widgetsNames';
import { Mode } from 'evolution-common/lib/services/baseObjects/attributeTypes/SegmentAttributes';
import {
    addPrefilledSegmentNote,
    getCommonTripReminderOptionsForVisitedPlaces,
    getPreviousModeSameModePartialSample
} from './common/customHelpers';

// Import feature collections for some widgets
import metroStations from './geojson/stations_metro.json';
import remStations from './geojson/stations_rem.json';
import trainStations from './geojson/gares_train.json';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import { isCommonTripSampleMatch } from './common/commonHelpers';
import {
    getSegmentContextFromPath,
    getTripContextFromPath,
    getVisitedPlaces
} from 'evolution-common/lib/services/odSurvey/helpers';
import projectConfig from 'evolution-common/lib/config/project.config';

const metroStationsFC = metroStations as GeoJSON.FeatureCollection<GeoJSON.Point>;
const remStationsFC = remStations as GeoJSON.FeatureCollection<GeoJSON.Point>;
const trainStationsFC = trainStations as GeoJSON.FeatureCollection<GeoJSON.Point>;

const questionnaireConfiguration: QuestionnaireConfiguration = {
    tripDiary: {
        sections: {
            segments: {
                type: 'segments' as const,
                enabled: true,
                askSegmentDriver: true,
                additionalSegmentWidgetNames: segmentsWidgetsNames,
                additionalTripsWidgetNames: personTripsWidgetsNames,
                modesIncludeOnly: [
                    'walk',
                    'bicycle',
                    'bicycleElectric',
                    'bicycleBikesharing',
                    'bicycleBikesharingElectric',
                    'transitBus',
                    'schoolBus',
                    'transitTaxi',
                    'paratransit',
                    'otherBus',
                    'intercityBus',
                    'transitRRT',
                    'transitLRRT',
                    'transitRegionalRail',
                    'intercityTrain',
                    'carPassenger',
                    'carDriver',
                    'carDriverCarsharing',
                    'motorcycle',
                    'plane',
                    'taxi',
                    'mobilityScooter',
                    'kickScooterElectric',
                    'otherActiveMode',
                    'transitFerry',
                    'ferryWithCar',
                    'other',
                    'dontKnow'
                ] as Mode[],
                modeCategoryToModeMap: {
                    walk: {
                        modes: ['walk'],
                        icon: 'walk'
                    },
                    bicycle: {
                        modes: ['bicycle', 'bicycleElectric', 'bicycleBikesharing', 'bicycleBikesharingElectric'],
                        icon: 'bicycle'
                    },
                    bus: {
                        modes: ['transitBus', 'schoolBus', 'transitTaxi', 'paratransit', 'otherBus', 'intercityBus'],
                        icon: 'transitBus'
                    },
                    transitHeavy: {
                        modes: ['transitRRT', 'transitLRRT', 'transitRegionalRail', 'intercityTrain'],
                        icon: 'transitRRT'
                    },
                    schoolBus: {
                        modes: ['schoolBus'],
                        icon: 'schoolBus',
                        conditional: (interview, path) => {
                            const segmentContext = getSegmentContextFromPath({ interview, path });
                            if (segmentContext === null) {
                                throw new Error(
                                    `schoolBus modePre conditional: Cannot find segment context for path ${path}`
                                );
                            }
                            const { person } = segmentContext;
                            // People of school age. See if we can use a better condition in Evolution (https://github.com/chairemobilite/evolution/issues/1794)
                            return typeof person.age === 'number' && person.age < projectConfig.schoolMandatoryAge;
                        }
                    },
                    carPassenger: {
                        modes: ['carPassenger'],
                        icon: 'carPassenger'
                    },
                    carDriver: {
                        modes: ['carDriver', 'carDriverCarsharing', 'motorcycle'],
                        icon: 'carDriver'
                        // Same name as builtin modePre, should use the builtin conditional
                    },
                    intercity: {
                        modes: ['plane', 'intercityTrain', 'intercityBus'],
                        icon: 'plane',
                        conditional: (interview, path) => {
                            const tripContext = getTripContextFromPath({ interview, path });
                            if (tripContext === null) {
                                throw new Error(
                                    `intercity modePre conditional: Cannot find trip context for path ${path}`
                                );
                            }
                            const { journey, trip, person } = tripContext;
                            const birdDistance = getBirdDistanceMeters({
                                trip,
                                person,
                                interview,
                                visitedPlaces: getVisitedPlaces({ journey })
                            });
                            // distance is greater than 50 km
                            return birdDistance > 50 * 1000;
                        }
                    },
                    other: {
                        modes: [
                            'taxi',
                            'motorcycle',
                            'otherBus',
                            'schoolBus',
                            'transitTaxi',
                            'paratransit',
                            'mobilityScooter',
                            'kickScooterElectric',
                            'otherActiveMode',
                            'transitFerry',
                            'ferryWithCar',
                            'other',
                            'dontKnow'
                        ],
                        icon: 'other'
                    }
                },
                fieldsWithGeojsonPoint: [
                    { fieldName: 'subwayStationStart', type: 'fromCollection', featureCollection: metroStationsFC },
                    { fieldName: 'remStationStart', type: 'fromCollection', featureCollection: remStationsFC },
                    { fieldName: 'trainStationStart', type: 'fromCollection', featureCollection: trainStationsFC },
                    { fieldName: 'subwayStationEnd', type: 'fromCollection', featureCollection: metroStationsFC },
                    { fieldName: 'remStationEnd', type: 'fromCollection', featureCollection: remStationsFC },
                    { fieldName: 'trainStationEnd', type: 'fromCollection', featureCollection: trainStationsFC }
                ],
                additionalLabelOptionFunctions: {
                    segmentSameModeAsReverseTrip: getPreviousModeSameModePartialSample,
                    segmentIntro: addPrefilledSegmentNote
                }
            },
            visitedPlaces: {
                type: 'visitedPlaces' as const,
                enabled: true,
                tripDiaryMaxTimeOfDay: 28 * 60 * 60, // 28h in seconds (i.e. 4h the next day)
                tripDiaryMinTimeOfDay: 4 * 60 * 60, // 4h in seconds
                additionalVisitedPlacesWidgetNames: personVisitedPlacesWidgetsNames,
                inlineUsualPlacesEntry: true,
                additionalLabelOptionFunctions: {
                    visitedPlaceActivityCategory: getCommonTripReminderOptionsForVisitedPlaces,
                    visitedPlacePreviousDepartureTime: getCommonTripReminderOptionsForVisitedPlaces,
                    visitedPlaceNextPlaceCategory: getCommonTripReminderOptionsForVisitedPlaces,
                    visitedPlaceDepartureTime: getCommonTripReminderOptionsForVisitedPlaces
                },
                activitiesIncludeOnly: [
                    'home',
                    'workUsual',
                    'workNotUsual',
                    'workOnTheRoad',
                    'volunteering',
                    'schoolUsual',
                    'schoolNotUsual',
                    'shopping',
                    'restaurant',
                    'service',
                    'medical',
                    'veterinarian',
                    'worship',
                    'pickClassifiedPurchase',
                    'dropSomeone',
                    'fetchSomeone',
                    'accompanySomeone',
                    'leisureStroll',
                    'leisureSports',
                    'leisureArtsMusicCulture',
                    'leisureTourism',
                    'visiting',
                    'secondaryHome',
                    'schoolNotStudent',
                    'otherParentHome',
                    'other'
                ]
            }
        }
    }
};

const questionnaireFactory = new QuestionnaireFactory(questionnaireConfiguration, widgetFactoryOptions);
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
