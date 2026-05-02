const express = require("express");
const db = require("../db");
const { authenticateApiKey } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/plans
 * Create a new payment plan. Requires API key.
 * Body: { name, price, planType, billingInterval? }
 */
router.post("/", authenticateApiKey, (req, res) => {
  try {
    const { name, price, planType, billingInterval = 0, onChainPlanId = 0 } = req.body;

    if (!name || !price || !planType) {
      return res.status(400).json({ error: "name, price, and planType are required." });
    }

    const validTypes = ["ONE_TIME", "SUBSCRIPTION", "PAY_PER_USE"];
    if (!validTypes.includes(planType)) {
      return res.status(400).json({ error: `planType must be one of: ${validTypes.join(", ")}` });
    }

    if (planType !== "ONE_TIME" && (!billingInterval || billingInterval <= 0)) {
      return res.status(400).json({ error: "billingInterval required for recurring plans." });
    }

    const result = db.prepare(
      "INSERT INTO plans (merchant_id, on_chain_plan_id, name, price, plan_type, billing_interval) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(req.merchant.id, onChainPlanId, name, price, planType, planType === "ONE_TIME" ? 0 : billingInterval);

    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(result.lastInsertRowid);

    res.status(201).json({
      planId: plan.id,
      ...plan,
      paymentUrl: `${req.protocol}://${req.get("host")}/pay/${plan.id}`,
    });
  } catch (err) {
    console.error("Create plan error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/plans/:planId
 * Get plan details (public).
 */
router.get("/:planId", (req, res) => {
  try {
    const plan = db.prepare(`
      SELECT p.*, m.name as merchant_name, m.wallet as merchant_wallet
      FROM plans p
      JOIN merchants m ON p.merchant_id = m.id
      WHERE p.id = ?
    `).get(req.params.planId);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found." });
    }

    res.json(plan);
  } catch (err) {
    console.error("Get plan error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /api/plans/merchant/:merchantId
 * List all plans for a merchant (public).
 */
router.get("/merchant/:merchantId", (req, res) => {
  try {
    const plans = db.prepare("SELECT * FROM plans WHERE merchant_id = ? ORDER BY created_at DESC")
      .all(req.params.merchantId);

    res.json(plans);
  } catch (err) {
    console.error("List plans error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * PATCH /api/plans/:planId/deactivate
 * Deactivate a plan. Requires API key.
 */
router.patch("/:planId/deactivate", authenticateApiKey, (req, res) => {
  try {
    const plan = db.prepare("SELECT * FROM plans WHERE id = ? AND merchant_id = ?")
      .get(req.params.planId, req.merchant.id);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found or not owned by you." });
    }

    db.prepare("UPDATE plans SET active = 0 WHERE id = ?").run(plan.id);

    res.json({ message: "Plan deactivated.", planId: plan.id });
  } catch (err) {
    console.error("Deactivate plan error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
