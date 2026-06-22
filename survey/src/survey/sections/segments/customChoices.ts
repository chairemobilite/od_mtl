import _escape from 'lodash/escape';
import { ChoiceType, ParsingFunction } from 'evolution-common/lib/services/questionnaire/types';
import { no } from '../../common/choices';
import { TFunction } from 'i18next';
import { getPerson, countPersons } from 'evolution-common/lib/services/odSurvey/helpers';
import * as odSurveyHelper from 'evolution-common/lib/services/odSurvey/helpers';
import metroTransfers from '../../config/metroTransfers.json';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { getResponse } from 'evolution-common/lib/utils/helpers';

// FIXME This is copied from the `onDemandChoices` type in choices.tsx. It was
// copied from there because a choice required the nickname
export const onDemandCustomChoices: ChoiceType[] = [
    {
        value: 'pickupAtOrigin',
        label: (t: TFunction, interview, path) => {
            const activePerson = getPerson({ interview, path });
            const nickname = _escape(activePerson?.nickname || t('survey:noNickname'));
            return t('segments:onDemandChoicesPickupAtOrigin', {
                nickname,
                count: countPersons({ interview })
            });
        }
    },
    {
        value: 'joinedStop',
        label: (t: TFunction, interview, path) => {
            const activePerson = getPerson({ interview, path });
            const nickname = _escape(activePerson?.nickname || t('survey:noNickname'));
            return t('segments:onDemandChoicesJoinedStop', {
                nickname,
                count: countPersons({ interview })
            });
        }
    },
    ...no
];

// List the possible choices for the trip junction question, with a list of stationnements incitatifs
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/36
export const tripJunctionCustomChoices: ChoiceType[] = [
    {
        value: 'placeholder1',
        label: 'placeholder1'
    },
    {
        value: 'placeholder2',
        label: 'placeholder2'
    }
];

// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/21
export const subwayStationsCustomChoices: ChoiceType[] = [
    {
        value: 'placeholder1',
        label: 'placeholder1'
    },
    {
        value: 'placeholder2',
        label: 'placeholder2'
    }
];

// List the filtered subway transfer stations
export const subwayStationsTransferCustomChoices: ParsingFunction<ChoiceType[]> = (interview, path) => {
    const subwayStationStart = getResponse(interview, path, null, '../subwayStationStart');
    const subwayStationEnd = getResponse(interview, path, null, '../subwayStationEnd');
    if (_isBlank(subwayStationStart) || _isBlank(subwayStationEnd)) {
        throw new Error(
            'subwayStationsTransferCustomChoices: subway stations are empty, we should not display choices'
        );
    }
    const metroTransferData = metroTransfers[subwayStationStart as string]?.[subwayStationEnd as string];
    const choices = metroTransferData.choices;
    if (choices === undefined) {
        throw new Error(
            'subwayStationsTransferCustomChoices: no available choices for stations ' +
                subwayStationStart +
                ' and ' +
                subwayStationEnd
        );
    }

    return choices.map((choice) => ({
        value: choice.value,
        label:
            typeof choice.label === 'string'
                ? choice.label
                : (t: TFunction) => t(`segments:metroTransferStation.${choice.value}`)
    }));
};

// List the other household members
export const tripCommunCustomChoices: ParsingFunction<ChoiceType[]> = (interview, path) => {
    const journeyContext = odSurveyHelper.getJourneyContextFromPath({ interview, path });
    if (!journeyContext) {
        throw new Error('tripCommunCustomChoices: Journey context not found for path ' + path);
    }
    const { person } = journeyContext;
    const persons = odSurveyHelper.getPersonsArray({ interview });
    return persons
        .filter((p) => p._uuid !== person._uuid)
        .map((p) => ({
            value: p._uuid,
            label: (t: TFunction) => odSurveyHelper.getPersonIdentificationString({ person: p, t })
        }));
};
