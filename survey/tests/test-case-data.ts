import * as commonUITestsHelpers from './common-UI-tests-helpers';

export const femaleHybridWorker: commonUITestsHelpers.HouseholdMember = {
    personIndex: 0,
    nickname: 'Martha',
    age: 30,
    gender: 'female',
    genderCustom: null,
    drivingLicenseOwnership: 'yes',
    carSharingMember: 'yes',
    usedTransitInLast30Days: 'no',
    transitPass: null,
    transitFare: null,
    transitFareWarning: null,
    hasDisability: 'no',
    disabilities: null,
    disabilitiesSpecify: null,
    mobilityAssistiveDevices: null,
    mobilityAssistiveDevicesSpecify: null,
    mostUsedMobilityAssistiveDevice: null,
    useParatransit: null,
    useParatransitFrequency: null,
    useParatransitTransitFrequency: null,
    workerType: 'fullTime',
    studentType: 'no',
    job: 'professionnelle de recherche',
    jobType: 'administration',
    workPlaceType: 'hybrid',
    workDays: '4',
    travelToWorkDays: '3',
    educationalAttainment: 'postSecondaryBelowBachelorEducation',
    occupation: null, // Question won't show.
    // FIXME For now the question is always shown, until https://github.com/chairemobilite/evolution/issues/1608 is resolved, or we actually have the `home.RA` field set
    bikesharingUsage: 'no'
};

/**
 * Définition de lieux visités, partant d'un domicile au centre-ville:
 *
 * - Une chaine simple: domicile <-> marché jean-talon
 * - 2e chaine simple: domicile <-> université
 * - chaîne complexe: domicile -> place des festivals -> timeout market -> domicile
 */
export const downtownSimpleChainsPlusComplexChain: commonUITestsHelpers.VisitedPlace[] = [
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'shopping',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: 'Marché Jean-Talon',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: 7 * 3600, // 7:00 AM
        arrivalTime: 7 * 3600 + 40 * 60, // 7:40 AM
        nextPlaceCategory: 'wentBackHome',
        departureTime: 8 * 3600 + 30 * 60 // 8:30
    },
    {
        activityCategory: 'home',
        activity: null, // Question won't show.
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: null, // Question won't show.
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 9 * 3600, // 9:00 AM
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 11 * 3600 + 30 * 60 // 11:30
    },
    {
        activityCategory: 'work',
        activity: 'workUsual',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: 'Polytechnique Montréal',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 12 * 3600 + 30 * 60,
        nextPlaceCategory: 'wentBackHome',
        departureTime: 16 * 3600
    },
    {
        activityCategory: 'home',
        activity: null, // Question won't show.
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: null, // Question won't show.
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 17 * 3600 + 15 * 60,
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 18 * 3600 + 50 * 60
    },
    {
        activityCategory: 'leisure',
        activity: 'leisureArtsMusicCulture',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: false,
        shortcut: null, // Question won't show.
        name: 'Place des festivals',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 19 * 3600,
        nextPlaceCategory: 'visitedAnotherPlace',
        departureTime: 21 * 3600
    },
    {
        activityCategory: 'shoppingServiceRestaurant',
        activity: 'restaurant',
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: false,
        shortcut: null, // Question won't show.
        name: 'Timeout market',
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 21 * 3600 + 30 * 60,
        nextPlaceCategory: 'wentBackHome',
        departureTime: 25 * 3600
    },
    {
        activityCategory: 'home',
        activity: null, // Question won't show.
        onTheRoadPreviousPlaceActivity: null, // Question won't show.
        onTheRoadNextPlaceCategory: null, // Question won't show.
        previousWorkPlaceName: null, // Question won't show.
        alreadyVisitedBySelfOrAnotherHouseholdMember: null, // Question won't show.
        shortcut: null, // Question won't show.
        name: null, // Question won't show.
        _previousPreviousDepartureTime: null, // Question won't show.
        _previousArrivalTime: null, // Question won't show.
        _previousDepartureTime: null, // Question won't show.
        arrivalTime: 26 * 3600,
        nextPlaceCategory: 'stayedThereUntilTheNextDay',
        departureTime: null // Question won't show
    }
];
