const axios = require("axios");

const isParsable = str => {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
};

// Never throws on HTTP status: callers validate the payload shape instead.
const request = async ({ method, url, headers = {}, body, timeout = 30 * 1000 }) => {
    const response = await axios({
        method,
        url,
        timeout,
        headers:
            typeof body === "string" && !headers["Content-Type"]
                ? { ...headers, "Content-Type": "application/json" }
                : headers,
        data: body,
        validateStatus: () => true,
    });
    const { data } = response;
    return typeof data === "string" && isParsable(data) ? JSON.parse(data) : data;
};

module.exports = {
    request,
};
