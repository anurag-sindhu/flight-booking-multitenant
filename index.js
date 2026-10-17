process.loadEnvFile(`${__dirname}/.env`);

const rootConfig = require("./config.json");
const redis = require("./lib/redis");
const monitor = require("./lib/monitor");

// Enabled platforms, in poll order. Each module in platforms/ exports fetchMapping(route).
const platforms = rootConfig.platforms.map(name => ({ name, ...require(`./platforms/${name}`) }));

const MIN_POLL_MINUTES = 10;
const MAX_POLL_MINUTES = 15;
// No polling from quietHours.start to quietHours.end (local hours, start < end; set TZ for the machine).
const { start: QUIET_START_HOUR, end: QUIET_END_HOUR } = rootConfig.quietHours;

const pollAllPlatforms = async () => {
    for (const platform of platforms) {
        await monitor.pollPlatform(platform);
    }
    console.log(`-------------------------------- ${new Date()} --------------------------------`);
};

// Random 5–10 min gap so requests don't land on a fixed, bot-like cadence.
const getRandomPollInterval = () => {
    return (Math.random() * (MAX_POLL_MINUTES - MIN_POLL_MINUTES) + MIN_POLL_MINUTES) * 60 * 1000;
};

// Extra wait needed to push a run at `date` out of quiet hours (0 when it's outside them).
const getQuietHoursDelay = date => {
    const hour = date.getHours();
    if (hour < QUIET_START_HOUR || hour >= QUIET_END_HOUR) {
        return 0;
    }
    const quietEnd = new Date(date);
    quietEnd.setHours(QUIET_END_HOUR, 0, 0, 0);
    return quietEnd - date;
};

const schedulePoll = delay => {
    const totalDelay = delay + getQuietHoursDelay(new Date(Date.now() + delay));
    console.log(
        `Next poll scheduled in ${Math.round(totalDelay / 1000 / 60)} minutes at ${new Date(Date.now() + totalDelay)}`,
    );

    setTimeout(async () => {
        try {
            await pollAllPlatforms();
        } catch (err) {
            console.error(`Flight booking poll error: ${err.message}`);
        }
        schedulePoll(getRandomPollInterval());
    }, totalDelay);
};

const start = async () => {
    await redis.initRedis();
    console.log(`flightBooking monitor starting at ${new Date()}`);
    schedulePoll(0);
};

start().catch(err => {
    console.error(`flightBooking failed to start: ${err.message}`);
    process.exit(1);
});
