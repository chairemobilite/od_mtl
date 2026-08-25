const moment = require('moment');

const holidays = ['2026-09-07', '2026-10-12', '2026-12-25', '2027-01-01'];

moment.updateLocale('fr', {
    holidays,
    holidayFormat: 'YYYY-MM-DD',
    longDateFormat: {
        LL: 'dddd Do MMMM YYYY',
    }
});

moment.updateLocale('en', {
    holidays,
    holidayFormat: 'YYYY-MM-DD',
    longDateFormat: {
        LL: 'dddd, MMMM Do YYYY',
    }
});

module.exports = {
    projectShortname: `od_mtl_2026`,
    projectDirectory: `${__dirname}/runtime`,
    logoPaths: {
        fr: `/dist/images/logo_od_mtl_2026.svg`,
        en: `/dist/images/logo_od_mtl_2026.svg`
    },
    countryCode: 'CA',
    // FIXME See if those dates are still useful or if startDateTimeWithTimezoneOffset supercedes them
    startDate: '2026-09-01',
    endDate: '2026-12-19',
    hasAccessCode: true,
    startDateTimeWithTimezoneOffset: '2026-09-01T00:00:00-04:00', // tuesday before labor day
    endDateTimeWithTimezoneOffset: '2026-12-19T23:59:59-05:00', // answers will be accepted until this date, even if front page says otherwise
    forceRecalculateTransitTrips: false,
    updateTransitRoutingIfCalculatedBefore: moment('2024-03-07').unix(), // timestamp, will recalculate transit trips if calculated before this date
    startButtonColor: 'turquoise', // styles for turquoise buttons are in the project's styles.scss file
    ages: {
        interviewableAge: 5,
        selfResponseMinimumAge: 14,
        adultAge: 18,
        drivingLicenseAge: 16,
        workingAge: 15,
        schoolMandatoryAge: 15,
        maxPersonAge: 125,
        // Add warnings when household have members aged 100 or more
        addAuditWarningVeryOldAge: 100
    },
    accessCodeFormat: '000-000-000',
    singlePersonInterview: false,
    allowChangeSectionWithoutValidation: true,
    introductionTwoParagraph: true,
    includePartTimeStudentOccupation: true,
    includeWorkerAndStudentOccupation: true,
    acceptUnknownDidTrips: false,
    logDatabaseUpdates: true,
    allowRegistration: true,
    registerWithPassword: true,
    registerWithEmailOnly: true,
    askForAccessCode: true,
    isPartTwo: false,
    forgotPasswordPage: true,
    primaryAuthMethod: 'byField',
    adminAuth: {
        localLogin: {
            allowRegistration: true,
            registerWithEmailOnly: true,
            confirmEmail: true,
            confirmEmailStrategy: 'confirmByAdmin',
            forgotPasswordPage: true
        }
    },
    auth: {
        passwordless: true,
        anonymous: true,
        google: false,
        facebook: false,
        byField: false
    },
    trRoutingScenarios: {
        DI: 'ad438798-e0b2-4e08-a3bd-b944fee418e1',
        SA: '80da3027-8ad6-4f80-89d6-23d0ae3dec1c',
        SE: '23f9c86f-e161-4af3-9102-ecf81bedc473'
    },
    postalCodeRegion: 'quebec',
    separateAdminLoginPage: true,
    surveySupportForm: false,
    captchaComponentType: 'capjs',
    mapDefaultZoom: 10,
    mapDefaultCenter: {
        lat: 45.503205,
        lon: -73.569417
    },
    mapMaxGeocodingResultsBounds: [
        {
            lat: 45.2229,
            lng: -74.3230
        },
        {
            lat: 46.1181,
            lng: -72.9215
        }],
    mapAerialTilesUrl: undefined, // aerial imagery usually requires permission to use. Feel free to add your own url to this file in your local environment.
    detectLanguage: false,
    detectLanguageFromUrl: true,
    languages: ['fr', 'en'],
    locales: {
        fr: 'fr-CA',
        en: 'en-CA'
    },
    languageNames: {
        fr: 'Français',
        en: 'English'
    },
    title: {
        fr: 'Perspectives mobilité 2026',
        en: '2026 Perspectives mobilité'
    },
    defaultLocale: 'fr',
    timezone: 'America/Montreal',
    requiredFieldsBySurveyObject: {
        interview: [],
        household: [],
        home: [],
        organization: [],
        vehicle: [],
        person: [],
        journey: [],
        tripChain: [],
        visitedPlace: [],
        trip: [],
        segment: [],
        junction: [],
        workPlace: [],
        schoolPlace: []
    },
    auditChecksGroup: 'travelSurvey', // custom by default so older surveys work.
    surveyBase: 'householdBased',
    surveyAreaGeojsonPath: '../src/survey/geojson/surveyArea.geojson'
};
