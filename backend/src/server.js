require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

// Initialize database (creates tables on import)
require("./db");

const merchantRoutes = require("./routes/merchants");
const planRoutes = require("./routes/plans");
const paymentRoutes = require("./routes/payments");
const webhookRoutes = require("./routes/webhooks");
const keeperRoutes = require("./routes/keeper");
const { startEventListener } = require("./services/eventListener");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "X-API-Key"],
}));
app.use(morgan("dev"));
app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────────────

app.use("/api/merchants", merchantRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/keeper", keeperRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MezoPay API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get("/api", (req, res) => {
  res.json({
    name: "MezoPay API",
    version: "1.0.0",
    description: "MUSD Payment Infrastructure for Mezo",
    endpoints: {
      merchants: {
        register: "POST /api/merchants/register",
        get: "GET /api/merchants/:id",
        getByWallet: "GET /api/merchants/wallet/:wallet",
      },
      plans: {
        create: "POST /api/plans (auth: X-API-Key)",
        get: "GET /api/plans/:planId",
        listByMerchant: "GET /api/plans/merchant/:merchantId",
        deactivate: "PATCH /api/plans/:planId/deactivate (auth: X-API-Key)",
      },
      payments: {
        create: "POST /api/payments/create",
        get: "GET /api/payments/:paymentId",
        confirm: "POST /api/payments/:paymentId/confirm",
        stats: "GET /api/payments/stats/:merchantId",
      },
      webhooks: {
        register: "POST /api/webhooks/register (auth: X-API-Key)",
        get: "GET /api/webhooks (auth: X-API-Key)",
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Start ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║         MezoPay API Server           ║");
  console.log("  ╠══════════════════════════════════════╣");
  console.log(`  ║  Port:     ${PORT}                      ║`);
  console.log(`  ║  API:      http://localhost:${PORT}/api  ║`);
  console.log("  ║  Health:   /api/health                ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");

  // Start on-chain event listener
  startEventListener();
});

module.exports = app;
