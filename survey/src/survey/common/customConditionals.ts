import _get from 'lodash/get';
import { booleanPointInPolygon as turfBooleanPointInPolygon } from '@turf/turf';
import { _booleish, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import config from 'evolution-common/lib/config/project.config';
import { Person, WidgetConditional } from 'evolution-common/lib/services/questionnaire/types';
import * as surveyHelper from 'evolution-common/lib/utils/helpers';
import * as odSurveyHelper from 'evolution-common/lib/services/odSurvey/helpers';
import { shouldAskForNoSchoolTripFollowup, shouldAskForNoWorkTripReason } from './helper';
import { shouldShowToddlerDayCareQuestions } from './customHelpers';
import sdrResidencesSecondaires from '../geojson/sdr_residences_secondaires.json';
import transitZones from '../geojson/zones_tarifaires.json';
import { isCommonTripSampleMatch, isPartialSample } from './commonHelpers';
import metroTransfers from '../config/metroTransfers.json';
import {
    getSegmentNextLocation,
    getSegmentPreviousLocation
} from 'evolution-common/lib/services/questionnaire/sections/segments/helpers';

// Don't show Question and give 'Québec' as default value
export const hiddenWithQuebecAsDefaultValueCustomConditional: WidgetConditional = (_interview) => {
    return [false, 'Québec'];
};

// Don't show Question and give 'Canada' as default value
export const hiddenWithCanadaAsDefaultValueCustomConditional: WidgetConditional = (_interview) => {
    return [false, 'Canada'];
};

// Stay hidden and put some default value if the person is a student or a worker
export const personOccupationCustomConditional: WidgetConditional = (interview, path) => {
    const person = surveyHelper.getResponse(interview, path, null, '../') as Person;
    const age: any = surveyHelper.getResponse(interview, path, null, '../age');
    // If age is not a number, do not display
    if (typeof age !== 'number') {
        return [false, null];
    }
    const isStudent: boolean = person.studentType === 'fullTime' || person.studentType === 'partTime';
    // Infer student status of youth depending on mandatory school age
    const isYouthStudent: boolean = age <= config.ages.schoolMandatoryAge;
    const isTooYoungToWork: boolean = age < config.ages.workingAge;
    const isWorker: boolean = person.workerType === 'fullTime' || person.workerType === 'partTime';

    if ((!isTooYoungToWork && _isBlank(person.workerType)) || (!isYouthStudent && _isBlank(person.studentType))) {
        return [false, null];
    } else if ((isStudent || isYouthStudent) && isWorker) {
        return [false, 'workerAndStudent'];
    } else if (isYouthStudent) {
        return [false, 'fullTimeStudent'];
    } else if (isStudent && person.studentType === 'fullTime') {
        return [false, 'fullTimeStudent'];
    } else if (isStudent && person.studentType === 'partTime') {
        return [false, 'partTimeStudent'];
    } else if (isWorker && person.workerType === 'fullTime') {
        return [false, 'fullTimeWorker'];
    } else if (isWorker && person.workerType === 'partTime') {
        return [false, 'partTimeWorker'];
    }
    // condition if not hidden choices. Assume retired if person is age 70+
    return [age >= 16 && age <= 69 && !isStudent && !isWorker, age >= 70 ? 'retired' : null];
};

export const departurePlaceOtherCustomConditional: WidgetConditional = (interview, path) => {
    const journey = odSurveyHelper.getActiveJourney({ interview });
    if (journey === null) {
        return [false, null];
    }
    const personDidTrips = (journey as any).personDidTrips;
    const personDidTripsConfirm = (journey as any).personDidTripsConfirm;
    const firstVisitedPlace = odSurveyHelper.getVisitedPlacesArray({
        journey
    })[0];
    const departurePlaceOther = (journey as any).departurePlaceOther;
    if (firstVisitedPlace && firstVisitedPlace.activity && firstVisitedPlace.activity !== 'home') {
        // FIXME should we make sure the departurePlaceOther is one of he possible choices? We have something similar in the `onSectionEntry` of the tripsIntro section... maybe we don't need this here
        return [false, departurePlaceOther];
    }
    return [
        (_booleish(personDidTrips) || _booleish(personDidTripsConfirm)) &&
            !_isBlank((journey as any).departurePlaceIsHome) &&
            _booleish((journey as any).departurePlaceIsHome) === false,
        null
    ];
};

const peopleCountQuestionModes = ['carDriver', 'rentalCar', 'carDriverCarsharing'];
export const isSelfDeclaredCarDriverCustomConditional: WidgetConditional = (interview, path) => {
    const segment: any = surveyHelper.getResponse(interview, path, null, '../');
    // Display for respondent car drivers (exlude motorcycle), only for mtmd sample
    if (segment.modePre !== 'carDriver' && !isPartialSample(interview, 'mtmd')) {
        return [false, null];
    }
    const person = odSurveyHelper.getActivePerson({ interview });
    return [
        odSurveyHelper.isSelfDeclared({ interview, person }) && peopleCountQuestionModes.includes(segment.mode),
        null
    ];
};

// Show if mode is transitTaxi, or if mode is transitBus (and not nationale variant) and busLines include 'dontKnow' or 'other'.
export const shouldDisplayOnDemandTypeCustomConditional: WidgetConditional = (interview, path) => {
    const mode = surveyHelper.getResponse(interview, path, null, '../mode');
    const busLines = surveyHelper.getResponse(interview, path, [], '../busLines') as any[];
    const isNotNationale = process.env.EV_VARIANT !== 'nationale'; // Check if EV_VARIANT is not 'nationale'

    // Show if mode is transitTaxi, or if mode is transitBus (and not nationale variant) and busLines include 'dontKnow' or 'other'.
    const shouldDisplay =
        mode === 'transitTaxi' ||
        (isNotNationale &&
            mode === 'transitBus' &&
            busLines.length > 0 &&
            (busLines.includes('dontKnow') || busLines.includes('other')));

    return [shouldDisplay, null];
};

export const shouldAskForNoWorkTripReasonCustomConditional: WidgetConditional = (interview, path) => {
    const person = odSurveyHelper.getPerson({ interview, path });
    return [shouldAskForNoWorkTripReason({ interview, person }), null];
};

export const shouldAskPersonNoWorkTripSpecifyCustomConditional: WidgetConditional = (interview, path) => {
    const reason = surveyHelper.getResponse(interview, path, null, '../noWorkTripReason');
    return [reason === 'other', null];
};

export const shouldAskForNoSchoolTripSpecifyCustomConditional: WidgetConditional = (interview, path) => {
    const reason = surveyHelper.getResponse(interview, path, null, '../noSchoolTripReason');
    return [reason === 'other', null];
};

// FIXME This conditional is used instead of the non custom
// `hasHouseholdSize2OrMoreConditional` because the person count can change in
// the household section without changing the household size. When
// https://github.com/chairemobilite/evolution/issues/1132 is fixed and this
// survey correctly updated, this custom conditional won't be necessary
export const hasPersonCount2OrMoreCustomConditional: WidgetConditional = (interview, path) => {
    const personCount = odSurveyHelper.countPersons({ interview });
    return [personCount >= 2, null];
};

// Custom conditional on the number of possible self-respondents
export const if2OrMorePersons14OrMoreYearsOldCustomConditional: WidgetConditional = (interview, path) => {
    const interviewablePersons = odSurveyHelper.getInterviewablePersonsArray({ interview });
    const canRespondPersons = interviewablePersons.filter((person) => person.age >= config.ages.selfResponseMinimumAge);
    return [canRespondPersons.length > 1, canRespondPersons.length === 1 ? canRespondPersons[0]._uuid : null];
};

// Custom condition to see if a person declared trips, ie has visited places, but said they did not do trips
export const personDeclaredTripsCustomConditional: WidgetConditional = (interview, path) => {
    const activeJourney = odSurveyHelper.getActiveJourney({ interview });
    if (activeJourney === null) {
        return [false, null];
    }
    const personDidTrips = activeJourney.personDidTrips;
    const visitedPlaces = odSurveyHelper.getVisitedPlacesArray({
        journey: activeJourney
    });
    if (_isBlank(personDidTrips)) {
        return [false, null];
    }
    return [_booleish(personDidTrips) === false && visitedPlaces.length > 1, null];
};

// Custon conditional validating that the person did trips, but there is yet no first place activity
// FIXME Validate that this works as intended in the case where the participant changed his mind and needs to confirm
export const personDidTripsAndDeparturePlaceNotSetCustomConditional: WidgetConditional = (interview, path) => {
    const journeyContext = odSurveyHelper.getJourneyContextFromPath({ interview, path });
    if (!journeyContext) {
        throw new Error('personDidTripsAndDeparturePlaceNotSetCustomConditional: Journey context not found');
    }
    const { journey } = journeyContext;
    const departurePlaceIsHome = journey.departurePlaceIsHome;
    const firstVisitedPlace = odSurveyHelper.getVisitedPlacesArray({ journey })[0];
    const personDidTrips = journey.personDidTrips;
    const personDidTripsConfirm = journey.personDidTripsConfirm;
    // Do not show if person did trips is not true, or if the confirmation is blank or false
    // FIXME Why would the personDidTrips be blank, but not the personDidTripsConfirm? Was like that in od_nationale_quebec too (and probably before that)
    if (
        _booleish(personDidTrips) !== true ||
        (_isBlank(personDidTrips) && _booleish(personDidTripsConfirm) === false)
    ) {
        return [false, null];
    } else if (firstVisitedPlace && (firstVisitedPlace.activity || firstVisitedPlace.activityCategory)) {
        // If there are places defined already, use its type to ask the activity, but do not show the question
        return [false, firstVisitedPlace.activity === 'home' ? 'yes' : 'no'];
    }
    return [!_isBlank(personDidTrips), departurePlaceIsHome];
};

// Conditional to show if the station of the current segment is served by transport on demand.
export const stationServedByTADCustomConditional: WidgetConditional = (interview, path) => {
    // FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/101
    return [false, null];
};

// Conditional to show if the current segment is a local transit trip and the distance is a certain threshold or more
const localTransitModes = [
    'transitBus',
    'transitRRT',
    'transitLRRT',
    'transitRegionalRail',
    'transitStreetCar',
    'transitTaxi',
    'transitFerry'
];
export const isTransitModeAndDistanceFromOriginCustomConditional: WidgetConditional = (interview, path) => {
    const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('isTransitModeAndDistanceFromOriginCustomConditional label: Segment context not found');
    }
    const { person, journey, trip, segment } = segmentContext;
    const isTransitMode = localTransitModes.includes(segment.mode);
    if (!isTransitMode) {
        return [false, null];
    }
    // FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/25
    return [false, null];
};

