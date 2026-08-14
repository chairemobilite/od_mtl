import { TFunction } from 'i18next';
import moment from 'moment';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    I18nData,
    InterviewAttributes,
    UserInterviewAttributes
} from 'evolution-common/lib/services/questionnaire/types';
import * as odHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import {
    getChildrenAged1To4,
    getFormattedTripDateFromJourney,
    getSelfRespondentWithDisabilitiesAndTrip
} from './customHelpers';
import i18n from 'evolution-frontend/lib/config/i18n.config';
import { getResponse, translateString } from 'evolution-common/lib/utils/helpers';
import {
    getFormattedDate,
    secondsSinceMidnightToTimeStrWithSuffix
} from 'evolution-frontend/lib/services/display/frontendHelper';
import { transitFareType } from './choices';

const labelWithJourneyDate =
    (translationKey: string): I18nData =>
        (t: TFunction, interview, path) => {
            const journeyContext = odHelpers.getJourneyContextFromPath({ interview, path });
            if (!journeyContext) {
                throw new Error(`${translationKey} label: Journey context not found`);
            }
            const { person, journey } = journeyContext;
            const journeyDate = getFormattedTripDateFromJourney(journey);
            return t(translationKey, {
                context: odHelpers.getPersonGenderContext({ person }),
                nickname: odHelpers.getPersonIdentificationString({ person, t }),
                journeyDate,
                count: odHelpers.getCountOrSelfDeclared({ interview, person })
            });
        };

// Custom because of the presence of the journey date in the label
export const personDidTripsCustomLabel: I18nData = labelWithJourneyDate('tripsIntro:personDidTrips');

// Custom because of the presence of the journey date in the label
export const personDidTripsConfirmCustomLabel: I18nData = labelWithJourneyDate('tripsIntro:personDidTripsConfirm');

// Custom because of the presence of the journey date in the label
export const visitedPlacesIntroCustomLabel: I18nData = labelWithJourneyDate('tripsIntro:visitedPlacesIntro');

// Custom because of the presence of the journey dates and address in the label
export const departurePlaceIsHomeCustomLabel: I18nData = (t: TFunction, interview, path) => {
    const journeyContext = odHelpers.getJourneyContextFromPath({ interview, path });
    if (!journeyContext) {
        throw new Error('departurePlaceIsHomeCustomLabel: Journey context not found');
    }
    const { person, journey } = journeyContext;
    const journeyDate = journey.startDate;
    if (_isBlank(journeyDate)) {
        throw new Error('departurePlaceIsHomeCustomLabel: Journey start date not found');
    }
    const assignedDay = moment(journeyDate);
    const dayBefore = moment(journeyDate).subtract(1, 'days');
    const homeAddress = odHelpers.getHomeAddressOneLine({ interview });
    const dayBeforeStr = dayBefore
        .toDate()
        .toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' });
    const assignedDayStr = assignedDay
        .toDate()
        .toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' });

    return t('tripsIntro:personDeparturePlaceIsHome', {
        context: odHelpers.getPersonGenderContext({ person }),
        nickname: odHelpers.getPersonIdentificationString({ person, t }),
        count: odHelpers.getCountOrSelfDeclared({ interview, person }),
        dayOne: dayBeforeStr,
        dayTwo: assignedDayStr,
        address: homeAddress
    });
};

// Custom because of the journey date and address placeholders
export const personReturnedHomeCustomLabel: I18nData = (t: TFunction, interview, path) => {
    const journeyContext = odHelpers.getJourneyContextFromPath({ interview, path });
    if (!journeyContext) {
        throw new Error('personReturnedHomeCustomLabel: Journey context not found');
    }
    const { person, journey } = journeyContext;
    const journeyDate = getFormattedTripDateFromJourney(journey);
    const homeAddress = odHelpers.getHomeAddressOneLine({ interview });

    return t('tripsIntro:personReturnedHome', {
        context: odHelpers.getPersonGenderContext({ person }),
        nickname: odHelpers.getPersonIdentificationString({ person, t }),
        count: odHelpers.getCountOrSelfDeclared({ interview, person }),
        journeyDate,
        address: homeAddress
    });
};

