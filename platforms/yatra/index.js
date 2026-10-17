const http = require("../../lib/http");
const routes = require("../../lib/routes");
const { requireEnv, formatPrice, toNumber, unexpectedResponse } = require("../../lib/platform");
const config = require("./config.json");

const YATRA_BASE_URL = "https://www.yatra.com";

const toSearchUrl = (day, route) => {
    const departDate = day.split("-").reverse().join("/");
    return (
        `${YATRA_BASE_URL}/booking/flight/search?origin=${route.origin}&destination=${route.destination}` +
        `&depart_date=${departDate}&ADT=1&CHD=0&INF=0&class=Economy`
    );
};

const searchLowestFares = async route => {
    const query = new URLSearchParams({ ...config.query, origin: route.origin, destination: route.destination });
    const response = await http.request({
        method: "GET",
        url: `${config.url}?${query}`,
        headers: { ...config.headers, Cookie: requireEnv("YATRA_COOKIE") },
    });

    if (response?.isError || !response?.day) {
        throw unexpectedResponse("yatra", route, response, "Yatra lowest fare service returned no day data");
    }
    return response;
};

const fetchMapping = async route => {
    const response = await searchLowestFares(route);
    const trackedDates = new Set(routes.getDepartureDates());
    const mapping = {};

    for (const [day, entry] of Object.entries(response.day)) {
        const amount = toNumber(entry?.lf);
        if (!trackedDates.has(day) || Number.isNaN(amount)) {
            continue;
        }
        mapping[day] = {
            amount,
            displayAmount: formatPrice(amount, 2),
            currencySymbol: "INR",
            airline: entry.la || "",
            url: toSearchUrl(day, route),
        };
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
