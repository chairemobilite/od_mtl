// Ce fichier contient des fonctions utilisées uniquement dans le backend.
// Idéalement, les fonctions de calculs géographiques avec des geojson complexes
// (zones) devraient s'exécuter uniquement sur le backend pour éviter l'envoi de
// geojson volumineux sur les clients.

import { booleanPointInPolygon, distance as turfDistance } from '@turf/turf';
import { v4 as uuidV4 } from 'uuid';
import zatZones from '../geojson/zat_artm.json';
import type {
    Journey,
    Person,
    Trip,
    UserInterviewAttributes,
    VisitedPlace
} from 'evolution-common/lib/services/questionnaire/types';
import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import { getCommonTripFromReferencePerson } from '../common/commonHelpers';
import { zatXzatEligibilityMatrix } from '../config/zat_x_zat_matrix';

const zatZonesFeatureCollection = zatZones as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>;

export const getZatForPoint = (geography: GeoJSON.Feature<GeoJSON.Point>): number | null => {
    const zat = zatZonesFeatureCollection.features.find((raZone) => booleanPointInPolygon(geography.geometry, raZone));
    return zat !== undefined ? zat.properties.zt23 : null;
};

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
    if (segments.length > 0) {
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
    const newSegment = {
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
            true,
        [`household.persons.${currentPerson._uuid}.journeys.${currentJourney._uuid}.trips.${currentTrip._uuid}.segments.${newSegment._uuid}`]:
            newSegment
    };
    return updatedSegments;
};

// Get the place's zat. It is usually in the place itself (set when setting the
// geography). If the activity is home though, get it from `home.zat`
const getPlaceZat = ({
    place,
    interview
}: {
    place: VisitedPlace;
    interview: UserInterviewAttributes;
}): number | null => {
    if (typeof (place as any).zat === 'number') {
        return (place as any).zat;
    }
    if (place.activity === 'home' && typeof (interview.response.home as any)?.zat === 'number') {
        return (interview.response.home! as any).zat;
    }
    return null;
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
    const originZat = getPlaceZat({ place: tripOrigin, interview });
    const destinationZat = getPlaceZat({ place: tripDestination, interview });
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