const accessModeCustomLabel =
    (labelKey: string): I18nData =>
        (t: TFunction, interview, path) => {
            const segmentContext = odHelpers.getSegmentContextFromPath({ interview, path });
            if (!segmentContext) {
                throw new Error(`${labelKey} label: Segment context not found`);
            }
            const { person, journey, trip, segment } = segmentContext;
            const visitedPlaces = odHelpers.getVisitedPlaces({ journey });
            const origin = odHelpers.getOrigin({ trip, visitedPlaces });
            const originDescription = origin ? odHelpers.getVisitedPlaceName({ t, visitedPlace: origin, interview }) : '';
            const mode = segment.mode;
            return t(labelKey, {
                context: odHelpers.getPersonGenderContext({ person }),
                nickname: odHelpers.getPersonIdentificationString({ person, t }),
                count: odHelpers.getCountOrSelfDeclared({ interview, person }),
                origin: originDescription,
                stopType: t('segments:toStopType', { context: mode })
            });
        };

// Custom labels that require origin and current mode of the trip
export const segmentTransitAccessModeCustomLabel: I18nData = accessModeCustomLabel('segments:segmentTransitAccessMode');
export const segmentIntercityAccessModeCustomLabel: I18nData = accessModeCustomLabel(
    'segments:segmentIntercityAccessMode'
);

const egressModeCustomLabel =
    (labelKey: string): I18nData =>
        (t: TFunction, interview, path) => {
            const segmentContext = odHelpers.getSegmentContextFromPath({ interview, path });
            if (!segmentContext) {
                throw new Error(`${labelKey} label: Segment context not found`);
            }
            const { person, journey, trip, segment } = segmentContext;
            const visitedPlaces = odHelpers.getVisitedPlaces({ journey });
            const destination = odHelpers.getDestination({ trip, visitedPlaces });
            const destinationDescription = destination
                ? odHelpers.getVisitedPlaceName({ t, visitedPlace: destination, interview })
                : '';
            const mode = segment.mode;
            return t(labelKey, {
                context: odHelpers.getPersonGenderContext({ person }),
                nickname: odHelpers.getPersonIdentificationString({ person, t }),
                count: odHelpers.getCountOrSelfDeclared({ interview, person }),
                destination: destinationDescription,
                stopType: t('segments:fromStopType', { context: mode })
            });
        };

// Custom labels that require destination and current mode of the trip
export const segmentTransitEgressModeCustomLabel: I18nData = egressModeCustomLabel('segments:segmentTransitEgressMode');
export const segmentIntercityEgressModeCustomLabel: I18nData = egressModeCustomLabel(
    'segments:segmentIntercityEgressMode'
);

// Custom label for the paid parking question, to add the stopType placeholder
export const tripJunctionPaidParkingCustomLabel: I18nData = (t: TFunction, interview, path) => {
    const segmentContext = odHelpers.getSegmentContextFromPath({ interview, path });
    if (!segmentContext) {
        throw new Error('tripJunctionPaidParkingCustomLabel label: Segment context not found');
    }
    const { segment } = segmentContext;
    return t('segments:tripJunctionPaidParking', {
        stopType: t('segments:toStopType', { context: segment.mode })
    });
};

export const personNoWorkTripIntroCustomLabel: I18nData = labelWithJourneyDate('travelBehavior:personNoWorkTripIntro');

export const personNoSchoolTripIntroCustomLabel: I18nData = labelWithJourneyDate(
    'travelBehavior:personNoSchoolTripIntro'
);

export const personHasSchoolPlaceCustomLabel: I18nData = (t: TFunction, interview, path) => {
    const person = odHelpers.getPerson({ interview, path });
    if (!person) {
        throw new Error('personHasSchoolPlaceCustomLabel label: Person context not found');
    }
    const labelKeys = ['travelBehavior:personHasSchoolPlace'];
    if (person.age === 5) {
        labelKeys.unshift('travelBehavior:personHasSchoolPlace_schoolchildcare');
    }
    return t(labelKeys, {
        nickname: odHelpers.getPersonIdentificationString({ person, t }),
        context: odHelpers.getPersonGenderContext({ person }),
        count: odHelpers.getCountOrSelfDeclared({ interview, person })
    });
};

export const personUsualWorkPlaceCommutingCustomLabel: I18nData = (t: TFunction, interview, path) => {
    const person = odHelpers.getPerson({ interview, path });
    if (!person) {
        throw new Error('personUsualWorkPlaceCommutingCustomLabel: Person context not found');
    }
    const countPersons = odHelpers.countPersons({ interview });
    const workPlaceType = person.workPlaceType;
    return t(
        [
            `travelBehavior:personUsualWorkPlaceCommuting_${workPlaceType}`,
            'travelBehavior:personUsualWorkPlaceCommuting'
        ],
        {
            nickname: odHelpers.getPersonIdentificationString({ person, t }),
            count: countPersons,
            context: odHelpers.getPersonGenderContext({ person })
        }
    );
};

