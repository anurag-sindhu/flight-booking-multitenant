const http = require("../../lib/http");
const routes = require("../../lib/routes");
const { requireEnv, formatPrice, toNumber, unexpectedResponse } = require("../../lib/platform");
const config = require("./config.json");

const PAYTM_BASE_URL = "https://tickets.paytm.com";

const toSearchUrl = (day, route) => {
    return (
        `${PAYTM_BASE_URL}/flights/flightSearch` +
        `?from=${route.origin}&to=${route.destination}&departure=${day}` +
        `&adults=1&children=0&infants=0&class=E&tripType=O`
    );
};

const searchFareCalendar = async route => {
    const query = new URLSearchParams({ ...config.query, source: route.origin, destination: route.destination });
    const response = await http.request({
        method: "GET",
        url: `${config.url}?${query}`,
        headers: { ...config.headers, Cookie: requireEnv("PAYTM_COOKIE") },
    });

    if (response?.code !== 0 || !response?.body?.fares?.onward) {
        throw unexpectedResponse("paytm", route, response, "Paytm fare calendar returned no onward fares");
    }
    return response;
};

const fetchMapping = async route => {
    const onwardFares = (await searchFareCalendar(route)).body.fares.onward;
    const mapping = {};

    for (const day of routes.getDepartureDates()) {
        const entry = onwardFares[day];
        const amount = toNumber(entry?.fare);
        if (entry?.noFlights || Number.isNaN(amount)) {
            continue;
        }
        mapping[day] = {
            amount,
            displayAmount: formatPrice(amount),
            currencySymbol: "INR",
            airline: typeof entry.airline === "string" ? entry.airline.replace(/\+/g, " ") : "",
            url: toSearchUrl(day, route),
        };
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