export const isTransitModeAndDistanceToDestinationCustomConditional: WidgetConditional = (interview, path) => {
    const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('isTransitModeAndDistanceToDestinationCustomConditional label: Segment context not found');
    }
    const { person, journey, trip, segment } = segmentContext;
    const isTransitMode = localTransitModes.includes(segment.mode);
    if (!isTransitMode) {
        return [false, null];
    }
    // FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/33
    return [false, null];
};

// Conditional to show if the current segment is an intercity mode and the origin is in the territory
const intercityModes = ['intercityBus', 'intercityTrain', 'plane'];
export const isIntercityAndOriginInTerritoryCustomConditional: WidgetConditional = (interview, path) => {
    const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('isIntercityAndOriginInTerritoryCustomConditional label: Segment context not found');
    }
    const { person, journey, trip, segment } = segmentContext;
    const isIntercityMode = intercityModes.includes(segment.mode);
    if (!isIntercityMode) {
        return [false, null];
    }
    // FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/29
    return [false, null];
};

// Conditional to show if the current segment is an intercity mode and the destination is in the territory
export const isIntercityAndDestinationInTerritoryCustomConditional: WidgetConditional = (interview, path) => {
    const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('isIntercityAndDestinationInTerritoryCustomConditional label: Segment context not found');
    }
    const { person, journey, trip, segment } = segmentContext;
    const isIntercityMode = intercityModes.includes(segment.mode);
    if (!isIntercityMode) {
        return [false, null];
    }
    // FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/34
    return [false, null];
};

