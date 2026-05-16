import _get from 'lodash/get';
import { _booleish, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import config from 'evolution-common/lib/config/project.config';
import { Journey, Person, WidgetConditional } from 'evolution-common/lib/services/questionnaire/types';
import * as surveyHelper from 'evolution-common/lib/utils/helpers';
import * as odSurveyHelper from 'evolution-common/lib/services/odSurvey/helpers';
import { loopActivities } from 'evolution-common/lib/services/odSurvey/types';
import { getShortcutVisitedPlaces } from './customFrontendHelper';
import { shouldAskForNoSchoolTripReason, shouldAskForNoWorkTripReason, shouldDisplayTripJunction } from './helper';
import { isStudentFromEnrolled } from './customHelpers';

const isSchoolEnrolledTrueValues = [
    'kindergarten',
    'childcare',
    'primarySchool',
    'secondarySchool',
    'schoolAtHome',
    'other'
];

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
    const schoolType: any = surveyHelper.getResponse(interview, path, null, '../schoolType');
    const isStudent: boolean = person.studentType === 'fullTime' || person.studentType === 'partTime';
    const isWorker: boolean = person.workerType === 'fullTime' || person.workerType === 'partTime';

    if (_isBlank(age) || _isBlank(person.workerType) || _isBlank(person.studentType)) {
        return [false, null];
    } else if (isStudent && isWorker) {
        return [false, 'workerAndStudent'];
    } else if (isStudent && person.studentType === 'fullTime') {
        return [false, 'fullTimeStudent'];
    } else if (isStudent && person.studentType === 'partTime') {
        return [false, 'partTimeStudent'];
    } else if (isWorker && person.workerType === 'fullTime') {
        return [false, 'fullTimeWorker'];
    } else if (isWorker && person.workerType === 'partTime') {
        return [false, 'partTimeWorker'];
    } else if (schoolType && !isSchoolEnrolledTrueValues.includes(schoolType)) {
        return [false, 'other'];
    }
    //condition if not hidden choices
    return [!_isBlank(age) && age >= 14 && !isStudent && !isWorker, null];
};

