const http = require("../../lib/http");
const routes = require("../../lib/routes");
const { requireEnv, formatPrice, toNumber, unexpectedResponse } = require("../../lib/platform");
const config = require("./config.json");

const SKYSCANNER_BASE_URL = "https://www.skyscanner.co.in";

const toSearchUrl = (day, route) => {
    const dateSlug = day.slice(2).replace(/-/g, "");
    return (
        `${SKYSCANNER_BASE_URL}/transport/flights/${route.origin.toLowerCase()}/${route.destination.toLowerCase()}/${dateSlug}/` +
        "?adultsv2=1&cabinclass=economy&childrenv2=&ref=home&rtn=0&preferdirects=false&outboundaltsenabled=false&inboundaltsenabled=false"
    );
};

const searchPriceCalendar = async route => {
    const response = await http.request({
        method: "POST",
        url: config.url,
        headers: { ...config.headers, Cookie: requireEnv("SKYSCANNER_COOKIE") },
        body: JSON.stringify({
            ...config.searchBody,
            originRelevantFlightSkyId: route.origin,
            destinationRelevantFlightSkyId: route.destination,
        }),
    });

    if (!response?.flights?.days?.length) {
        throw unexpectedResponse("skyscanner", route, response, "Skyscanner price calendar returned no days");
    }
    return response;
};

const fetchMapping = async route => {
    const response = await searchPriceCalendar(route);
    const trackedDates = new Set(routes.getDepartureDates());
    const mapping = {};

    for (const entry of response.flights.days) {
        const amount = toNumber(entry.price);
        if (!trackedDates.has(entry.day) || Number.isNaN(amount)) {
            continue;
        }
        mapping[entry.day] = {
            amount,
            displayAmount: formatPrice(amount, 2),
            currencySymbol: "INR",
            group: entry.group || "",
            url: toSearchUrl(entry.day, route),
        };
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
