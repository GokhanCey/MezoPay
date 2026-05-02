# MezoPay: MUSD Payment Infrastructure for Bitcoin's Future

Accept MUSD payments with one line of code. One-time, subscriptions, and pay-per-use. Settled instantly on-chain without banks or intermediaries.

Built for the **Mezo Hackathon** for the **Supernormal dApps Track (MUSD Track)**  
🏆 Category: Payments Systems, Merchant & Commerce Tools, Agentic Payments

***

## 🎯 What We Built

MezoPay is a complete MUSD payment infrastructure platform that makes accepting Bitcoin-backed stablecoin payments as simple as copying a link.

Any merchant, creator, or developer can:
1. **Connect their wallet** to register in seconds
2. **Create a payment plan** for one-time, subscription, or pay-per-use billing
3. **Share a payment link** so customers pay with MUSD via Mezo Passport
4. **Receive MUSD directly** via wallet-to-wallet transfer with zero intermediaries

### Why It Matters for the Track

The hackathon asks: *"Bitcoin should be as normal as using your phone."*

MezoPay is the infrastructure layer that makes that possible. Without a payment rail that developers can plug into, every dApp team has to reinvent subscription billing, payment flows, and webhook integrations. MezoPay solves this once for everyone.

Bitcoin-backed MUSD is the primary currency. Users never see crypto complexity, they just pay.

***

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **3 Payment Modes** | One-time, Subscription, Pay-Per-Use |
| **Merchant Dashboard** | Overview, plans, subscribers, analytics, API keys |
| **Payment Links** | Shareable `/pay/:planId` pages to copy and send |
| **On-Chain Settlement** | Direct wallet-to-wallet MUSD transfers without custody |
| **Keeper System** | Permissionless crank to collect recurring payments on-chain |
| **Webhook System** | Merchants register URLs for real-time payment events |
| **Event Listener** | Backend polls Mezo testnet every 10s and syncs DB automatically |
| **REST API** | Full API with API key auth for programmatic integration |
| **SDK Snippet** | 3-line JS integration for any website |

---

## 🏗️ Architecture

```
mezopay/
├── contracts/                    # Solidity (Foundry + OpenZeppelin)
│   ├── src/
│   │   ├── MezoPayRegistry.sol   # On-chain merchant registration
│   │   ├── MezoPayPlans.sol      # Payment plan management
│   │   └── MezoPayProcessor.sol  # Core payment engine
│   ├── test/
│   │   └── MezoPayProcessor.t.sol
│   └── script/Deploy.s.sol
│
├── backend/                      # Node.js + Express + SQLite
│   └── src/
│       ├── server.js             # Express app
│       ├── db.js                 # SQLite schema
│       ├── routes/
│       │   ├── merchants.js      # Registration + API keys
│       │   ├── plans.js          # Plan CRUD
│       │   ├── payments.js       # Payment intents + confirmation
│       │   ├── keeper.js         # Recurring payment trigger ⚡
│       │   └── webhooks.js       # Webhook management
│       └── services/
│           └── eventListener.js  # On-chain event poller
│
└── frontend/                     # React 18 + Vite + wagmi v2
    └── src/
        ├── pages/
        │   ├── Landing.jsx        # Dark premium landing page
        │   ├── Dashboard.jsx      # Merchant dashboard (6 tabs)
        │   └── PaymentPage.jsx    # Customer-facing payment UI
        ├── components/Layout.jsx  # Header, Sidebar, UI atoms
        ├── hooks/
        │   ├── useContracts.js    # Contract write hooks
        │   └── useMUSDBalance.js  # MUSD balance + allowance
        └── config/contracts.js    # ABIs + addresses
```

---

## 📋 Smart Contract Architecture

```
User (customer)
    │
    ├─▶ approveMUSD(processorAddress, amount)     [ERC-20 approve]
    │
    └─▶ MezoPayProcessor.subscribe(planId)
            │
            ├─▶ reads plan from MezoPayPlans
            ├─▶ transfers MUSD: customer → merchant (direct!)
            ├─▶ creates Subscription record on-chain
            └─▶ emits PaymentProcessed event
                    │
                    └─▶ Backend EventListener picks up event
                            ├─▶ Records in SQLite
                            └─▶ Fires merchant webhook
```

**Security:**
- `ReentrancyGuard` on all payment functions
- `SafeERC20` for all token transfers  
- Unique `paymentId` per transaction (replay protection)
- Only subscriber can cancel their own subscription
- Only merchant can deactivate their own plans

---

## 📍 Deployed Contracts (Mezo Testnet)

| Contract | Address |
|----------|---------|
| **MUSD Token** | `0x637e22A1EBbca50EA2d34027c238317fD10003eB` |
| **MezoPayRegistry** | `0xD61f2bA80E486B8CE30428ABFa8B1AD7FdC2Ec2C` |
| **MezoPayPlans** | `0x4Acb793Ba5C8da6189fE4b0C737D04de4175F4ce` |
| **MezoPayProcessor** | `0x0bA5B5eF1dF0F711535b6B63D2E2bED59C1C9fD2` |

**Explorer:** https://explorer.test.mezo.org  
**Chain ID:** 31611 · **RPC:** https://rpc.test.mezo.org

---

## ⚡ The Keeper System (Recurring Payments)

