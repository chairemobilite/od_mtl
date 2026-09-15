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
import { CorrectedResponse } from 'evolution-common/lib/services/questionnaire/types';
import { SurveyObjectParser } from 'evolution-backend/lib/services/audits/types';

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
 * one it belongs to.
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
        segmentAttributes.paidForParking = paidForParkingByChoice[parkingChoice];
    }

    // The choices that are not a uuid are named after the driver type they
    // stand for
    const driverChoice: unknown = segmentAttributes.driver;
    if (typeof driverChoice === 'string') {
        if (uuidValidate(driverChoice)) {
            segmentAttributes.driverType = 'householdMember';
            segmentAttributes.driverUuid = driverChoice;
        } else {
            segmentAttributes.driverType = driverChoice;
        }
    }

    return segmentAttributes;
};