export const personNoSchoolTripReasonCustomLabel: I18nData = labelWithJourneyDate(
    'travelBehavior:personNoSchoolTripReason'
);

export const homeParkingAvailableCustomLabel: I18nData = (t: TFunction, interview) => {
    const vehicleCount = getResponse(interview, 'household.carNumber', 0) as number | null;
    return t('home:homeCarParkingsAvailableVehicleHousehold', { count: vehicleCount });
};

export const householdSizeCustomLabel: I18nData = (t: TFunction, interview) => {
    const assignedDay = getResponse(interview, '_assignedDay') as string;
    const assignedDate = getFormattedDate(assignedDay, { withDayOfWeek: true, withRelative: true });

    return t('home:householdSize', {
        assignedDate
    });
};

// Interpolate the address in the label
export const homeIsMainCustomLabel: I18nData = (t: TFunction, interview) => {
    const homeAddress = odHelpers.getHomeAddressOneLine({ interview }); // Just to check if home address is available, as it's required for the label. It will throw an error if not available.
    return t('home:homeIsMain', { address: homeAddress });
};

// Interpolate transit fare name and price in the label
const transitFarePrices = {
    A: { regular: 110, reduced: 66 },
    AB: { regular: 170, reduced: 102 },
    ABC: { regular: 206, reduced: 123.5 },
    ABCD: { regular: 281, reduced: 168.5 },
    bus: { regular: 119, reduced: 71.5 },
    busCD: { regular: 119, reduced: 71.5 }
};
export const personTransitFareWarningCustomLabel: I18nData = (t: TFunction, interview, path) => {
    const transitFare = getResponse(interview, path, null, '../transitFare');
    if (typeof transitFare !== 'string' || transitFarePrices[transitFare] === undefined) {
        throw new Error(
            `personTransitFareWarningCustomLabel: Transit fare ${transitFare} not found in transitFarePrices`
        );
    }
    const selectedTransitFare = transitFareType.find((fare) => fare.value === transitFare);
    const selectedTransitFareName = selectedTransitFare
        ? translateString(selectedTransitFare.label, i18n, interview, path)
        : '';
    const selectedTransitFarePrice = transitFarePrices[transitFare].regular;
    const selectedTransitFarePriceReduced = transitFarePrices[transitFare].reduced;
    return t('household:personTransitFareWarning', {
        transitFare: selectedTransitFareName,
        transitFarePrice: selectedTransitFarePrice,
        transitFarePriceReduced: selectedTransitFarePriceReduced
    });
};

// Get a label with the assigned date, outside of the journey context
export const labelWithAssignedDate =
    (
        translationKey: string,
        additionalContextFct?: (t: TFunction, interview: UserInterviewAttributes) => Record<string, unknown>
    ): I18nData =>
        (t: TFunction, interview, path) => {
            const assignedDay = getResponse(interview, '_assignedDay') as string;
            if (_isBlank(assignedDay)) {
                throw new Error('labelWithAssignedDate: Assigned day not found');
            }
            const assignedDate = getFormattedDate(assignedDay, { withRelative: true, locale: i18n.language });
            const additionalContext = additionalContextFct?.(t, interview) ?? {};
            return t(translationKey, {
                assignedDate,
                ...additionalContext
            });
        };

const getChildContext = (t: TFunction, interview: InterviewAttributes) => {
    const children = getChildrenAged1To4(interview);
    if (children.length !== 1) {
        return {
            count: children.length
        };
    }
    return {
        count: 1,
        childname: odHelpers.getPersonIdentificationString({ person: children[0], t }),
        age: children[0].age
    };
};

const labelWithChildName =
    (translationKey: string): I18nData =>
        (t: TFunction, interview, path) =>
            t(translationKey, { ...getChildContext(t, interview) });

// Custom because of the presence of the journey date and child information in the label
export const toddlerDaycareCustomLabel: I18nData = labelWithAssignedDate('omissions:toddlerDaycare', getChildContext);

// Custom because of the presence of the child information in the label
export const toddlerDaycarePickupCustomLabel: I18nData = labelWithChildName('omissions:toddlerDaycarePickup');

