const crypto = require("crypto");
const http = require("../../lib/http");
const routes = require("../../lib/routes");
const { requireEnv, formatPrice, parseAmount, unexpectedResponse } = require("../../lib/platform");
const config = require("./config.json");

const HAPPYFARES_BASE_URL = "https://www.happyfares.in";
// Filler1 packs fares as "@M/D/YYYY$price$airline$" entries.
const FARE_ENTRY_REGEX = /@(\d{1,2})\/(\d{1,2})\/(\d{4})\$([0-9,.]+)\$([A-Z0-9]+)\$/g;

const toSearchUrl = (day, route) => {
    const travelDate = day.split("-").reverse().join("/");
    return `${HAPPYFARES_BASE_URL}/?Origin=${route.origin}&Destination=${route.destination}&TravelDate=${travelDate}`;
};

const decodeFiller1 = filler1 => {
    const faresByDate = {};
    for (const [, month, day, year, price, airline] of filler1.matchAll(FARE_ENTRY_REGEX)) {
        const amount = parseAmount(price);
        if (!Number.isNaN(amount)) {
            faresByDate[`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`] = { amount, airline };
        }
    }
    return faresByDate;
};

const searchLowFareCalendar = async route => {
    // Strip non-printable characters that sneak in when the cookie is copied from the browser.
    const cookie = requireEnv("HAPPYFARES_COOKIE").replace(/[^\x20-\x7E]/g, "");
    const body = {
        ...config.searchBody,
        Origin: route.origin,
        Destination: route.destination,
        Header: {
            ...config.searchBody.Header,
            SessionId: crypto.randomUUID(),
            ProcessId: crypto.randomUUID(),
            RequestId: crypto.randomUUID(),
        },
    };

    const response = await http.request({
        method: "POST",
        url: config.url,
        headers: { ...config.headers, Cookie: cookie },
        body: JSON.stringify(body),
    });

    if (typeof response === "string" && response.trim().startsWith("<")) {
        throw new Error("HappyFares blocked request (Cloudflare). Refresh cookie from browser.");
    }
    if (response?.Status !== "1" || !response?.Data?.Filler1) {
        throw unexpectedResponse(
            "happyfares",
            route,
            response,
            "HappyFares low fare calendar returned no Filler1 data",
        );
    }
    return response;
};

const fetchMapping = async route => {
    const decodedFares = decodeFiller1((await searchLowFareCalendar(route)).Data.Filler1);
    const mapping = {};

    for (const day of routes.getDepartureDates()) {
        const entry = decodedFares[day];
        if (!entry) {
            continue;
        }
        mapping[day] = {
            amount: entry.amount,
            displayAmount: formatPrice(entry.amount, 2),
            currencySymbol: "INR",
            airline: entry.airline,
            url: toSearchUrl(day, route),
        };
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
