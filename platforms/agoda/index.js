const { setTimeout: sleep } = require("timers/promises");
const crypto = require("crypto");
const http = require("../../lib/http");
const routes = require("../../lib/routes");
const { requireEnv, parseAmount } = require("../../lib/platform");
const config = require("./config.json");

const AGODA_BASE_URL = "http://agoda.com";
const SEARCH_MAX_ATTEMPTS = 3;
const SEARCH_RETRY_DELAY_MS = 1500;

const toBookingUrl = url => {
    if (!url) {
        return "";
    }
    if (url.startsWith("http")) {
        const { pathname, search } = new URL(url);
        return `${AGODA_BASE_URL}${pathname}${search}`;
    }
    return `${AGODA_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
};

const getItemPrice = item => {
    const priceBlock = item?.totalPrice?.priceAfterDiscount || item?.price?.priceAfterDiscount;
    if (!priceBlock?.amount) {
        return null;
    }
    return {
        amount: parseAmount(priceBlock.amount),
        displayAmount: priceBlock.amount,
        currencySymbol: priceBlock.currencySymbol || "",
    };
};

const setSliceAirports = (slice, departureDate, route) => {
    slice.departureDate = departureDate;
    slice.origin = [{ code: route.origin, type: "Airport" }];
    slice.destination = [{ code: route.destination, type: "Airport" }];
};

const buildSearchBody = (departureDate, route) => {
    const body = structuredClone(config.searchBody);
    setSliceAirports(body.searchCriteria.trip.outboundSlice, departureDate, route);
    body.searchCriteria.trip.slices.forEach(slice => setSliceAirports(slice, departureDate, route));
    return body;
};

// Cheapest bundle of the day; its bundleRefId is kept for reference.
const getLowestBundle = response => {
    let lowest = null;
    for (const item of response?.data?.response?.content?.items || []) {
        const price = getItemPrice(item);
        if (!item?.bundleRefId || !price || Number.isNaN(price.amount)) {
            continue;
        }
        if (!lowest || price.amount < lowest.amount) {
            lowest = { ...price, url: toBookingUrl(item.url), bundleRefId: item.bundleRefId };
        }
    }
    return lowest;
};

const searchFlights = async (departureDate, route) => {
    const cookie = requireEnv("AGODA_COOKIE");

    // Agoda's search is async (polling.count: 1 = one snapshot), so the first response can
    // come back with an empty items[] while results are still streaming. Retry a few times
    // so a partial snapshot doesn't drop the date from tracking.
    let response = null;
    for (let attempt = 1; attempt <= SEARCH_MAX_ATTEMPTS; attempt++) {
        response = await http.request({
            method: "POST",
            url: config.url,
            headers: {
                ...config.headers,
                Cookie: cookie,
                "ag-bff-polling-id": crypto.randomUUID(),
                "ag-request-id": crypto.randomUUID(),
            },
            body: JSON.stringify(buildSearchBody(departureDate, route)),
        });

        const items = response?.data?.response?.content?.items;
        if (Array.isArray(items) && items.length) {
            return response;
        }
        if (!items) {
            console.error(
                `flightBooking/agoda: unexpected response for ${routes.formatRouteLabel(
                    route,
                )} ${departureDate} at ${new Date()}`,
                JSON.stringify(response)?.slice(0, 500),
            );
        }
        if (attempt < SEARCH_MAX_ATTEMPTS) {
            await sleep(SEARCH_RETRY_DELAY_MS);
        }
    }

    // Exhausted retries. A well-formed but empty items[] is a valid "no flights" result;
    // a missing items[] means a malformed response.
    if (response?.data?.response?.content?.items) {
        return response;
    }
    throw new Error(`Agoda flights search returned no items for ${departureDate}`);
};

// Agoda has no fare calendar, so each tracked date is a separate search.
const fetchMapping = async route => {
    const mapping = {};
    for (const departureDate of routes.getDepartureDates()) {
        try {
            const lowest = getLowestBundle(await searchFlights(departureDate, route));
            if (lowest) {
                mapping[departureDate] = lowest;
            }
        } catch (err) {
            console.error(
                `flightBooking/agoda poll failed for ${routes.formatRouteLabel(
                    route,
                )} ${departureDate} at ${new Date()}: ${err.message}`,
            );
        }
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
