import { ChoiceType, ParsingFunction } from 'evolution-common/lib/services/questionnaire/types';
import { no } from '../../common/choices';
import { TFunction } from 'i18next';
import { getPerson, countPersons } from 'evolution-common/lib/services/odSurvey/helpers';
import * as odSurveyHelper from 'evolution-common/lib/services/odSurvey/helpers';

// FIXME This is copied from the `onDemandChoices` type in choices.tsx. It was
// copied from there because a choice required the nickname
export const onDemandCustomChoices: ChoiceType[] = [
    {
        value: 'pickupAtOrigin',
        label: (t: TFunction, interview, path) => {
            const activePerson = getPerson({ interview, path });
            const nickname = activePerson?.nickname || t('survey:noNickname');
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
            const nickname = activePerson?.nickname || t('survey:noNickname');
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

// List of the subway stations, sorted by proximity to segment origin
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/21
export const subwayStationStartCustomChoices: ParsingFunction<ChoiceType[]> = (interview, path) => {
    return subwayStationsCustomChoices;
};

// List of the subway stations, sorted by proximity to segment destination
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/21
export const subwayStationEndCustomChoices: ParsingFunction<ChoiceType[]> = (interview) => {
    return subwayStationsCustomChoices;
};

// List the filtered subway transfer stations
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/18
export const subwayStationsTransferCustomChoices: ParsingFunction<ChoiceType[]> = (interview) => {
    return subwayStationsCustomChoices;
};

// List the train stations, sorted by proximity to segment origin
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/22
export const trainStationStartCustomChoices: ParsingFunction<ChoiceType[]> = (interview, path) => {
    return subwayStationsCustomChoices;
};

// List the train stations, sorted by proximity to segment destination
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/22
export const trainStationEndCustomChoices: ParsingFunction<ChoiceType[]> = (interview) => {
    return subwayStationsCustomChoices;
};

// List the REM stations, sorted by proximity to segment origin
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/23
export const remStationStartCustomChoices: ParsingFunction<ChoiceType[]> = (interview, path) => {
    return subwayStationsCustomChoices;
};

// List the REM stations, sorted by proximity to segment destination
// FIXME Implement see https://github.com/chairemobilite/od_mtl/issues/23
export const remStationEndCustomChoices: ParsingFunction<ChoiceType[]> = (interview) => {
    return subwayStationsCustomChoices;
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