// Conditional to show if the current trip destination is a usual workplace
export const isDestinationWorkCustomConditional: WidgetConditional = (interview, path) => {
    const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('isDestinationWorkCustomConditional label: Segment context not found');
    }
    const { journey, trip } = segmentContext;
    const visitedPlaces = odSurveyHelper.getVisitedPlaces({ journey });
    const destination = odSurveyHelper.getDestination({ trip, visitedPlaces });
    return destination.activity === 'workUsual';
};

// Conditional to show if the current trip destination is not a usual workplace
export const isDestinationNotWorkCustomConditional: WidgetConditional = (interview, path) => {
    const destinationIsWork = isDestinationWorkCustomConditional(interview, path);
    return [!destinationIsWork, null];
};

// Condtional to show, for partial sample, if the current segment is car driver and is in the right zone to ask about paid parking
export const isCarDriverAndShouldShowPaidParkingCustomConditional: WidgetConditional = (interview, path) => {
    const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('isCarDriverAndShouldShowPaidParkingCustomConditional label: Segment context not found');
    }
    const { journey, trip, segment } = segmentContext;
    // Show for partial sample 'paidParking' and car driver
    if (segment.mode !== 'carDriver' || !isPartialSample(interview, 'paidParking')) {
        return [false, null];
    }

    // Validation de la région d'analyse + motifs
    const tripDestination = odSurveyHelper.getDestination({
        trip,
        visitedPlaces: odSurveyHelper.getVisitedPlaces({ journey })
    });
    if (tripDestination && tripDestination.geography) {
        const destinationRegion = (tripDestination.geography.properties as any).RA;
        if (typeof destinationRegion !== 'number') {
            return [false, null];
        }
        /*
        ```
        RA x motifs spécifiés:
            (usualSchoolPlace || norUsualSchoolPlace) && RA8 IN 1:8
            usualWorkPlace && RA8 IN 1:6
            leisure && RA8 IN 1:2
            helth && RA8 IN 1:2
            notUsualWorkPlace && RA IN 1:2
            visit && RA8 == 1
            shopping && RA8 == 1
        ```
        */
        if (tripDestination.activity === 'schoolUsual' || tripDestination.activity === 'schoolNotUsual') {
            return [true, null];
        } else if (tripDestination.activity === 'workUsual') {
            return [destinationRegion <= 6, null];
        } else if (
            tripDestination.activityCategory === 'leisure' ||
            tripDestination.activity === 'medical' ||
            tripDestination.activity === 'workNotUsual'
        ) {
            return [destinationRegion <= 2, null];
        } else if (tripDestination.activity === 'visiting') {
            return [destinationRegion === 1, null];
        } else if (tripDestination.activity === 'shopping') {
            return [destinationRegion === 1, null];
        }
    }
    return [false, null];
};

