const { ethers } = require("ethers");
const db = require("../db");
const { fireWebhook } = require("../routes/webhooks");

// ABI fragments for events we care about
const PROCESSOR_EVENTS_ABI = [
  "event PaymentProcessed(bytes32 indexed paymentId, uint256 indexed planId, address indexed subscriber, address merchant, uint256 amount, uint256 timestamp)",
  "event SubscriptionCreated(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, address merchant)",
  "event SubscriptionCancelled(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber)",
];

/**
 * Start listening to on-chain MezoPayProcessor events.
 * Updates local DB and fires webhooks to merchants.
 */
async function startEventListener() {
  const rpcUrl = process.env.RPC_URL;
  const processorAddress = process.env.PROCESSOR_ADDRESS;

  if (!rpcUrl || !processorAddress || processorAddress === "0x0000000000000000000000000000000000000000") {
    console.log("[EventListener] Skipping — processor address not configured.");
    return;
  }

  console.log(`[EventListener] Connecting to ${rpcUrl}...`);
  console.log(`[EventListener] Watching processor at ${processorAddress}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const processor = new ethers.Contract(processorAddress, PROCESSOR_EVENTS_ABI, provider);

  console.log("[EventListener] Listening for on-chain events via stateless polling...");

  let lastBlock;
  try {
    lastBlock = await provider.getBlockNumber();
  } catch (err) {
    console.error("[EventListener] Failed to get initial block:", err.message);
    lastBlock = 0;
  }

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastBlock) return;

      // Stateless getLogs approach avoids 'filter not found' errors on public load-balanced RPCs
      const events = await processor.queryFilter("*", lastBlock + 1, currentBlock);

      for (const event of events) {
        if (!event.fragment) continue;

        if (event.fragment.name === "PaymentProcessed") {
          const [paymentId, planId, subscriber, merchant, amount, timestamp] = event.args;
          console.log(`[Event] PaymentProcessed — Plan: ${planId}, Subscriber: ${subscriber}, Amount: ${ethers.formatEther(amount)} MUSD`);

          try {
            const merchantRow = db.prepare("SELECT * FROM merchants WHERE wallet = ?").get(merchant.toLowerCase());
            if (merchantRow) {
              db.prepare(
                "INSERT OR IGNORE INTO payments (payment_id, plan_id, payer, merchant, amount, tx_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
              ).run(paymentId, Number(planId), subscriber.toLowerCase(), merchant.toLowerCase(), ethers.formatEther(amount), event.transactionHash, "confirmed");

              await fireWebhook(merchantRow.id, "payment.confirmed", {
                paymentId, planId: Number(planId), subscriber: subscriber.toLowerCase(), amount: ethers.formatEther(amount), txHash: event.transactionHash
              });
            }
          } catch (e) {
            console.error("[Event] Error processing PaymentProcessed:", e.message);
          }
        } 
        else if (event.fragment.name === "SubscriptionCreated") {
          const [subscriptionId, planId, subscriber, merchant] = event.args;
          console.log(`[Event] SubscriptionCreated — SubId: ${subscriptionId}, Plan: ${planId}, Subscriber: ${subscriber}`);

          try {
            db.prepare(
              "INSERT OR IGNORE INTO subscriptions (on_chain_sub_id, plan_id, subscriber, merchant, status) VALUES (?, ?, ?, ?, ?)"
            ).run(Number(subscriptionId), Number(planId), subscriber.toLowerCase(), merchant.toLowerCase(), "active");

            const merchantRow = db.prepare("SELECT * FROM merchants WHERE wallet = ?").get(merchant.toLowerCase());
            if (merchantRow) {
              await fireWebhook(merchantRow.id, "subscription.created", {
                subscriptionId: Number(subscriptionId), planId: Number(planId), subscriber: subscriber.toLowerCase()
              });
            }
          } catch (e) {
            console.error("[Event] Error processing SubscriptionCreated:", e.message);
          }
        }
        else if (event.fragment.name === "SubscriptionCancelled") {
          const [subscriptionId, planId, subscriber] = event.args;
          console.log(`[Event] SubscriptionCancelled — SubId: ${subscriptionId}, Plan: ${planId}`);

          try {
            db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE on_chain_sub_id = ?").run(Number(subscriptionId));

            const sub = db.prepare("SELECT * FROM subscriptions WHERE on_chain_sub_id = ?").get(Number(subscriptionId));
            if (sub) {
              const merchantRow = db.prepare("SELECT * FROM merchants WHERE wallet = ?").get(sub.merchant);
              if (merchantRow) {
                await fireWebhook(merchantRow.id, "subscription.cancelled", {
                  subscriptionId: Number(subscriptionId), planId: Number(planId), subscriber: subscriber.toLowerCase()
                });
              }
            }
          } catch (e) {
            console.error("[Event] Error processing SubscriptionCancelled:", e.message);
          }
        }
      }

      lastBlock = currentBlock;
    } catch (err) {
      // Swallowing intermittent load balancer errors gracefully 
    }
  }, 10000); // Poll every 10 seconds
}

module.exports = { startEventListener };
