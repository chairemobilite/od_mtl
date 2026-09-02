// Ce fichier contient des fonctions utilisées uniquement dans le backend.
// Idéalement, les fonctions de calculs géographiques avec des geojson complexes
// (zones) devraient s'exécuter uniquement sur le backend pour éviter l'envoi de
// geojson volumineux sur les clients.

import { booleanPointInPolygon, distance as turfDistance } from '@turf/turf';
import { v4 as uuidV4 } from 'uuid';
import zatZones from '../geojson/zat_artm.json';
import type { Journey, Person, Trip, UserInterviewAttributes } from 'evolution-common/lib/services/questionnaire/types';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import { getCommonTripFromReferencePerson } from '../common/commonHelpers';
import { zatXzatEligibilityMatrix } from '../config/zat_x_zat_matrix';
import raZones from '../geojson/RA.json';
import artmTerritory from '../geojson/artm.json';
import onDemandZones from '../geojson/onDemandTransit_zone.json';
// FIXME We should not import from auditChecks here for the survey, but this
// utils is very utile, so it should be moved elsewhere
// (https://github.com/chairemobilite/evolution/issues/1792)
import { getSurveyArea } from 'evolution-backend/lib/utils/surveyArea';
import { questionnaireConfiguration } from '../questionnaireConfigBase';
import { QuestionnaireFactory } from 'evolution-common/lib/services/questionnaire';
import config from 'evolution-common/lib/config/project.config';
import moment from 'moment-timezone';

const raZonesFeatureCollection = raZones as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;
const zatZonesFeatureCollection = zatZones as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;
const artmTerritoryFeatureCollection = artmTerritory as GeoJSON.FeatureCollection<
    GeoJSON.MultiPolygon | GeoJSON.Polygon
>;
const onDemandZonesFeatureCollection = onDemandZones as GeoJSON.FeatureCollection<
    GeoJSON.MultiPolygon | GeoJSON.Polygon
>;

export const getZatForPoint = (geography: GeoJSON.Feature<GeoJSON.Point>): number | null => {
    const zat = zatZonesFeatureCollection.features.find((raZone) => booleanPointInPolygon(geography.geometry, raZone));
    return zat !== undefined ? zat.properties.zt23 : null;
};

export const getPointZone = (homeGeography: GeoJSON.Feature<GeoJSON.Point>): number | null => {
    const homeRegion = raZonesFeatureCollection.features.find((raZone) =>
        booleanPointInPolygon(homeGeography.geometry, raZone)
    );
    return homeRegion !== undefined ? homeRegion.properties.RA23 : null;
};

const surveyArea = getSurveyArea();
if (surveyArea === undefined) {
    throw new Error('Survey area cannot be loaded, that is a problem...');
}

// Threshold distance for the trip geography to be considered the same location
const commonTripGeographyDistanceThresholdMeters = 50;

// Extracted current trip data getter from active trip id
const getCurentPersonJourneyTrip = (
    interview: UserInterviewAttributes,
    activeTripId: string
): [Person, Journey, Trip] => {
    const currentPerson = odSurveyHelpers.getActivePerson({ interview });
    if (currentPerson === null) {
        throw new Error('active trip ID server callback: current person not found in interview');
    }
    const currentJourney = odSurveyHelpers.getActiveJourney({ interview, person: currentPerson });
    if (currentJourney === null) {
        throw new Error('active trip ID server callback: current journey not found in interview');
    }
    const currentTrip = odSurveyHelpers.getTrips({ journey: currentJourney })[activeTripId];
    if (currentTrip === undefined) {
        throw new Error('active trip ID server callback: current trip not found in interview ');
    }
    return [currentPerson, currentJourney, currentTrip];
};

/**
 * Function to be called by the server callback for active trip, that prefills
 * the segments from the corresponding segments of the original common trip, if
 * the current trip seems to be a common one.
 * @param interview The interview
 * @param activeTripId The active trip ID
 * @returns
 */