const publicModesForJunctions = ['transitBus'];
const privateModesForJunctions = ['carDriver', 'rentalCar', 'carDriverCarsharing', 'motorcycle', 'carPassenger'];
export const junctionBusPrivateCustomConditional: WidgetConditional = (interview, path) => {
    const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('junctionBusPrivateCustomConditional label: Segment context not found');
    }
    const { trip, segment } = segmentContext;
    // Do not show if the current segment is not a private mode
    if (_isBlank(segment.mode) || !privateModesForJunctions.includes(segment.mode)) {
        return [false, null];
    }
    // Show if the previous segment is a public mode
    const segments = odSurveyHelper.getSegmentsArray({ trip });
    const previousSegment = segments.find((s) => s._sequence === segment._sequence - 1);
    return [
        previousSegment && !_isBlank(previousSegment.mode) && publicModesForJunctions.includes(previousSegment.mode),
        null
    ];
};

export const junctionPrivateBusCustomConditional: WidgetConditional = (interview, path) => {
    const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('junctionPrivateBusCustomConditional label: Segment context not found');
    }
    const { trip, segment } = segmentContext;
    // Do not show if the current segment is not a public mode
    if (_isBlank(segment.mode) || !publicModesForJunctions.includes(segment.mode)) {
        return [false, null];
    }
    // Show if the previous segment is a private mode
    const segments = odSurveyHelper.getSegmentsArray({ trip });
    const previousSegment = segments.find((s) => s._sequence === segment._sequence - 1);
    return [
        previousSegment && !_isBlank(previousSegment.mode) && privateModesForJunctions.includes(previousSegment.mode),
        null
    ];
};

// Custom conditional to show if current segment is transit and previous carDriver and no parking info yet
// FIXME Validate current segment mode https://github.com/chairemobilite/od_mtl/issues/37
export const junctionPaidParkingCustomConditional: WidgetConditional = (interview, path) => {
    const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('isCarDriverAndShouldShowPaidParkingCustomConditional label: Segment context not found');
    }
    const { trip, segment } = segmentContext;
    // Do not show if the current segment is not a transit mode
    if (_isBlank(segment.mode) || !localTransitModes.includes(segment.mode)) {
        return [false, null];
    }
    // Show if the previous segment is mode carDriver and doesn't have paid parking information already
    const segments = odSurveyHelper.getSegmentsArray({ trip });
    const previousSegment = segments.find((s) => s._sequence === segment._sequence - 1);
    if (previousSegment && previousSegment.mode === 'carDriver' && _isBlank(previousSegment.paidForParking)) {
        return [true, null];
    }
    return [false, null];
};

