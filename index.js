const rootConfig = require("./config.json");
const redis = require("./lib/redis");
const monitor = require("./lib/monitor");

// Enabled platforms, in poll order. Each module in platforms/ exports fetchMapping(route).
const platforms = rootConfig.platforms.map(name => ({ name, ...require(`./platforms/${name}`) }));

const MIN_POLL_MINUTES = 5;
const MAX_POLL_MINUTES = 10;

const pollAllPlatforms = async () => {
    for (const platform of platforms) {
        await monitor.pollPlatform(platform);
    }
    console.log(`-------------------------------- ${new Date()} --------------------------------`);
};

// Random 5–10 min gap so requests don't land on a fixed, bot-like cadence.
const schedulePoll = () => {
    const minutes = Math.random() * (MAX_POLL_MINUTES - MIN_POLL_MINUTES) + MIN_POLL_MINUTES;
    const interval = minutes * 60 * 1000;
    console.log(`Next poll scheduled in ${Math.round(minutes)} minutes at ${new Date(Date.now() + interval)}`);

    setTimeout(async () => {
        try {
            await pollAllPlatforms();
        } catch (err) {
            console.error(`Flight booking poll error: ${err.message}`);
        }
        schedulePoll();
    }, interval);
};

const start = async () => {
    await redis.initRedis();
    console.log(`flightBooking monitor starting at ${new Date()}`);
    await pollAllPlatforms();
    schedulePoll();
};

start().catch(err => {
    console.error(`flightBooking failed to start: ${err.message}`);
    process.exit(1);
});