export const getUpdatedFieldsForCommonTrip = (
    interview: UserInterviewAttributes,
    activeTripId: string
): Record<string, unknown> => {
    // Fill segment data: If the partial sample is set the
    // commonTrip and this is a common trip (same
    // origin/destination/times as a trip said to be common with
    // this person)
    const [currentPerson, currentJourney, currentTrip] = getCurentPersonJourneyTrip(interview, activeTripId);

    // If the trip already has segments, do not fill them again and
    // make sure the prefilled flag is set to `false` if the
    // segments are not new (not confirmed yet)
    const segments = odSurveyHelpers.getSegmentsArray({ trip: currentTrip });
    if (odSurveyHelpers.tripHasDefinedSegments({ trip: currentTrip })) {
        return segments.some((segment) => segment._isNew === false)
            ? {
                [`household.persons.${currentPerson._uuid}.journeys.${currentJourney._uuid}.trips.${currentTrip._uuid}._prefilledFromCommonTrip`]:
                      false
            }
            : {};
    }

    const commonTripsData = getCommonTripFromReferencePerson(interview, currentPerson);
    if (commonTripsData === null) {
        return {};
    }

    // Get the current trip's origin and destination to compare with the reference person's trips
    const visitedPlaces = odSurveyHelpers.getVisitedPlaces({ journey: currentJourney });
    const tripOrigin = odSurveyHelpers.getOrigin({ trip: currentTrip, visitedPlaces });
    const tripDestination = odSurveyHelpers.getDestination({ trip: currentTrip, visitedPlaces });
    if (tripOrigin === null || tripDestination === null) {
        return {};
    }

    // Find the trip with the same timings
    const referencePersonVisitedPlaces = odSurveyHelpers.getVisitedPlaces({
        journey: commonTripsData.journey
    });
    // Keep track of the matching trip and its origin/destination to get the geographies later
    let matchingTripOnTimesOrigin: ReturnType<typeof odSurveyHelpers.getOrigin> = null;
    let matchingTripOnTimesDestination: ReturnType<typeof odSurveyHelpers.getDestination> = null;
    let matchingTripOnTimes: Trip | undefined = undefined;
    for (const commonTrip of commonTripsData.trips) {
        const commonTripOrigin = odSurveyHelpers.getOrigin({
            trip: commonTrip,
            visitedPlaces: referencePersonVisitedPlaces
        });
        const commonTripDestination = odSurveyHelpers.getDestination({
            trip: commonTrip,
            visitedPlaces: referencePersonVisitedPlaces
        });
        if (commonTripOrigin === null || commonTripDestination === null) {
            continue; // Ignore trips with no origin or destination, like loop activities
        }
        // Found the trip that matches the current trip's timings, keep it
        // TODO Determine if we want to be more flexible with the timings or keep it strict
        if (
            commonTripOrigin.departureTime === tripOrigin.departureTime &&
            commonTripDestination.arrivalTime === tripDestination.arrivalTime
        ) {
            matchingTripOnTimes = commonTrip;
            matchingTripOnTimesOrigin = commonTripOrigin;
            matchingTripOnTimesDestination = commonTripDestination;
            break;
        }
    }

    if (matchingTripOnTimes === undefined) {
        return {};
    }

    // Make sure the trip's geographies are the same (within 50 meters)
    const matchingTripOriginGeography = odSurveyHelpers.getVisitedPlaceGeography({
        visitedPlace: matchingTripOnTimesOrigin,
        person: commonTripsData.person,
        interview
    });
    const matchingTripDestinationGeography = odSurveyHelpers.getVisitedPlaceGeography({
        visitedPlace: matchingTripOnTimesDestination,
        person: commonTripsData.person,
        interview
    });
    const tripOriginGeography = odSurveyHelpers.getVisitedPlaceGeography({
        visitedPlace: tripOrigin,
        person: currentPerson,
        interview
    });
    const tripDestinationGeography = odSurveyHelpers.getVisitedPlaceGeography({
        visitedPlace: tripDestination,
        person: currentPerson,
        interview
    });

    // No geography for some origins or destination, ignore the segments
    if (
        matchingTripOriginGeography === null ||
        matchingTripDestinationGeography === null ||
        tripOriginGeography === null ||
        tripDestinationGeography === null
    ) {
        return {};
    }

    const originDistance = turfDistance(matchingTripOriginGeography.geometry, tripOriginGeography.geometry, {
        units: 'meters'
    });
    const destinationDistance = turfDistance(
        matchingTripDestinationGeography.geometry,
        tripDestinationGeography.geometry,
        { units: 'meters' }
    );

    // Since 2 persons can share part of a trip, either origin or
    // destination geographies should be within a certain threshold
    // distance to be a common trip, but one end of the trip can be
    // different places.
    if (
        originDistance > commonTripGeographyDistanceThresholdMeters &&
        destinationDistance > commonTripGeographyDistanceThresholdMeters
    ) {
        return {};
    }

    // If we reach this point, the trip is considered a common trip
    // with the reference person, so we can fill the segments from
    // the reference person's trip
    const referenceSegments = odSurveyHelpers.getSegmentsArray({ trip: matchingTripOnTimes });
    // Only for unimodal trips, so if there are multiple segments, do not fill them
    if (referenceSegments.length !== 1) {
        return {};
    }

    // Copy segment, but special cases for carDriver/carPassenger and their specific fields (paidForParking, vehicleOccupancy, driver)
    const { _uuid, modePre, mode, paidForParking, vehicleOccupancy, driver, _isNew, ...segment } =
        referenceSegments[0] as any;

    // Fill current empty segment or create a new one
    const newSegment =
        segments[0] !== undefined
            ? {
                ...segments[0],
                ...segment
            }
            : {
                _uuid: uuidV4(),
                _isNew: true,
                ...segment
            };

    // If original mode is carPassenger and this person is the
    // driver, change to carDriver
    if (mode === 'carPassenger' && driver === currentPerson._uuid) {
        newSegment.mode = 'carDriver';
        newSegment.modePre = 'carDriver';
    } else if (mode === 'carDriver') {
        // If original mode is carDriver, change to carPassenger and set
        // driver as the reference person
        newSegment.mode = 'carPassenger';
        newSegment.modePre = 'carPassenger';
        // Set the driver as the reference person
        newSegment.driver = commonTripsData.person._uuid;
    } else {
        // Otherwise, keep previous mode and modePre
        newSegment.mode = mode;
        newSegment.modePre = modePre;
        if (mode === 'carPassenger') {
            // Keep the current driver
            newSegment.driver = driver;
        }
    }

    const updatedSegments: Record<string, unknown> = {
        [`household.persons.${currentPerson._uuid}.journeys.${currentJourney._uuid}.trips.${currentTrip._uuid}._prefilledFromCommonTrip`]:
            true
    };
    // If no previous segment, just assign the whole object, otherwise set field by field for UI to not reset the values when the widget becomes visible
    if (segments[0] === undefined) {
        updatedSegments[
            `household.persons.${currentPerson._uuid}.journeys.${currentJourney._uuid}.trips.${currentTrip._uuid}.segments.${newSegment._uuid}`
        ] = newSegment;
    } else {
        const previousSegment = segments[0];
        Object.keys(newSegment).forEach((key) => {
            if (previousSegment[key] !== newSegment[key]) {
                updatedSegments[
                    `household.persons.${currentPerson._uuid}.journeys.${currentJourney._uuid}.trips.${currentTrip._uuid}.segments.${newSegment._uuid}.${key}`
                ] = newSegment[key];
            }
        });
    }
    return updatedSegments;
};

