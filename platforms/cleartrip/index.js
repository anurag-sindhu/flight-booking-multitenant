const crypto = require("crypto");
const http = require("../../lib/http");
const routes = require("../../lib/routes");
const { requireEnv, formatPrice, unexpectedResponse } = require("../../lib/platform");
const config = require("./config.json");

const CLEARTRIP_BASE_URL = "https://www.cleartrip.com";

// Cleartrip dates are DD-MM-YYYY.
const toIsoDate = cleartripDate => cleartripDate.split("-").reverse().join("-");

const toSearchUrl = (cleartripDate, route) => {
    const departDate = cleartripDate.replace(/-/g, "/");
    return (
        `${CLEARTRIP_BASE_URL}/flights/results?from=${route.origin}&to=${route.destination}` +
        `&depart_date=${departDate}&adults=1&childs=0&infants=0&class=Economy`
    );
};

const searchFareCalendar = async route => {
    const body = {
        ...config.searchBody,
        departDetails: {
            from: route.origin,
            to: route.destination,
            startDate: new Date(`${routes.getEarliestDepartureDate()}T00:00:00+05:30`).getTime(),
        },
    };

    const response = await http.request({
        method: "POST",
        url: config.url,
        headers: {
            ...config.headers,
            Cookie: requireEnv("CLEARTRIP_COOKIE"),
            "x-unified-header": JSON.stringify({
                platform: "desktop",
                trackingId: crypto.randomUUID(),
                source: "CLEARTRIP",
                deviceModel: "macintosh",
            }),
        },
        body: JSON.stringify(body),
    });

    if (!response?.dayData?.length) {
        throw unexpectedResponse("cleartrip", route, response, "Cleartrip fare calendar returned no dayData");
    }
    return response;
};

const fetchMapping = async route => {
    const response = await searchFareCalendar(route);
    const trackedDates = new Set(routes.getDepartureDates());
    const mapping = {};

    for (const entry of response.dayData) {
        if (!entry?.farePresent || entry.amount == null) {
            continue;
        }
        const day = toIsoDate(entry.date);
        const amount = Number(entry.amount);
        if (!trackedDates.has(day) || Number.isNaN(amount)) {
            continue;
        }
        mapping[day] = {
            amount,
            displayAmount: formatPrice(amount, 2),
            currencySymbol: "INR",
            fareCategory: entry.fareCategory || "",
            url: toSearchUrl(entry.date, route),
        };
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