export const personUsualSchoolPlaceNameCustomConditional: WidgetConditional = (interview, path) => {
    const person = surveyHelper.getResponse(interview, path, null, '../../') as Person;
    const schoolPlaceType = person.schoolPlaceType;

    const childrenCase = isStudentFromEnrolled(person) && person.schoolType !== 'schoolAtHome';
    return [['onLocation', 'hybrid'].includes(schoolPlaceType) || childrenCase, null];
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

export const currentPlaceWorkOnTheRoadAndNoNextPlaceCustomConditional: WidgetConditional = (interview, path) => {
    const person = odSurveyHelper.getPerson({ interview });
    const journey = odSurveyHelper.getActiveJourney({ interview, person });
    const visitedPlace: any = surveyHelper.getResponse(interview, path, null, '../');
    const visitedPlaceActivity = visitedPlace.activity;
    const nextVisitedPlace = odSurveyHelper.getNextVisitedPlace({ journey, visitedPlaceId: visitedPlace._uuid });
    return [!nextVisitedPlace && visitedPlaceActivity === 'workOnTheRoad', null];
};

export const isLastPlaceCustomConditional: WidgetConditional = (interview, path) => {
    const person = odSurveyHelper.getPerson({ interview });
    const journey = odSurveyHelper.getActiveJourney({ interview, person });
    const visitedPlace: any = odSurveyHelper.getActiveVisitedPlace({ interview, journey });
    const visitedPlacesArray = odSurveyHelper.getVisitedPlacesArray({ journey });
    return (
        visitedPlacesArray.length > 1 && visitedPlacesArray[visitedPlacesArray.length - 1]._uuid === visitedPlace._uuid
    );
};

export const alreadyVisitedPlaceCustomConditional: WidgetConditional = (interview, path) => {
    const activity: any = surveyHelper.getResponse(interview, path, null, '../activity');
    // Do not display if no activity
    if (_isBlank(activity)) {
        return [false, null];
    }
    // Do not display if it is an incompatible activity
    const incompatibleActivity = [...loopActivities, 'home'].includes(activity);
    if (incompatibleActivity) {
        return [false, null];
    }

    // Do not display if usual place is already set
    const person = odSurveyHelper.getPerson({ interview });
    if (
        (activity === 'workUsual' && (person as any).usualWorkPlace && (person as any).usualWorkPlace.geography) ||
        (activity === 'schoolUsual' && (person as any).usualSchoolPlace && (person as any).usualSchoolPlace.geography)
    ) {
        return [false, null];
    }

    // Display if there are possible shortcuts
    const geography: any = surveyHelper.getResponse(interview, path, null, '../geography');
    let lastAction = null;
    if (geography) {
        lastAction = _get(geography, 'properties.lastAction', null);
    }
    const shortcuts = getShortcutVisitedPlaces(interview);
    return [(lastAction === null || lastAction === 'shortcut') && shortcuts.length > 0, null];
};

const peopleCountQuestionModes = ['carDriver', 'rentalCar', 'carDriverCarsharing'];
export const isSelfDeclaredCarDriverCustomConditional: WidgetConditional = (interview, path) => {
    const segment: any = surveyHelper.getResponse(interview, path, null, '../');
    // Display for respondent car drivers (exlude motorcycle)
    if (segment.modePre !== 'carDriver') {
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

export const shouldAskTripJunctionCustomConditional: WidgetConditional = (interview, path) => {
    const person = odSurveyHelper.getPerson({ interview });
    const trip = odSurveyHelper.getActiveTrip({ interview });
    if (trip) {
        const journey = odSurveyHelper.getActiveJourney({ interview, person });
        const visitedPlaces = odSurveyHelper.getVisitedPlaces({ journey });
        const destination = odSurveyHelper.getDestination({ visitedPlaces, trip });
        const activity = destination ? destination.activity : null;
        const segments = odSurveyHelper.getSegmentsArray({ trip });
        const currentSegment: any = surveyHelper.getResponse(interview, path, undefined, '../');
        const segmentIndex = segments.findIndex((segment) => segment._sequence === currentSegment?._sequence);
        if (segmentIndex === undefined || segmentIndex === 0) {
            return [false, null];
        }
        const previousSegment = segments[segmentIndex - 1];
        return [shouldDisplayTripJunction(previousSegment, currentSegment, activity), null];
    }
    return [false, null];
};

export const shouldAskForNoWorkTripReasonCustomConditional: WidgetConditional = (interview, path) => {
    const person = odSurveyHelper.getPerson({ interview, path });
    return [shouldAskForNoWorkTripReason({ interview, person }), null];
};

export const shouldAskPersonNoWorkTripSpecifyCustomConditional: WidgetConditional = (interview, path) => {
    const reason = surveyHelper.getResponse(interview, path, null, '../noWorkTripReason');
    return [reason === 'other', null];
};

export const shouldAskForNoSchoolTripReasonCustomConditional: WidgetConditional = (interview, path) => {
    const person = odSurveyHelper.getPerson({ interview, path });
    return [shouldAskForNoSchoolTripReason({ interview, person }), null];
};

export const shouldAskForNoSchoolTripSpecifyCustomConditional: WidgetConditional = (interview, path) => {
    const reason = surveyHelper.getResponse(interview, path, null, '../noSchoolTripReason');
    return [reason === 'other', null];
};

export const accessCodeIsSetCustomConditional: WidgetConditional = (interview, path) => {
    // Do not show the access code if it is set and confirmed, but keep its value, to avoid the participant changing its value
    const accessCodeConfirmed = surveyHelper.getResponse(interview, '_accessCodeConfirmed', false);
    const accessCode = surveyHelper.getResponse(interview, path, null);
    return [!accessCodeConfirmed, accessCode];
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
    const canRespondPersons = interviewablePersons.filter((person) => person.age >= config.selfResponseMinimumAge);
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
    // Show for partial sample 'paidParking'
    const epExclusif = surveyHelper.getResponse(interview, 'epExclusif', null);
    if (segment.mode !== 'carDriver' && epExclusif === 'paidParking') {
        return [false, null];
    }
    // FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/17
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
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/37
export const subwayTransferCustomConditional: WidgetConditional = (interview, path) => {
    const subwayStationStart = surveyHelper.getResponse(interview, path, null, '../subwayStationStart');
    const subwayStationEnd = surveyHelper.getResponse(interview, path, null, '../subwayStationEnd');
    if (_isBlank(subwayStationStart) || _isBlank(subwayStationEnd)) {
        return [false, null];
    }
    // FIXME Implement the rest of the condition
    return [false, null];
};

// Custom conditional to validate if a segment is of a certain mode and if the
// nearest bound (segment origin or destination) is in the territory of the
// survey
//  FIXME Implement correctly. See https://github.com/chairemobilite/od_mtl/issues/26, 27, 28, 30, 31, 32
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
            // FIXME Get the geography of the origin or destination
            return [false, null];
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
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/38
export const tripCommunCustomConditional: WidgetConditional = (interview, path) => {
    return [false, null];
};