/**
 * Function to be called by the server callback for active trip, gets whether a trip's origin and destination are in a pair of zats eligible to the barriers questions.
 * @param interview The interview
 * @param activeTripId The active trip ID
 * @returns
 */
export const getUpdatedFieldsForBarriers = (
    interview: UserInterviewAttributes,
    activeTripId: string
): Record<string, unknown> => {
    // Get the current trip data
    const [currentPerson, currentJourney, currentTrip] = getCurentPersonJourneyTrip(interview, activeTripId);

    // Ignore if origin and destinations are not found, or if either is a loop activity
    const visitedPlaces = odSurveyHelpers.getVisitedPlaces({ journey: currentJourney });
    const tripOrigin = odSurveyHelpers.getOrigin({ trip: currentTrip, visitedPlaces });
    const tripDestination = odSurveyHelpers.getDestination({ trip: currentTrip, visitedPlaces });
    if (
        tripOrigin === null ||
        tripDestination === null ||
        odSurveyHelpers.isLoopActivity({ visitedPlace: tripOrigin }) ||
        odSurveyHelpers.isLoopActivity({ visitedPlace: tripDestination })
    ) {
        return {};
    }
    // Ignore if the zats have not been found for both origin and destination
    const originGeography = odSurveyHelpers.getVisitedPlaceGeography({
        visitedPlace: tripOrigin,
        interview,
        person: currentPerson
    });
    const destinationGeography = odSurveyHelpers.getVisitedPlaceGeography({
        visitedPlace: tripDestination,
        interview,
        person: currentPerson
    });
    const originZat = originGeography !== null ? originGeography.properties.zat : null;
    const destinationZat = destinationGeography !== null ? destinationGeography.properties.zat : null;
    if (!(typeof originZat === 'number' && typeof destinationZat === 'number')) {
        return {};
    }

    // Get the value in the zat matrix
    const originZatRow = zatXzatEligibilityMatrix[originZat];
    const updatedSegments: Record<string, unknown> = {
        [`household.persons.${currentPerson._uuid}.journeys.${currentJourney._uuid}.trips.${currentTrip._uuid}._isBarrierEligible`]:
            originZatRow?.[destinationZat - 1] === 1 ? true : false
    };
    return updatedSegments;
};

