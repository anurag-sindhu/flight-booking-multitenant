const rootConfig = require("../config.json");

// A route can be limited with `platforms` (allow-list) or `excludePlatforms` (deny-list).
const getRoutes = platform => {
    return rootConfig.routes.filter(route => {
        if (Array.isArray(route.excludePlatforms) && route.excludePlatforms.includes(platform)) {
            return false;
        }
        if (Array.isArray(route.platforms) && !route.platforms.includes(platform)) {
            return false;
        }
        return true;
    });
};

const getDepartureDates = () => rootConfig.departureDates;

// Calendar APIs are anchored on the earliest tracked date; a past or hardcoded anchor gets rejected.
const getEarliestDepartureDate = () => [...getDepartureDates()].sort()[0];

const toRouteKey = route => `${route.origin}-${route.destination}`;

const formatRouteLabel = route => `${route.origin}→${route.destination}`;

module.exports = {
    getRoutes,
    getDepartureDates,
    getEarliestDepartureDate,
    toRouteKey,
    formatRouteLabel,
};