The `processPayment(subscriber, planId)` function is **permissionless** and can be called by anyone when a subscription is due. This follows the "keeper" pattern used across DeFi (such as Chainlink Keepers or Gelato Network).

```
Timer expires → subscription is "due"
    │
    └─▶ Anyone calls MezoPayProcessor.processPayment(subscriber, planId)
            │
            ├─▶ Validates: subscription active + timestamp >= nextPaymentDue
            ├─▶ Transfers MUSD: subscriber → merchant
            └─▶ Updates nextPaymentDue += billingInterval
```

The MezoPay backend includes a **Keeper API** (`/api/keeper/due`, `/api/keeper/process`) that:
1. Scans all active on-chain subscriptions for due payments
2. Shows them in the merchant's "Keeper ⚡" dashboard tab
3. Lets the merchant trigger collection with one click

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- MetaMask with Mezo Testnet configured (Chain ID: 31611)
- Test BTC from https://faucet.test.mezo.org (for gas)
- Test MUSD (available after getting BTC from faucet)

### 1. Smart Contracts

```bash
cd contracts

# Install dependencies
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-commit

# Run tests
forge test -vvv

# Deploy to Mezo Testnet (already deployed — use addresses above)
export PRIVATE_KEY=your_private_key
forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # Fill in contract addresses
npm run dev
# API running at http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App running at http://localhost:5173
```

---

## 🔌 REST API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/merchants/register` | None | Register merchant to get API key |
| `GET` | `/api/merchants/wallet/:wallet` | None | Get merchant by wallet |
| `POST` | `/api/plans` | API Key | Create payment plan |
| `GET` | `/api/plans/:planId` | None | Get plan (public) |
| `GET` | `/api/plans/merchant/:merchantId` | None | List merchant's plans |
| `POST` | `/api/payments/create` | None | Create payment intent |
| `GET` | `/api/payments/:paymentId` | None | Check payment status |
| `GET` | `/api/payments/merchant/all` | API Key | All payments for merchant |
| `GET` | `/api/payments/stats/:merchantId` | None | Revenue analytics |
| `GET` | `/api/keeper/due` | None | List on-chain due payments |
| `POST` | `/api/keeper/process` | API Key | Trigger recurring payment |
| `POST` | `/api/webhooks/register` | API Key | Register webhook URL |
| `GET` | `/api/health` | None | Health check |

---

## 💻 SDK Integration (3 lines)

```html
<script src="https://cdn.mezopay.io/v1/mezopay.js"></script>
<script>
  const mezopay = new MezoPay({ apiKey: 'mpk_live_your_key' });
  mezopay.createPaymentButton({
    planId: 'your_plan_id',
    container: '#pay-button',
    onSuccess: (tx) => console.log('Paid!', tx.hash),
  });
</script>
<div id="pay-button"></div>
```

---

## 🔔 Webhooks

Merchants register a webhook URL and receive real-time POST events:

```json
// payment.confirmed
{
  "event": "payment.confirmed",
  "data": {
    "paymentId": "0xabc...",
    "planId": 3,
    "subscriber": "0x123...",
    "amount": "29.99",
    "txHash": "0xdef..."
  }
}

// subscription.created
// subscription.cancelled
```

---

## 🎯 Use Cases This Enables

- **SaaS products**: monthly subscription billing in MUSD
- **Creator platforms**: paid newsletters, exclusive content
- **Gaming**: in-game purchases, tournament entry fees
- **APIs and compute**: pay-per-call metered billing
- **E-commerce**: one-time product purchases
- **Remittances**: stable cross-border payments
- **AI agents**: autonomous MUSD payments for services

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin |
| Backend | Node.js 18, Express, SQLite (better-sqlite3), ethers v6 |
| Frontend | React 18, Vite, wagmi v2, viem v2.x |
| Wallet | Mezo Passport (@mezo-org/passport) + MetaMask |
| Network | Mezo L2 (Bitcoin EVM) · Chain ID 31611/31612 |
| Currency | MUSD (18 decimals, Bitcoin-backed stablecoin) |
| Indexing | Stateless `queryFilter` polling (no Goldsky needed) |

---

## ⚠️ Important Constraints

- **viem must be v2.x**: viem v3 breaks Mezo Passport
- BTC has 18 decimals on Mezo (used for gas only)
- MUSD has 18 decimals, meaning all amounts are in wei internally
- All payments are direct wallet-to-wallet transfers
- MezoPay contracts never hold user funds (non-custodial)
- Keeper gas is paid by whoever calls `processPayment()` in BTC

---

## 🗺️ Roadmap (Post-Hackathon)

- [ ] **Mainnet deployment** with audited contracts
- [ ] **Hosted SDK CDN** (`cdn.mezopay.io`)
- [ ] **No-code payment page builder** (custom branding)
- [ ] **Automated keeper bot** (Gelato/Chainlink automation)
- [ ] **Multi-token support** (tBTC, other Mezo tokens)
- [ ] **Invoice generation** (PDF with on-chain proof)
- [ ] **Accounting exports** (CSV, QuickBooks integration)
- [ ] **Fiat off-ramp integration** (MUSD to bank)

---

## 📄 License

MIT License. Built for the Mezo Hackathon, Supernormal dApps Track.
