const express = require("express");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

/**
 * POST /api/merchants/register
 * Register a new merchant. Returns API key.
 * Body: { wallet, name, webhookUrl? }
 */
router.post("/register", (req, res) => {
  try {
    const { wallet, name, webhookUrl = "", onChainId = 0 } = req.body;

    if (!wallet || !name) {
      return res.status(400).json({ error: "wallet and name are required." });
    }

    // Check if wallet already registered
    const existing = db.prepare("SELECT id FROM merchants WHERE wallet = ?").get(wallet.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: "Wallet already registered." });
    }

    // Generate API key
    const apiKey = `mpk_${crypto.randomBytes(24).toString("hex")}`;

    const result = db.prepare(
      "INSERT INTO merchants (wallet, api_key, name, webhook_url, on_chain_id) VALUES (?, ?, ?, ?, ?)"
    ).run(wallet.toLowerCase(), apiKey, name, webhookUrl, onChainId);

    res.status(201).json({
      merchantId: result.lastInsertRowid,
      apiKey,
      name,
      wallet: wallet.toLowerCase(),
      webhookUrl,
      message: "Merchant registered successfully. Save your API key — it won't be shown again.",
    });
  } catch (err) {
    console.error("Register merchant error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/merchants/:id
 * Get merchant details (public, no API key needed).
 */
router.get("/:id", (req, res) => {
  try {
    const merchant = db.prepare(
      "SELECT id, wallet, name, webhook_url, on_chain_id, created_at FROM merchants WHERE id = ?"
    ).get(req.params.id);

    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found." });
    }

    res.json(merchant);
  } catch (err) {
    console.error("Get merchant error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/merchants/wallet/:wallet
 * Get merchant by wallet address.
 */
router.get("/wallet/:wallet", (req, res) => {
  try {
    const merchant = db.prepare(
      "SELECT id, wallet, name, api_key, webhook_url, on_chain_id, created_at FROM merchants WHERE wallet = ?"
    ).get(req.params.wallet.toLowerCase());

    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found." });
    }

    res.json(merchant);
  } catch (err) {
    console.error("Get merchant error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