// Custom because of the presence of the child information in the label
export const toddlerDaycareDropoffCustomLabel: I18nData = labelWithChildName('omissions:toddlerDaycareDropoff');

// Custom because of the presence of the journey date in the label
export const hasOmittedTripsCustomLabel: I18nData = labelWithAssignedDate('omissions:hasOmittedTrips');

export const didRespondForCorrectDateCustomLabel: I18nData = labelWithAssignedDate(
    'end:didRespondForCorrectAssignedDate'
);

export const didNotRespondForCorrectDateReasonCustomLabel: I18nData = labelWithAssignedDate(
    'end:didNotRespondForCorrectAssignedDateReasons'
);

// Get a label with the details of a trip, from a trip's path available in some field
const placeDescriptionOption = {
    withTimes: false,
    withActivity: false,
    withPersonIdentification: false,
    allowHtml: false
};
export const labelWithTripData =
    (translationKey: string, tripPathKey: string): I18nData =>
        (t: TFunction, interview, path) => {
            const tripPath = getResponse(interview, tripPathKey) as string;
            if (_isBlank(tripPath)) {
                throw new Error('labelWithTripData: The requested trip path does not exist');
            }
            const tripContext = odHelpers.getTripContextFromPath({ interview, path: tripPath });
            if (tripContext === null) {
                throw new Error('labelWithTripData: There is no trip for path ' + tripPath);
            }
            const { person, journey, trip } = tripContext;
            const visitedPlaces = odHelpers.getVisitedPlaces({ journey });
            const origin = odHelpers.getOrigin({ trip, visitedPlaces });
            const destination = odHelpers.getDestination({ trip, visitedPlaces });

            return t(translationKey, {
                activity: t(`visitedPlaces:activities.${destination.activity}`),
                origin: odHelpers.getVisitedPlaceDescription({
                    visitedPlace: origin,
                    interview,
                    person,
                    t,
                    options: placeDescriptionOption
                }),
                destination: odHelpers.getVisitedPlaceDescription({
                    visitedPlace: destination,
                    interview,
                    person,
                    t,
                    options: placeDescriptionOption
                }),
                originDepartureTime: secondsSinceMidnightToTimeStrWithSuffix(origin.departureTime)
            });
        };

export const barriersTripCustomLabel: I18nData = labelWithTripData('barriers:barriersTrip', '_barriersTripPath');

export const barriersDisabilityTripCustomLabel: I18nData = labelWithTripData(
    'barriersDisability:barriersDisabilityTrip',
    '_barriersDisabilityTripPath'
);

export const commonTripCustomLabel: I18nData = (t, interview, path) => {
    const tripContext = odHelpers.getTripContextFromPath({ interview, path });
    if (tripContext === null) {
        throw new Error('commonTripCustomLabel: trip context not found for path ' + path);
    }
    const { person, journey, trip } = tripContext;
    const visitedPlaces = odHelpers.getVisitedPlaces({ journey });
    const origin = odHelpers.getOrigin({ trip, visitedPlaces });
    const destination = odHelpers.getDestination({ trip, visitedPlaces });
    return t('segments:personTripsCommonTripWith', {
        origin: odHelpers.getVisitedPlaceDescription({
            visitedPlace: origin,
            person,
            interview,
            t,
            options: { withTimes: false, withActivity: false, withPersonIdentification: false, allowHtml: false }
        }),
        destination: odHelpers.getVisitedPlaceDescription({
            visitedPlace: destination,
            person,
            interview,
            t,
            options: { withTimes: false, withActivity: false, withPersonIdentification: false, allowHtml: false }
        })
    });
};

export const barrierDisabilitySelectPersonCustomLabel: I18nData = (t, interview, path) => {
    const barrierDisabilityPersonId = getResponse(interview, '_barriersDisabilityPersonId', null);
    if (typeof barrierDisabilityPersonId !== 'string') {
        throw new Error('barrierDisabilitySelectPersonCustomLabel: no person ID found');
    }
    const person = odHelpers.getPerson({ interview, personId: barrierDisabilityPersonId });
    if (person === null) {
        throw new Error('barrierDisabilitySelectPersonCustomLabel: no person found');
    }
    return t('barriersDisability:barriersDisabilityIsPersonAvailable', {
        personWithDisabilityNickname: odHelpers.getPersonIdentificationString({ person, t })
    });
};