/**
 * Add to the geography properties which zones they are in for certain zone
 * sets, or whether they are part of a zone/featureCollection for others.
 * @param geography The point for which to get the intersecting zones
 * @param path The path of this geography. The zones will be appended to the
 * `properties` of the geojson feature at the path.
 * @return The properties paths to update with the given data. This includes
 * `RA`, `zat` zone ids and boolean values for `isInTerritory` (surveyArea),
 * `isArtmZone` (artm territory), `isOnDemandTransitZone` (if in a zone with on demand
 * transport)
 */
export const updatePathsWithZonesIntersectingPoint = (geography: GeoJSON.Feature<GeoJSON.Point>, path: string) => {
    const responses = {
        [`${path}.properties.RA`]: getPointZone(geography),
        [`${path}.properties.zat`]: getZatForPoint(geography),
        [`${path}.properties.isInTerritory`]: booleanPointInPolygon(geography, surveyArea),
        [`${path}.properties.isArtmZone`]:
            artmTerritoryFeatureCollection.features.find((f) => booleanPointInPolygon(geography, f)) !== undefined,
        [`${path}.properties.isOnDemandTransitZone`]:
            onDemandZonesFeatureCollection.features.find((f) => booleanPointInPolygon(geography, f)) !== undefined
    };
    return responses;
};

/**
 * Call upon server startup, to make sure helpers are configured for the current
 * questionnaire's configuration
 *
 * FIXME It does not make sense to have to do this, to call the factory with
 * functions that do nothing. The configuration should depend on nothing
 * frontend-only and it should somewhat be more automatic, when the
 * questionnaire config is somewhere official in Evolution. Maybe in the project
 * config itself. The API is not stable enough for now though. Ftr, we need this
 * to enable the segment's next/previous location lookup from geojson
 * stations/stops files.
 */
export const setupQuestionnaire = () => {
    const questionnaireFactory = new QuestionnaireFactory(questionnaireConfiguration, {
        getFormattedDate: (date) => date,
        buttonActions: { validateButtonAction: () => true, validateButtonActionWithCompleteSection: () => true },
        iconMapper: {}
    });
    questionnaireFactory.buildSectionsAndWidgets();
};

/**
 * Calculate actual previous day from now, in the project's configured timezone
 * and using the trip diary's max time of day as rollover time instead of
 * midnight.
 *
 * TODO Move to Evolution, correctly handling possibly missing trip diary times
 * (now we know it is defined)
 *
 * @returns The previous day, in YYYY-MM-DD format
 */
export const getActualPreviousDay = () => {
    const maxTimeOfDay = questionnaireConfiguration.tripDiary!.sections.visitedPlaces!.tripDiaryMaxTimeOfDay;
    const now = moment.tz(new Date(), config.timezone || 'UTC');
    // Get the seconds since midnight of the current time
    const secondsSinceMidnight = now.hours() * 60 * 60 + now.minutes() * 60 + now.seconds() + now.milliseconds() / 1000;
    // Get the rollover time, which is the module of a full day of the max time of day (would be 0 if max time of day is midnight)
    const rolloverTimeOfDay = maxTimeOfDay % (24 * 60 * 60);
    // If current seconds since midnight is below rollover time, the trip diary
    // current day is not finished, so we go back 2 days.
    const daysToSubtract = secondsSinceMidnight < rolloverTimeOfDay ? 2 : 1;

    return now.subtract(daysToSubtract, 'days').format('YYYY-MM-DD');
};
