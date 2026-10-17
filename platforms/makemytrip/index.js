const routes = require("../../lib/routes");
const { requireEnv, parseAmount } = require("../../lib/platform");
const { searchFareCalendar } = require("../../lib/mmtFareCalendar");
const config = require("./config.json");

const MMT_BASE_URL = "https://www.makemytrip.com";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Fare entries only carry a label like "Sat, Nov 15" (no year), so match tracked dates on MM-DD.
const toMonthDay = txt => {
    const match = txt?.match(/,\s*(\w{3})\s+(\d{1,2})$/);
    const monthIndex = match ? MONTHS.indexOf(match[1]) : -1;
    if (monthIndex === -1) {
        return null;
    }
    return `${String(monthIndex + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
};

const toSearchUrl = (day, route) => {
    const [year, month, date] = day.split("-");
    return (
        `${MMT_BASE_URL}/flight/search?tripType=O&it=${route.origin},${route.destination},` +
        `${date}/${month}/${year},1,0,0,E`
    );
};

const fetchMapping = async route => {
    const { fares } = await searchFareCalendar({
        platform: "makemytrip",
        config,
        deviceIdEnv: "MAKEMYTRIP_DEVICE_ID",
        route,
        headers: { "mmt-auth": requireEnv("MAKEMYTRIP_MMT_AUTH") },
    });
    const trackedDates = routes.getDepartureDates();
    const mapping = {};

    for (const entry of Object.values(fares)) {
        const monthDay = toMonthDay(entry?.txt);
        const day = trackedDates.find(trackedDate => trackedDate.slice(5) === monthDay);
        const amount = parseAmount(entry?.fr);
        if (!day || Number.isNaN(amount)) {
            continue;
        }
        mapping[day] = {
            amount,
            displayAmount: entry.fr,
            currencySymbol: entry.cur || "INR",
            airline: entry.airlineInfo?.name || "",
            txt: entry.txt,
            url: toSearchUrl(day, route),
        };
    }
    return mapping;
};

module.exports = {
    fetchMapping,
};
