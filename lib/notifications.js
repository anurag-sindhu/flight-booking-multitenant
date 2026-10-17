// Alerts are delivered by the tmrw notifications service (POST /notifications), which owns the Slack webhook.
const http = require("./http");
const { notificationChannels } = require("../config.json");

const sendNotification = async ({ title, message }) => {
    try {
        const response = await http.request({
            method: "POST",
            url: `${process.env.NOTIFICATIONS_URL}/notifications`,
            headers: { "auth-token": process.env.NOTIFICATIONS_AUTH_TOKEN },
            body: { title, message, channel: notificationChannels },
        });
        if (!response?.resp) {
            console.error(`Notification failed: ${JSON.stringify(response)?.slice(0, 500)}`);
        }
    } catch (err) {
        console.error(`Notification failed: ${err.message}`);
    }
};

module.exports = {
    sendNotification,
};
