import { TFunction } from 'i18next';
import moment from 'moment';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { I18nData } from 'evolution-common/lib/services/questionnaire/types';
import * as odHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import { getFormattedTripDateFromJourney } from './customHelpers';
import i18n from 'evolution-frontend/lib/config/i18n.config';

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
export const personOutOfTerritoryCustomLabel: I18nData = (t: TFunction, interview, path) => {
    const journeyContext = odHelpers.getJourneyContextFromPath({ interview, path });
    if (!journeyContext) {
        throw new Error('personOutOfTerritoryCustomLabel: Journey context not found');
    }
    const { person, journey } = journeyContext;
    const journeyDate = getFormattedTripDateFromJourney(journey);
    const homeAddress = odHelpers.getHomeAddressOneLine({ interview });

    return t('tripsIntro:personOutOfTerritory', {
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
