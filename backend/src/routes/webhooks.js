const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { authenticateApiKey } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/webhooks/register
 * Register a webhook URL. Requires API key.
 * Body: { url }
 */
router.post("/register", authenticateApiKey, (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "url is required." });
    }

    // Generate webhook secret for HMAC verification
    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

    // Deactivate existing webhooks for this merchant
    db.prepare("UPDATE webhooks SET active = 0 WHERE merchant_id = ?").run(req.merchant.id);

    // Insert new webhook
    const result = db.prepare(
      "INSERT INTO webhooks (merchant_id, url, secret) VALUES (?, ?, ?)"
    ).run(req.merchant.id, url, secret);

    res.status(201).json({
      webhookId: result.lastInsertRowid,
      url,
      secret,
      message: "Webhook registered. Use the secret to verify incoming webhook signatures.",
    });
  } catch (err) {
    console.error("Register webhook error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/webhooks
 * Get active webhook for the authenticated merchant.
 */
router.get("/", authenticateApiKey, (req, res) => {
  try {
    const webhook = db.prepare(
      "SELECT id, url, active, created_at FROM webhooks WHERE merchant_id = ? AND active = 1"
    ).get(req.merchant.id);

    res.json(webhook || { message: "No active webhook configured." });
  } catch (err) {
    console.error("Get webhook error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * Fire a webhook to a merchant.
 * @param {number} merchantId
 * @param {string} event - Event type (payment.confirmed, subscription.created, etc.)
 * @param {object} data - Event payload
 */
async function fireWebhook(merchantId, event, data) {
  try {
    const webhook = db.prepare(
      "SELECT * FROM webhooks WHERE merchant_id = ? AND active = 1"
    ).get(merchantId);

    if (!webhook) return;

    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(payload)
      .digest("hex");

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MezoPay-Signature": signature,
      },
      body: payload,
    });

    console.log(`Webhook fired to ${webhook.url}: ${response.status}`);
  } catch (err) {
    console.error(`Webhook delivery failed for merchant ${merchantId}:`, err.message);
  }
}

module.exports = router;
module.exports.fireWebhook = fireWebhook;
