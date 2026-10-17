const http = require("../../lib/http");
const routes = require("../../lib/routes");
const { requireEnv, formatPrice, toNumber, unexpectedResponse } = require("../../lib/platform");
const config = require("./config.json");

const KAYAK_BASE_URL = "https://www.kayak.co.in";

const toSearchUrl = (day, route) => `${KAYAK_BASE_URL}/flights/${route.origin}-${route.destination}/${day}`;

const searchFareCalendar = async route => {
    const query = new URLSearchParams({ ...config.query, origin: route.origin, destination: route.destination });
    const response = await http.request({
        method: "GET",
        url: `${config.url}?${query}`,
        headers: { ...config.headers, Cookie: requireEnv("KAYAK_COOKIE") },
    });

    if (!response?.success || !response?.calendar) {
        throw unexpectedResponse("kayak", route, response, "Kayak fare calendar returned no calendar data");
    }
    return response;
};

const fetchMapping = async route => {
    const response = await searchFareCalendar(route);
    const mapping = {};

    for (const day of routes.getDepartureDates()) {
        const entry = response.calendar[day];
        const amount = toNumber(entry?.avgPrice);
        if (Number.isNaN(amount)) {
            continue;
        }
        mapping[day] = {
            amount,
            displayAmount: formatPrice(amount),
            currencySymbol: response.parameters?.currency || "INR",
            color: entry.color || "",
            url: toSearchUrl(day, route),
        };
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
