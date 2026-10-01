/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import _cloneDeep from 'lodash/cloneDeep';
import { validate as uuidValidate } from 'uuid';

import { ExtendedSegmentAttributes } from 'evolution-common/lib/services/baseObjects/Segment';
import { AnswerStatus } from 'evolution-common/lib/services/baseObjects/attributeTypes/AnswerStatus';
import { driverValues, type Driver } from 'evolution-common/lib/services/baseObjects/attributeTypes/SegmentAttributes';
import { CorrectedResponse } from 'evolution-common/lib/services/questionnaire/types';
import { SurveyObjectParser } from 'evolution-backend/lib/services/audits/types';

const isDriverType = (value: string): value is Driver => (driverValues as readonly string[]).includes(value);

type StationFieldNames = {
    start: string;
    end: string;
    transfer?: string;
};

/** Widget fields that hold this survey's stations, by the mode that shows them. */
const stationFieldsByMode: { [mode: string]: StationFieldNames } = {
    transitRRT: {
        start: 'subwayStationStart',
        end: 'subwayStationEnd',
        transfer: 'subwayStationsTransfer'
    },
    transitLRRT: { start: 'remStationStart', end: 'remStationEnd' },
    transitRegionalRail: { start: 'trainStationStart', end: 'trainStationEnd' }
};

const asStationId = (value: unknown): string | undefined =>
    typeof value === 'string' && value !== '' ? value : undefined;

/**
 * Intermediate subway transfers are stored as one choice: `none`, a station id,
 * or several ids joined by `&`.
 */
const transferStations = (value: unknown): string[] => {
    if (typeof value !== 'string' || value === '' || value === 'none') {
        return [];
    }
    return value.split('&').filter((station) => station !== '');
};

const stationsFromSurveyFields = (
    attributes: ExtendedSegmentAttributes,
    fields: StationFieldNames
): string[] | undefined => {
    const start = asStationId(attributes[fields.start]);
    const end = asStationId(attributes[fields.end]);
    const transfers = fields.transfer === undefined ? [] : transferStations(attributes[fields.transfer]);
    if (start === undefined && end === undefined && transfers.length === 0) {
        return undefined;
    }
    return [...(start === undefined ? [] : [start]), ...transfers, ...(end === undefined ? [] : [end])];
};

/**
 * The answer each choice of the parking question stands for. This survey asks
 * about the kind of parking rather than only whether it was paid, so the
 * choices carry both the answer to "was it paid" and the reason there is none:
 * a vehicle that was never parked has no parking to pay for.
 */
const paidForParkingByChoice: { [choice: string]: AnswerStatus<boolean> } = {
    noWorker: { status: 'answered', value: false }, // free or paid by the employer
    no: { status: 'answered', value: false }, // free
    yes: { status: 'answered', value: true }, // meter, sticker, pass or permit
    noPark: { status: 'not_applicable' }, // the vehicle was not parked
    dontKnow: { status: 'dont_know' }
};

/**
 * Convert the answers this survey stores as choice strings into the attributes
 * the segment object expects.
 *
 * The parking choice is kept under `parkingType`, which the object holds as a
 * custom attribute, as it says more than the boolean it maps to. The driver
 * question holds either the uuid of a household member or the kind of driver,
 * which the segment keeps in two attributes, so the answer is read into the
 * one it belongs to. Metro, REM and train stations are collected into the
 * single `stations` array Evolution expects, from entry through transfers to
 * exit.
 *
 * @param originalCorrectedSegmentAttributes - The segment attributes to parse
 * @param _correctedResponse - The corrected response
 */
export const parseSegmentAttributes: SurveyObjectParser<ExtendedSegmentAttributes, CorrectedResponse> = (
    originalCorrectedSegmentAttributes: Readonly<ExtendedSegmentAttributes>,
    _correctedResponse: Readonly<CorrectedResponse>
): ExtendedSegmentAttributes => {
    const segmentAttributes = _cloneDeep(originalCorrectedSegmentAttributes) as ExtendedSegmentAttributes;

    if (!segmentAttributes || typeof segmentAttributes !== 'object') {
        return segmentAttributes;
    }

    // Read as unknown, as the response holds these answers as the choice
    // strings of the widgets, which the attribute types do not describe
    const parkingChoice: unknown = segmentAttributes.paidForParking;
    if (typeof parkingChoice === 'string') {
        segmentAttributes.parkingType = parkingChoice;
        const paidForParking = paidForParkingByChoice[parkingChoice];
        if (paidForParking !== undefined) {
            segmentAttributes.paidForParking = paidForParking;
        }
    }

    // The choices that are not a uuid are named after the driver type they
    // stand for
    const driverChoice: unknown = segmentAttributes.driver;
    if (typeof driverChoice === 'string') {
        if (uuidValidate(driverChoice)) {
            segmentAttributes.driverType = 'householdMember';
            segmentAttributes.driverUuid = driverChoice;
        } else if (isDriverType(driverChoice)) {
            segmentAttributes.driverType = driverChoice;
        }
    }

    if (!Array.isArray(segmentAttributes.stations) && typeof segmentAttributes.mode === 'string') {
        const stationFields = stationFieldsByMode[segmentAttributes.mode];
        if (stationFields !== undefined) {
            const stations = stationsFromSurveyFields(segmentAttributes, stationFields);
            if (stations !== undefined) {
                segmentAttributes.stations = stations;
            }
        }
    }

    return segmentAttributes;
};
