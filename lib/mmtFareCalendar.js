// Goibibo and MakeMyTrip share one fare-calendar backend: same query, device-id headers and response shape.
const http = require("./http");
const routes = require("./routes");
const { requireEnv, unexpectedResponse } = require("./platform");

const DEVICE_ID_HEADERS = ["device-id", "deviceid", "mcid", "tid", "usr-mcid", "vid", "visitor-id"];

const searchFareCalendar = async ({ platform, config, deviceIdEnv, route, headers = {} }) => {
    const deviceId = requireEnv(deviceIdEnv);
    const anchorDate = routes.getEarliestDepartureDate().replace(/-/g, "");
    const query = new URLSearchParams({
        ...config.query,
        it: `${route.origin}-${route.destination}-${anchorDate}`,
    });
    const response = await http.request({
        method: "GET",
        url: `${config.url}?${query}`,
        headers: {
            ...config.headers,
            ...headers,
            ...Object.fromEntries(DEVICE_ID_HEADERS.map(header => [header, deviceId])),
        },
    });

    if (!response?.fares) {
        throw unexpectedResponse(platform, route, response, `${platform} fare calendar returned no fares`);
    }
    return response;
};

module.exports = {
    searchFareCalendar,
};
