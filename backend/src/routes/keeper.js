const express = require("express");
const { ethers } = require("ethers");
const db = require("../db");
const { authenticateApiKey } = require("../middleware/auth");

const router = express.Router();

const PROCESSOR_ABI = [
  "function isPaymentDue(address subscriber, uint256 planId) view returns (bool)",
  "function processPayment(address subscriber, uint256 planId) returns (bytes32)",
  "function subscriptionCount() view returns (uint256)",
  "function userSubscription(address, uint256) view returns (uint256)",
  "function subscriptions(uint256) view returns (uint256 subscriptionId, uint256 planId, address subscriber, address merchant, uint256 priceInMUSD, uint256 nextPaymentDue, uint256 billingInterval, bool active, uint256 createdAt)",
];

/**
 * GET /api/keeper/due
 * List all subscriptions that have a due payment.
 * Returns an array of { subscriber, planId, subscriptionId, nextPaymentDue }
 */
router.get("/due", async (req, res) => {
  try {
    const rpcUrl = process.env.RPC_URL;
    const processorAddress = process.env.PROCESSOR_ADDRESS;

    if (!rpcUrl || !processorAddress || processorAddress === "0x0000000000000000000000000000000000000000") {
      return res.json({ due: [], message: "Processor not configured." });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const processor = new ethers.Contract(processorAddress, PROCESSOR_ABI, provider);

    // Get all active subscriptions from DB
    const subs = db.prepare("SELECT * FROM subscriptions WHERE status = 'active'").all();

    const due = [];
    for (const sub of subs) {
      try {
        // Get on-chain subscription data
        const isDue = await processor.isPaymentDue(sub.subscriber, sub.plan_id);
        if (isDue) {
          // Get full subscription details
          const subId = await processor.userSubscription(sub.subscriber, sub.plan_id);
          if (subId > 0n) {
            const onChainSub = await processor.subscriptions(subId);
            due.push({
              subscriber: sub.subscriber,
              planId: sub.plan_id,
              subscriptionId: Number(subId),
              nextPaymentDue: Number(onChainSub.nextPaymentDue),
              priceInMUSD: ethers.formatEther(onChainSub.priceInMUSD),
              merchant: onChainSub.merchant,
            });
          }
        }
      } catch (_) {
        // Ignore individual subscription errors
      }
    }

    res.json({ due, count: due.length });
  } catch (err) {
    console.error("Keeper due error:", err);
    res.status(500).json({ error: "Failed to check due payments: " + err.message });
  }
});

/**
 * POST /api/keeper/process
 * Trigger a recurring payment on-chain. Requires PRIVATE_KEY in env.
 * Body: { subscriber, planId }
 */
router.post("/process", authenticateApiKey, async (req, res) => {
  try {
    const { subscriber, planId } = req.body;

    if (!subscriber || !planId) {
      return res.status(400).json({ error: "subscriber and planId are required." });
    }

    const rpcUrl = process.env.RPC_URL;
    const processorAddress = process.env.PROCESSOR_ADDRESS;
    const privateKey = process.env.KEEPER_PRIVATE_KEY;

    if (!privateKey) {
      return res.status(500).json({ error: "Keeper private key not configured." });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const processor = new ethers.Contract(processorAddress, PROCESSOR_ABI, wallet);

    // Verify payment is due before submitting tx
    const isDue = await processor.isPaymentDue(subscriber, planId);
    if (!isDue) {
      return res.status(400).json({ error: "Payment is not yet due." });
    }

    const tx = await processor.processPayment(subscriber, planId);
    const receipt = await tx.wait();

    res.json({
      message: "Recurring payment processed successfully.",
      subscriber,
      planId,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (err) {
    console.error("Keeper process error:", err);
    res.status(500).json({ error: "Failed to process payment: " + (err.shortMessage || err.message) });
  }
});

/**
 * GET /api/keeper/stats
 * Get keeper statistics (total subscriptions, active, due count).
 */
router.get("/stats", async (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as count FROM subscriptions").get();
    const active = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'").get();
    const cancelled = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled'").get();

    res.json({
      total: total.count,
      active: active.count,
      cancelled: cancelled.count,
    });
  } catch (err) {
    console.error("Keeper stats error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