// Custom conditional to show if the pair of segment entry/exit subway stations
// requires a question about the subway transfer station
export const subwayTransferCustomConditional: WidgetConditional = (interview, path) => {
    const subwayStationStart = surveyHelper.getResponse(interview, path, null, '../subwayStationStart');
    const subwayStationEnd = surveyHelper.getResponse(interview, path, null, '../subwayStationEnd');
    if (_isBlank(subwayStationStart) || _isBlank(subwayStationEnd)) {
        return [false, null];
    }
    const metroTransferData = metroTransfers[subwayStationStart as string]?.[subwayStationEnd as string];
    if (metroTransferData !== undefined) {
        // Afficher ou non selon la matrice de transfer
        if (metroTransferData.display) {
            return [true, null];
        } else {
            return [false, metroTransferData.value];
        }
    }
    // Fallback to `false` with value of 'none'
    return [false, 'none'];
};

// Custom conditional to validate if a segment is of a certain mode and if the
// nearest bound (segment origin or destination) is in the territory of the
// survey
export const isModeAndSegmentLocationInTerritoryCustomConditional =
    (mode: string, location: 'origin' | 'destination'): WidgetConditional =>
        (interview, path) => {
            const segmentContext = odSurveyHelper.getSegmentContextFromPath({ interview, path });
            if (!segmentContext) {
                throw new Error(
                    'isModeAndSegmentLocationInTerritoryCustomConditional: Segment context not found for path ' + path
                );
            }
            const { trip, segment } = segmentContext;
            // Return false if the mode is not the expected one
            if (segment.mode !== mode) {
                return [false, null];
            }
            // Get the segment's previous/next location and display if it is in territory
            const locationGeography =
            location === 'origin'
                ? getSegmentPreviousLocation({ interview, ...segmentContext })
                : getSegmentNextLocation({ interview, ...segmentContext });
            return [locationGeography !== null && locationGeography.properties.isInTerritory === true, null];
        };

export const isPlaneAndSegmentOriginInTerritoryCustomConditional: WidgetConditional =
    isModeAndSegmentLocationInTerritoryCustomConditional('plane', 'origin');

export const isIntercityRailAndSegmentOriginInTerritoryCustomConditional: WidgetConditional =
    isModeAndSegmentLocationInTerritoryCustomConditional('intercityTrain', 'origin');

export const isIntercityBusAndSegmentOriginInTerritoryCustomConditional: WidgetConditional =
    isModeAndSegmentLocationInTerritoryCustomConditional('intercityBus', 'origin');

export const isPlaneAndSegmentDestinationInTerritoryCustomConditional: WidgetConditional =
    isModeAndSegmentLocationInTerritoryCustomConditional('plane', 'destination');

export const isIntercityRailAndSegmentDestinationInTerritoryCustomConditional: WidgetConditional =
    isModeAndSegmentLocationInTerritoryCustomConditional('intercityTrain', 'destination');

export const isIntercityBusAndSegmentDestinationInTerritoryCustomConditional: WidgetConditional =
    isModeAndSegmentLocationInTerritoryCustomConditional('intercityBus', 'destination');

// Custom conditional to decide whether to show the common trip question
export const commonTripCustomConditional: WidgetConditional = (interview, path) => {
    // Make sure we have the right ep and the household matches
    if (!isCommonTripSampleMatch(interview)) {
        return [false, null];
    }
    const tripContext = odSurveyHelper.getTripContextFromPath({ interview, path });
    if (tripContext === null) {
        throw new Error('commonTripCustomConditional: trip context cannot be found for path' + path);
    }
    const { person, trip } = tripContext;

    // Validate if this person should see the question (first interviewable person)
    const commonTripRefPersonId = surveyHelper.getResponse(interview, '_commonTripRefPersonId');
    if (commonTripRefPersonId !== person._uuid) {
        return [false, null];
    }

    // If the last segment has no next segment
    const segments = odSurveyHelper.getSegmentsArray({ trip });
    if (segments.length > 0 && segments[segments.length - 1].hasNextMode === false) {
        return [true, null];
    }
    return [false, null];
};

export const shouldAskForNoSchoolTripFollowupCustomConditional: WidgetConditional = (interview, path) => {
    const person = odSurveyHelper.getPerson({ interview, path });
    return [shouldAskForNoSchoolTripFollowup({ interview, person }), null];
};

