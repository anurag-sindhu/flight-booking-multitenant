// Helpers shared by the platform adapters in platforms/.
const routes = require("./routes");

const requireEnv = name => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required in .env`);
    }
    return value;
};

const formatPrice = (amount, maximumFractionDigits = 0) => {
    return Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits });
};

// Like Number(), but a missing or empty value is NaN instead of 0.
const toNumber = value => (value == null || value === "" ? NaN : Number(value));

// For prices the API returns as display strings, e.g. "4,512".
const parseAmount = value => parseFloat(String(value ?? "").replace(/,/g, ""));

const unexpectedResponse = (platform, route, response, message) => {
    console.error(
        `flightBooking/${platform}: unexpected response for ${routes.formatRouteLabel(route)} at ${new Date()}`,
        JSON.stringify(response)?.slice(0, 500),
    );
    return new Error(message);
};

module.exports = {
    requireEnv,
    formatPrice,
    toNumber,
    parseAmount,
    unexpectedResponse,
};
