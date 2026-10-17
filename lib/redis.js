const redis = require("redis");

let client = null;
let isConnected = false;

// Connection failures are logged, not fatal: the monitor keeps running on in-memory baselines.
const initRedis = async () => {
    try {
        client = redis.createClient({ url: process.env.REDIS_URL });
        client.on("error", err => {
            console.error("Redis Client Error:", err);
            isConnected = false;
        });
        client.on("ready", () => {
            isConnected = true;
        });
        client.on("end", () => {
            console.log("Redis Client Connection Ended");
            isConnected = false;
        });
        await client.connect();
    } catch (error) {
        console.error("Failed to initialize Redis:", error);
        isConnected = false;
    }
};

const get = async key => {
    if (!isConnected) {
        return null;
    }
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error getting ${key} from Redis:`, error);
        return null;
    }
};

const set = async (key, value, ttlSeconds) => {
    if (!isConnected) {
        return;
    }
    try {
        await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (error) {
        console.error(`Error setting ${key} in Redis:`, error);
    }
};

module.exports = {
    initRedis,
    get,
    set,
};
