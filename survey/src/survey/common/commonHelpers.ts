// Ce fichier contient des fonctions qui ne dépendent pas d'evolution-frontend
// ou backend, donc peut être importer autant dans le frontend que dans le
// backend

import * as odSurveyHelpers from 'evolution-common/lib/services/odSurvey/helpers';
import type { InterviewAttributes, Journey, Person, Trip } from 'evolution-common/lib/services/questionnaire/types';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import config from 'evolution-common/lib/config/project.config';

/**
 * Validate if the interview is the commonTrip partial sample AND if the
 * household matches some criteria
 * @param interview
 * @returns
 */
export const isCommonTripSampleMatch = (interview: InterviewAttributes) => {
    const isCommonTripSample = getResponse(interview, 'ep.commonTrip', false) as boolean;
    if (!isCommonTripSample) {
        return false;
    }
    // The household should have more than one person and have interviewable persons that are not adults or aged 65+
    const persons = odSurveyHelpers.getPersonsArray({ interview });
    if (persons.length === 1) {
        return false;
    }
    const eligiblePerson = persons.filter(
        (person) =>
            (person.age >= config.ages.interviewableAge && person.age < config.ages.adultAge) || person.age >= 65
    );
    return eligiblePerson.length > 0;
};

/**
 * Determine if an interview is part of a given partial sample
 * @param interview The interview
 * @param partialSample The partial sample.s to confirm if this interview is
 * part of
 * @returns `true` if the interview is one of the requested partial sample
 */
export const isPartialSample = (interview: InterviewAttributes, partialSample: string | string[]) => {
    const partialSamples = typeof partialSample === 'string' ? [partialSample] : partialSample;
    const epExclusive = getResponse(interview, 'ep.exclusive', null);
    return typeof epExclusive === 'string' ? partialSamples.includes(epExclusive) : false;
};

/**
 * Return if the home is in the artm territory
 * @param interview The interview
 * @returns boolean `true` if the home geography is in the artm territory
 */
export const isHomeInArtmTerritory = (interview: InterviewAttributes) =>
    getResponse(interview, 'home.geography.properties.isArtmZone', false) === true;

export const getCommonTripReferencePerson = (interview: InterviewAttributes) => {
    // Get the common trip reference person id
    const commonTripReferencePersonId = getResponse(interview, '_commonTripRefPersonId', null) as string | null;
    if (commonTripReferencePersonId === null) {
        return null;
    }

    // Get the reference person
    const commonTripReferencePerson = odSurveyHelpers.getPersons({ interview })[commonTripReferencePersonId];
    return commonTripReferencePerson ?? null;
};

/**
 * Get the common trip from the reference person that are in common with the
 * currentPerson. If the current person is the reference person, no trips are
 * returned.
 * @param interview The interview
 * @param currentPerson The person who may have done trips in common with the
 * reference person.
 * @returns Returns a value only if there are common trips between the reference
 * person and the current person. Otherwise, returns null.
 */
export const getCommonTripFromReferencePerson = (
    interview: InterviewAttributes,
    currentPerson: Person
): {
    person: Person;
    journey: Journey;
    trips: Trip[];
} | null => {
    // See if this person may have had a common trip with someone (only if it is not the reference one)
    const commonTripReferencePerson = getCommonTripReferencePerson(interview);
    if (commonTripReferencePerson === null || commonTripReferencePerson._uuid === currentPerson._uuid) {
        return null;
    }

    // Get the reference person journey
    const commonTripReferenceJourney = odSurveyHelpers.getJourneysArray({ person: commonTripReferencePerson })[0];
    if (commonTripReferenceJourney === undefined) {
        return null;
    }

    // Does the reference person have trips made in common with the current person?
    const referenceTrips = odSurveyHelpers.getTripsArray({ journey: commonTripReferenceJourney });
    const commonTrips = referenceTrips.filter(
        (trip) =>
            Array.isArray((trip as any).commonTripWith) && (trip as any).commonTripWith.includes(currentPerson._uuid)
    );
    return commonTrips.length === 0
        ? null
        : {
            person: commonTripReferencePerson,
            journey: commonTripReferenceJourney,
            trips: commonTrips
        };
};
