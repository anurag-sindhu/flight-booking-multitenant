const redis = require("./redis");
const routes = require("./routes");
const notifications = require("./notifications");
const rootConfig = require("../config.json");

// Only track flights at or below this price (₹). Anything pricier is ignored.
const MAX_TRACKED_PRICE = rootConfig.maxTrackedPrice;
const TTL_SECONDS = rootConfig.redisTtlDays * 24 * 60 * 60;

// Fallback baselines when Redis is unavailable; kept across polls for the life of the process.
const memoryLowest = {};

const getStoreKey = (platform, routeKey) => `flightBooking:${platform}:lowest:${routeKey}`;

// Stable unique identifier for a tracked price, so each flight can be told apart across
// platform / route / day / airline. Only stable identities are used — price-derived fields
// (fare bucket, colour) are deliberately avoided so a price change never changes the key and
// hides a genuine drop. Platforms with no airline collapse to platform:route:day (best
// available).
const buildPriceKey = ({ platform, routeKey, day, price }) => {
    return [platform, routeKey, day, price.airline].filter(Boolean).join(":");
};

const notifyPriceDrop = ({ platform, route, day, price, previous }) => {
    const airlineLabel = price.airline ? ` | ${price.airline}` : "";
    console.log(
        `${platform} | ${routes.formatRouteLabel(route)} | ${day}${airlineLabel} | ${previous.displayAmount} → ${
            price.displayAmount
        } ${price.currencySymbol} | key=${price.key} | ${new Date()}`,
    );
    if (price.url) {
        console.log(`URL | ${price.url}`);
    }

    const title = `✈️ Flight Price Alert - ${platform} | ${routes.formatRouteLabel(route)}`;
    const message = `Platform: ${platform}\nPrice decreased for ${day}${airlineLabel}\n${previous.displayAmount} → ${
        price.displayAmount
    } ${price.currencySymbol}\n${price.url || ""}`;

    notifications.sendNotification({ title, message });
};

const handleLowestPrices = async ({ platform, route, currentMapping }) => {
    const routeKey = routes.toRouteKey(route);
    const storeKey = getStoreKey(platform, routeKey);
    const lowestByKey = (await redis.get(storeKey)) || memoryLowest[storeKey] || {};

    for (const [day, current] of Object.entries(currentMapping)) {
        if (!(current.amount <= MAX_TRACKED_PRICE)) {
            continue;
        }
        // Unique key per flight (per airline where the platform provides it), so each
        // flight's price is tracked independently instead of collapsing to the day's lowest.
        // A different airline becoming cheapest is a fresh key, not a false "drop".
        const key = buildPriceKey({ platform, routeKey, day, price: current });
        current.key = key;

        const previous = lowestByKey[key];
        // Running minimum per key: only alert (and lower the baseline) on a new low for the
        // same flight. A price that bounces back up never raises the baseline, so the same
        // dip can't re-notify.
        if (!previous || current.amount < previous.amount) {
            if (previous) {
                notifyPriceDrop({ platform, route, day, price: current, previous });
            }
            lowestByKey[key] = current;
        }
    }

    memoryLowest[storeKey] = lowestByKey;
    await redis.set(storeKey, lowestByKey, TTL_SECONDS);
};

// `fetchMapping(route)` resolves to { [day]: { amount, displayAmount, currencySymbol, airline?, url? } }.
const pollPlatform = async ({ name: platform, fetchMapping }) => {
    for (const route of routes.getRoutes(platform)) {
        try {
            const currentMapping = await fetchMapping(route);
            if (!Object.keys(currentMapping).length) {
                console.log(
                    `flightBooking/${platform}: no tracked day prices for ${routes.formatRouteLabel(
                        route,
                    )} at ${new Date()}`,
                );
                continue;
            }
            await handleLowestPrices({ platform, route, currentMapping });
        } catch (err) {
            console.error(
                `flightBooking/${platform} poll failed for ${routes.formatRouteLabel(route)} at ${new Date()}: ${
                    err.message
                }`,
            );
        }
    }
};

module.exports = {
    pollPlatform,
};
