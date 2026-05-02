const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { authenticateApiKey } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/payments/create
 * Create a payment intent. Returns payment details + URL.
 * Body: { planId, payerWallet }
 */
router.post("/create", (req, res) => {
  try {
    const { planId, payerWallet } = req.body;

    if (!planId || !payerWallet) {
      return res.status(400).json({ error: "planId and payerWallet are required." });
    }

    const plan = db.prepare(`
      SELECT p.*, m.name as merchant_name, m.wallet as merchant_wallet
      FROM plans p
      JOIN merchants m ON p.merchant_id = m.id
      WHERE p.id = ?
    `).get(planId);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found." });
    }

    if (!plan.active) {
      return res.status(400).json({ error: "Plan is inactive." });
    }

    const paymentId = `pay_${uuidv4()}`;

    db.prepare(
      "INSERT INTO payments (payment_id, plan_id, payer, merchant, amount, status) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(paymentId, planId, payerWallet.toLowerCase(), plan.merchant_wallet, plan.price, "pending");

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    res.status(201).json({
      paymentId,
      planId: plan.id,
      planName: plan.name,
      merchantName: plan.merchant_name,
      amount: plan.price,
      planType: plan.plan_type,
      paymentUrl: `${frontendUrl}/pay/${plan.id}`,
      status: "pending",
    });
  } catch (err) {
    console.error("Create payment error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/payments/merchant/all
 * Get all payments for the authenticated merchant.
 * NOTE: Must be declared BEFORE /:paymentId to avoid route conflict.
 */
router.get("/merchant/all", authenticateApiKey, (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT pay.*, p.name as plan_name, p.plan_type
      FROM payments pay
      JOIN plans p ON pay.plan_id = p.id
      WHERE p.merchant_id = ?
      ORDER BY pay.created_at DESC
      LIMIT 200
    `).all(req.merchant.id);

    res.json(payments);
  } catch (err) {
    console.error("List payments error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/payments/stats/:merchantId
 * Get payment statistics for a merchant.
 * NOTE: Must be declared BEFORE /:paymentId to avoid route conflict.
 */
router.get("/stats/:merchantId", (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_payments,
        SUM(CASE WHEN pay.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_payments,
        COUNT(DISTINCT pay.payer) as unique_payers,
        SUM(CASE WHEN pay.status = 'confirmed' THEN CAST(pay.amount AS REAL) ELSE 0 END) as total_volume
      FROM payments pay
      JOIN plans p ON pay.plan_id = p.id
      WHERE p.merchant_id = ?
    `).get(req.params.merchantId);

    const activeSubscriptions = db.prepare(`
      SELECT COUNT(*) as count
      FROM subscriptions
      WHERE merchant = (SELECT wallet FROM merchants WHERE id = ?) AND status = 'active'
    `).get(req.params.merchantId);

    res.json({
      ...stats,
      total_volume: parseFloat(stats.total_volume || 0).toFixed(2),
      active_subscriptions: activeSubscriptions?.count || 0,
    });
  } catch (err) {
    console.error("Get stats error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/payments/:paymentId
 * Check payment status.
 * NOTE: Must be declared AFTER specific routes above.
 */
router.get("/:paymentId", (req, res) => {
  try {
    const payment = db.prepare(`
      SELECT pay.*, p.name as plan_name, p.plan_type
      FROM payments pay
      JOIN plans p ON pay.plan_id = p.id
      WHERE pay.payment_id = ?
    `).get(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found." });
    }

    res.json(payment);
  } catch (err) {
    console.error("Get payment error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * POST /api/payments/:paymentId/confirm
 * Confirm a payment with transaction hash (called after on-chain tx).
 * Body: { txHash }
 */
router.post("/:paymentId/confirm", (req, res) => {
  try {
    const { txHash } = req.body;
    const { paymentId } = req.params;

    if (!txHash) {
      return res.status(400).json({ error: "txHash is required." });
    }

    const payment = db.prepare("SELECT * FROM payments WHERE payment_id = ?").get(paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found." });
    }

    db.prepare("UPDATE payments SET status = 'confirmed', tx_hash = ? WHERE payment_id = ?")
      .run(txHash, paymentId);

    res.json({ message: "Payment confirmed.", paymentId, txHash, status: "confirmed" });
  } catch (err) {
    console.error("Confirm payment error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
