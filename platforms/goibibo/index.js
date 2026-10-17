const routes = require("../../lib/routes");
const { parseAmount } = require("../../lib/platform");
const { searchFareCalendar } = require("../../lib/mmtFareCalendar");
const config = require("./config.json");

const GOIBIBO_BASE_URL = "https://www.goibibo.com";

// Fares are keyed DDMMYY.
const toFareKey = isoDate => {
    const [year, month, day] = isoDate.split("-");
    return `${day}${month}${year.slice(2)}`;
};

const toSearchUrl = (day, route) => `${GOIBIBO_BASE_URL}/flights/air-${route.origin}-${route.destination}-${day}/`;

const fetchMapping = async route => {
    const { fares } = await searchFareCalendar({
        platform: "goibibo",
        config,
        deviceIdEnv: "GOIBIBO_DEVICE_ID",
        route,
    });
    const mapping = {};

    for (const day of routes.getDepartureDates()) {
        const entry = fares[toFareKey(day)];
        const amount = parseAmount(entry?.fr);
        if (Number.isNaN(amount)) {
            continue;
        }
        mapping[day] = {
            amount,
            displayAmount: entry.fr,
            currencySymbol: entry.cur || "INR",
            airline: entry.airlineInfo?.name || "",
            url: toSearchUrl(day, route),
        };
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