// Custom conditional: same as shouldAskForNoWorkTripReasonCustomConditional, but additional check for work place type
const workPlaceTypesWithFixedLocation = ['onLocation', 'hybrid', 'onTheRoadWithUsualPlace'];
export const hasWorkingLocationNotSetCustomConditional: WidgetConditional = (interview, path) => {
    const person = odSurveyHelper.getPerson({ interview, path });
    if (!person) {
        return [false, null];
    }
    const shouldAskForNoWorkTripReasonValue = shouldAskForNoWorkTripReason({ interview, person });
    return [shouldAskForNoWorkTripReasonValue && workPlaceTypesWithFixedLocation.includes(person.workPlaceType), null];
};

// Custom conditional to show if the home geography is in one of the SDR zones with secondary residences
export const sdrWithSecondaryHousesCustomConditional: WidgetConditional = (interview, path) => {
    const homeGeography = surveyHelper.getResponse(
        interview,
        path,
        null,
        '../geography'
    ) as GeoJSON.Feature<GeoJSON.Point> | null;
    if (homeGeography?.type === 'Feature') {
        return [
            sdrResidencesSecondaires.features.some((feature) =>
                turfBooleanPointInPolygon(
                    homeGeography,
                    feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
                )
            ),
            null
        ];
    }
    return [false, null];
};

type TransitZoneProperties = {
    OBJECTID: number;
    a_ZT: 'A' | 'B' | 'C' | 'D';
    a_NOMZT: string;
};
const transitFareToZT = {
    A: ['A'],
    AB: ['B'],
    ABC: ['C'],
    ABCD: ['D'],
    bus: ['B', 'C'],
    busCD: ['D']
} as const;
export const transitFareWarningCustomConditional: WidgetConditional = (interview, path) => {
    const homeGeography = surveyHelper.getResponse(
        interview,
        'home.geography'
    ) as GeoJSON.Feature<GeoJSON.Point> | null;
    const selectedTransitFare = surveyHelper.getResponse(interview, path, null, '../transitFare');
    // See if the home location is in a transit zone that is not included in the selected fare.
    if (
        homeGeography?.type === 'Feature' &&
        typeof selectedTransitFare === 'string' &&
        transitFareToZT[selectedTransitFare] !== undefined
    ) {
        const transitZone = transitZones.features.find((zone) =>
            turfBooleanPointInPolygon(
                homeGeography,
                zone as GeoJSON.Feature<GeoJSON.MultiPolygon | GeoJSON.Polygon, TransitZoneProperties>
            )
        );
        if (transitZone && !transitFareToZT[selectedTransitFare].includes(transitZone.properties.a_ZT)) {
            return [true, null];
        }
    }
    return [false, null];
};

// Custom because needs an array of 2 or more for the mobility assistive devices question
export const mostUsedMobilityAssistiveDeviceCustomConditional: WidgetConditional = (interview, path) => {
    const mobilityDevices = surveyHelper.getResponse(interview, path, null, '../mobilityAssistiveDevices');
    if (Array.isArray(mobilityDevices) && mobilityDevices.length > 1) {
        return [true, null];
    }
    return [false, Array.isArray(mobilityDevices) && mobilityDevices.length === 1 ? mobilityDevices[0] : null];
};

// Custom conditional to decide whether to show the toddler daycare question
export const toddlerDaycareCustomConditional: WidgetConditional = (interview) => [
    shouldShowToddlerDayCareQuestions(interview),
    null
];

export const hasMoreThanOneSelfRespondentCustomConditional: WidgetConditional = (interview) =>
    odSurveyHelper
        .getPersonsArray({ interview })
        .filter((person) => odSurveyHelper.isSelfDeclared({ interview, person })).length > 1;

export const hasMoreThanOneSelfRespondentDefaultYesCustomConditional: WidgetConditional = (interview, path) => {
    if (!hasMoreThanOneSelfRespondentCustomConditional(interview, path)) {
        return [false, 'yes'];
    }
    return true;
};

export const hasOnePersonWithDisabilityOrHhSize1CustomConditional: WidgetConditional = (interview, path) => {
    const person = odSurveyHelper.getPerson({ interview, path });
    const householdSize = surveyHelper.getResponse(interview, 'household.size');
    const hhAtLeastOnePersonWithDisability = surveyHelper.getResponse(
        interview,
        'household.atLeastOnePersonWithDisability'
    );

    // Show if household size is 1
    if (typeof householdSize === 'number' && householdSize === 1) {
        return true;
    }
    // Show only if the person is aged above interviewable age and there's persons with disabilities in the household
    if (typeof person.age === 'number' && person.age < config.ages.interviewableAge) {
        return [false, null];
    }
    return hhAtLeastOnePersonWithDisability === 'yes' ? true : [false, hhAtLeastOnePersonWithDisability];
};
