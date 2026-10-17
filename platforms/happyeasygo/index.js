const http = require("../../lib/http");
const routes = require("../../lib/routes");
const { requireEnv, formatPrice, toNumber, unexpectedResponse } = require("../../lib/platform");
const config = require("./config.json");

const HEG_BASE_URL = "https://www.happyeasygo.com";

const toSearchUrl = (day, route) => {
    return (
        `${HEG_BASE_URL}/flights/${route.origin}-${route.destination}/${day}` +
        `?from=${route.origin}&to=${route.destination}&date=${day}`
    );
};

const searchLowPriceCalendar = async route => {
    const response = await http.request({
        method: "POST",
        url: config.url,
        headers: { ...config.headers, Cookie: requireEnv("HAPPYEASYGO_COOKIE") },
        body: JSON.stringify({
            ...config.searchBody,
            from: route.origin,
            to: route.destination,
            date: routes.getEarliestDepartureDate(),
        }),
    });

    if (!response?.success || !response?.data) {
        throw unexpectedResponse("happyeasygo", route, response, "HappyEasyGo low price calendar returned no data");
    }
    return response;
};

// Calendar is nested as { "YYYY-MM": { "DD": price } }.
const fetchMapping = async route => {
    const response = await searchLowPriceCalendar(route);
    const mapping = {};

    for (const day of routes.getDepartureDates()) {
        const price = response.data[day.slice(0, 7)]?.[day.slice(8)];
        const amount = toNumber(price);
        if (Number.isNaN(amount)) {
            continue;
        }
        mapping[day] = {
            amount,
            displayAmount: formatPrice(amount),
            currencySymbol: "INR",
            url: toSearchUrl(day, route),
        };
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
