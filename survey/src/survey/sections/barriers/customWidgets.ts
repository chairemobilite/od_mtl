import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { InfoMapWidgetConfig } from 'evolution-common/lib/services/questionnaire/types';
import { getResponse } from 'evolution-common/lib/utils/helpers';
import config from 'evolution-common/lib/config/project.config';
import { getGeojsonForSingleTrip } from '../../common/customHelpers';
import * as conditionals from '../../common/conditionals';

export const barriersTripMap: InfoMapWidgetConfig = {
    type: 'infoMap',
    defaultCenter: config.mapDefaultCenter,
    title: () => null,
    linestringColor: '#0000ff',
    conditional: conditionals.hasBarrierTripConditional,
    geojsons: (interview, _path) => {
        const tripPath = getResponse(interview, '_barriersTripPath') as string;
        if (_isBlank(tripPath)) {
            throw new Error('barriersTripMap: The requested trip path does not exist');
        }
        return getGeojsonForSingleTrip(interview, tripPath);
    }
};
