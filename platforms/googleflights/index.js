const { setTimeout: sleep } = require("timers/promises");
const http = require("../../lib/http");
const routes = require("../../lib/routes");
const { requireEnv, formatPrice } = require("../../lib/platform");
const config = require("./config.json");

const GOOGLE_FLIGHTS_BASE_URL = "https://www.google.com/travel/flights";
const RATE_LIMIT_MS = 3000;
const MIN_PRICE = 3000;
const MAX_PRICE = 500000;

// Candidate price spots in the page: "₹12,500" / "INR 12500", JSON price fields, data-price attributes.
const PRICE_PATTERNS = [
    /(?:₹|INR)\s*(\d{1,3}(?:,\d{3})*|\d{4,6})/g,
    /"(?:price|fare|amount|cost)"\s*:\s*(\d{4,6})/g,
    /data-(?:price|fare|amount)=["'](\d{4,6})["']/g,
];

const buildSearchUrl = (isoDate, route) => {
    return `${GOOGLE_FLIGHTS_BASE_URL}#flt=${route.origin}.${route.destination}.${isoDate};c:INR;e:1;sd:1;t:f`;
};

// Lowest plausible fare scraped from the page HTML, or null when none is found.
const extractLowestPrice = html => {
    const prices = PRICE_PATTERNS.flatMap(pattern => [...html.matchAll(pattern)])
        .map(match => Number(match[1].replace(/,/g, "")))
        .filter(price => price > MIN_PRICE && price < MAX_PRICE);
    return prices.length ? Math.min(...prices) : null;
};

const fetchMapping = async route => {
    const headers = { ...config.headers, cookie: requireEnv("GOOGLEFLIGHTS_COOKIE") };
    const mapping = {};

    for (const isoDate of routes.getDepartureDates()) {
        try {
            const url = buildSearchUrl(isoDate, route);
            const html = await http.request({ method: "GET", url, headers, timeout: 20 * 1000 });
            const amount = typeof html === "string" ? extractLowestPrice(html) : null;
            if (amount) {
                mapping[isoDate] = {
                    amount,
                    displayAmount: `₹${formatPrice(amount)}`,
                    currencySymbol: "INR",
                    url,
                };
            } else {
                console.warn(
                    `flightBooking/googleflights: no prices extracted for ${routes.formatRouteLabel(
                        route,
                    )} on ${isoDate}. ` + "Cookie may be expired or the page structure changed.",
                );
            }
            await sleep(RATE_LIMIT_MS);
        } catch (err) {
            console.error(`flightBooking/googleflights: error fetching ${isoDate} — ${err.message}`);
        }
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
