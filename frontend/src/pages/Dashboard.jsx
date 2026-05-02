import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAccount, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import toast from "react-hot-toast";
import { parseEther, formatEther, decodeEventLog, parseAbi } from "viem";
import { Header, Sidebar, StatCard, CodeSnippet, EmptyState } from "../components/Layout";
import { CreatePlanModal } from "../components/CreatePlanModal";
import { useContracts } from "../hooks/useContracts";
import { useMUSDBalance } from "../hooks/useMUSDBalance";
import { PLAN_TYPES, BILLING_INTERVALS, getExplorerUrl, ACTIVE_NETWORK } from "../config/contracts";

const API_BASE = "/api";

const SDK_CODE = `<!-- Add MezoPay to your website -->
<script src="https://cdn.mezopay.io/v1/mezopay.js"></script>
<script>
  const mezopay = new MezoPay({
    apiKey: 'YOUR_API_KEY',
    network: '${ACTIVE_NETWORK}'
  });

  // Create a payment button
  mezopay.createPaymentButton({
    planId: 'PLAN_ID',
    container: '#mezopay-button',
    theme: 'light',
    onSuccess: (payment) => {
      console.log('Payment confirmed!', payment.txHash);
      // Redirect user or update UI
    },
    onError: (error) => {
      console.error('Payment failed:', error.message);
    }
  });
</script>

<div id="mezopay-button"></div>`;

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();

  if (!isConnected) {
    return (
      <div className="page">
        <Header />
        <div className="flex items-center justify-center" style={{ minHeight: "80vh" }}>
          <div className="text-center">
            <h2 style={{ marginBottom: "var(--space-4)" }}>Connect your wallet</h2>
            <p className="text-secondary" style={{ marginBottom: "var(--space-6)" }}>
              Connect your wallet to access the merchant dashboard.
            </p>
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-content">
          <Routes>
            <Route index element={<OverviewTab address={address} />} />
            <Route path="plans" element={<PlansTab address={address} />} />
            <Route path="subscribers" element={<SubscribersTab address={address} />} />
            <Route path="keeper" element={<KeeperTab address={address} />} />
            <Route path="api" element={<ApiTab address={address} />} />
            <Route path="settings" element={<SettingsTab address={address} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Overview Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function OverviewTab({ address }) {
  const { balance } = useMUSDBalance(address);
  const [merchant, setMerchant] = useState(null);
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (address) {
      fetchMerchantData();
    }
  }, [address]);

  async function fetchMerchantData() {
    try {
      const res = await fetch(`${API_BASE}/merchants/wallet/${address}`);
      if (res.ok) {
        const data = await res.json();
        setMerchant(data);

        // Fetch plans
        const plansRes = await fetch(`${API_BASE}/plans/merchant/${data.id}`);
        if (plansRes.ok) setPlans(await plansRes.json());

        // Fetch stats
        const statsRes = await fetch(`${API_BASE}/payments/stats/${data.id}`);
        if (statsRes.ok) setStats(await statsRes.json());
      }
    } catch (err) {
      // Merchant not registered yet, which is fine
    }
  }

  if (!merchant) {
    return <RegisterMerchantView address={address} onRegistered={fetchMerchantData} />;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-8)" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)" }}>Welcome back, {merchant.name}</h1>
          <p className="text-secondary">Here's an overview of your payment activity.</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: "var(--space-8)" }}>
        <StatCard
          icon="💰"
          value={`${parseFloat(balance).toFixed(2)}`}
          label="MUSD Balance"
          color="var(--color-success-bg)"
        />
        <StatCard
          icon="📋"
          value={plans.length}
          label="Active Plans"
          color="var(--color-info-bg)"
        />
        <StatCard
          icon="👥"
          value={stats?.active_subscriptions || 0}
          label="Active Subscribers"
          color="var(--color-primary-light)"
        />
        <StatCard
          icon="✅"
          value={stats?.confirmed_payments || 0}
          label="Total Payments"
          color="var(--color-warning-bg)"
        />
      </div>

      {/* Total Volume */}
      {stats?.total_volume > 0 && (
        <div className="card" style={{ marginBottom: "var(--space-6)", background: "var(--color-success-bg)", border: "1px solid rgba(36,180,126,0.2)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: "var(--color-success)", fontWeight: 600, marginBottom: 4 }}>Total Revenue Collected</p>
              <div className="revenue-highlight">{parseFloat(stats.total_volume).toFixed(2)} MUSD</div>
            </div>
            <span style={{ fontSize: 40 }}>💸</span>
          </div>
        </div>
      )}

      {/* Recent Plans */}
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
          <h3>Your Plans</h3>
        </div>
        {plans.length === 0 ? (
          <p className="text-secondary text-sm">No plans yet. Create one from the Plans tab.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Payment Link</th>
                </tr>
              </thead>
              <tbody>
                {plans.slice(0, 5).map((plan) => (
                  <tr key={plan.id}>
                    <td style={{ fontWeight: 500 }}>{plan.name}</td>
                    <td>
                      <span className={`badge ${plan.plan_type === "ONE_TIME" ? "badge-info" : plan.plan_type === "SUBSCRIPTION" ? "badge-primary" : "badge-warning"}`}>
                        {plan.plan_type.replace("_", " ")}
                      </span>
                    </td>
                    <td>{plan.price} MUSD</td>
                    <td>
                      <span className={`badge ${plan.active ? "badge-success" : "badge-error"}`}>
                        {plan.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/pay/${plan.id}`);
                          toast.success("Payment link copied!");
                        }}
                      >
                        📋 Copy Link
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Register Merchant View
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function RegisterMerchantView({ address, onRegistered }) {
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(null);

  async function handleRegister(e) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/merchants/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, name, webhookUrl }),
      });

      const data = await res.json();

      if (res.ok) {
        setApiKey(data.apiKey);
        toast.success("Merchant registered successfully!");
        setTimeout(() => onRegistered(), 2000);
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch (err) {
      toast.error("Network error. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }

  if (apiKey) {
    return (
      <div className="animate-slide-up" style={{ maxWidth: 520, margin: "0 auto", paddingTop: "var(--space-16)" }}>
        <div className="card card-elevated text-center">
          <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>🎉</div>
          <h2 style={{ marginBottom: "var(--space-2)" }}>You're registered!</h2>
          <p className="text-secondary" style={{ marginBottom: "var(--space-6)" }}>
            Save your API key securely. It won't be shown again.
          </p>
          <div className="code-block" style={{ textAlign: "left", wordBreak: "break-all" }}>
            <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(apiKey); toast.success("Copied!"); }}>
              Copy
            </button>
            <code>{apiKey}</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 520, margin: "0 auto", paddingTop: "var(--space-16)" }}>
      <div className="text-center" style={{ marginBottom: "var(--space-8)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)" }}>Register as a Merchant</h1>
        <p className="text-secondary">Set up your business to start accepting MUSD payments.</p>
      </div>

      <div className="card card-elevated">
        <form onSubmit={handleRegister} className="flex flex-col gap-6">
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input
              id="merchant-name-input"
              className="form-input"
              type="text"
              placeholder="e.g. Acme Inc."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Webhook URL (optional)</label>
            <input
              id="merchant-webhook-input"
              className="form-input"
              type="url"
              placeholder="https://yoursite.com/webhooks/mezopay"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <span className="text-xs text-tertiary">
              We'll POST payment events to this URL.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Wallet Address</label>
            <input
              className="form-input"
              type="text"
              value={address}
              disabled
              style={{ background: "var(--color-surface)", color: "var(--color-text-secondary)" }}
            />
            <span className="text-xs text-tertiary">
              MUSD payments will be sent directly to this address.
            </span>
          </div>

          <button
            id="register-merchant-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isLoading || !name}
            style={{ width: "100%" }}
          >
            {isLoading ? "Registering..." : "Register Merchant"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Plans Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PlansTab({ address }) {
  const [showModal, setShowModal] = useState(false);
  const [plans, setPlans] = useState([]);
  const [merchant, setMerchant] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [address]);

  async function fetchData() {
    try {
      const merchantRes = await fetch(`${API_BASE}/merchants/wallet/${address}`);
      if (merchantRes.ok) {
        const m = await merchantRes.json();
        setMerchant(m);
        const plansRes = await fetch(`${API_BASE}/plans/merchant/${m.id}`);
        if (plansRes.ok) setPlans(await plansRes.json());
      }
    } catch (err) {}
  }

  async function handleCreatePlan(form) {
    if (!merchant) return;
    setIsCreating(true);

    const typeMapping = {
      0: "ONE_TIME",
      1: "SUBSCRIPTION",
      2: "PAY_PER_USE"
    };

    try {
      const res = await fetch(`${API_BASE}/plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": merchant.api_key,
        },
        body: JSON.stringify({
          name: form.name,
          price: form.price,
          planType: typeMapping[form.planType],
          billingInterval: form.planType === 0 ? 0 : form.billingInterval,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Plan "${form.name}" created!`);
        setShowModal(false);
        fetchData();
      } else {
        toast.error(data.error || "Failed to create plan");
      }
    } catch (err) {
      toast.error("Network error.");
    } finally {
      setIsCreating(false);
    }
  }

  function getIntervalLabel(seconds) {
    const entry = Object.entries(BILLING_INTERVALS).find(([, v]) => v === seconds);
    return entry ? entry[0] : `${seconds}s`;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontSize: "var(--font-size-2xl)" }}>Payment Plans</h1>
          <p className="text-secondary">Create and manage your payment plans.</p>
        </div>
        <button
          id="create-plan-btn"
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          + Create Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No plans yet"
          description="Create your first payment plan to start accepting MUSD payments."
          action={
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              + Create Your First Plan
            </button>
          }
        />
      ) : (
        <div className="grid grid-2">
          {plans.map((plan) => (
            <div key={plan.id} className="plan-card animate-fade-in">
              <div className="flex items-center justify-between">
                <span className={`badge ${plan.plan_type === "ONE_TIME" ? "badge-info" : plan.plan_type === "SUBSCRIPTION" ? "badge-primary" : "badge-warning"}`}>
                  {plan.plan_type.replace("_", " ")}
                </span>
                <span className={`badge ${plan.active ? "badge-success" : "badge-error"}`}>
                  {plan.active ? "Active" : "Inactive"}
                </span>
              </div>

              <h3 style={{ margin: "var(--space-3) 0 0" }}>{plan.name}</h3>

              <div className="plan-card-price">
                {plan.price}
                <span className="currency"> MUSD</span>
                {plan.plan_type !== "ONE_TIME" && (
                  <span className="interval"> / {getIntervalLabel(plan.billing_interval)}</span>
                )}
              </div>

              <div className="flex gap-2" style={{ marginTop: "var(--space-4)" }}>
                <button
                  className="btn btn-secondary btn-sm flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/pay/${plan.id}`);
                    toast.success("Payment link copied!");
                  }}
                >
                  📋 Copy Link
                </button>
                <a
                  href={`/pay/${plan.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  ↗ Preview
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CreatePlanModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreatePlan}
          isLoading={isCreating}
        />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Subscribers Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SubscribersTab({ address }) {
  const [payments, setPayments] = useState([]);
  const [merchant, setMerchant] = useState(null);

  useEffect(() => {
    fetchData();
  }, [address]);

  async function fetchData() {
    try {
      const merchantRes = await fetch(`${API_BASE}/merchants/wallet/${address}`);
      if (merchantRes.ok) {
        const m = await merchantRes.json();
        setMerchant(m);

        const paymentsRes = await fetch(`${API_BASE}/payments/merchant/all`, {
          headers: { "X-API-Key": m.api_key },
        });
        if (paymentsRes.ok) setPayments(await paymentsRes.json());
      }
    } catch (err) {}
  }

  function truncateAddr(addr) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)" }}>Subscribers & Payments</h1>
        <p className="text-secondary">View all payment activity and subscribers.</p>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No payments yet"
          description="Payments will appear here once customers start using your payment links."
        />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Payer</th>
                <th>Plan</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Tx</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "var(--font-size-xs)" }}>
                    {truncateAddr(payment.payer)}
                  </td>
                  <td style={{ fontWeight: 500 }}>{payment.plan_name}</td>
                  <td>
                    <span className="badge badge-neutral">{payment.plan_type?.replace("_", " ")}</span>
                  </td>
                  <td>{payment.amount} MUSD</td>
                  <td>
                    <span className={`badge ${payment.status === "confirmed" ? "badge-success" : payment.status === "failed" ? "badge-error" : "badge-warning"}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td>
                    {payment.tx_hash ? (
                      <a
                        href={getExplorerUrl(payment.tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm"
                      >
                        {truncateAddr(payment.tx_hash)}
                      </a>
                    ) : (
                      <span className="text-tertiary">None</span>
                    )}
                  </td>
                  <td className="text-sm text-secondary">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ApiTab({ address }) {
  const [merchant, setMerchant] = useState(null);

  useEffect(() => {
    fetchMerchant();
  }, [address]);

  async function fetchMerchant() {
    try {
      const res = await fetch(`${API_BASE}/merchants/wallet/${address}`);
      if (res.ok) setMerchant(await res.json());
    } catch (err) {}
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)" }}>API & SDK</h1>
        <p className="text-secondary">Integrate MezoPay into your website or application.</p>
      </div>

      {merchant?.api_key && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <h3 style={{ marginBottom: "var(--space-3)" }}>Your API Key</h3>
          <div className="flex items-center gap-3">
            <code
              style={{
                flex: 1,
                padding: "10px 14px",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-size-sm)",
                fontFamily: "monospace",
                wordBreak: "break-all",
              }}
            >
              {merchant.api_key}
            </code>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(merchant.api_key);
                toast.success("API key copied!");
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <h3 style={{ marginBottom: "var(--space-3)" }}>REST API Endpoints</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Auth</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><span className="badge badge-success">POST</span></td><td><code>/api/merchants/register</code></td><td>None</td><td>Register merchant</td></tr>
              <tr><td><span className="badge badge-success">POST</span></td><td><code>/api/plans</code></td><td>API Key</td><td>Create plan</td></tr>
              <tr><td><span className="badge badge-info">GET</span></td><td><code>/api/plans/:planId</code></td><td>None</td><td>Get plan details</td></tr>
              <tr><td><span className="badge badge-success">POST</span></td><td><code>/api/payments/create</code></td><td>None</td><td>Create payment intent</td></tr>
              <tr><td><span className="badge badge-info">GET</span></td><td><code>/api/payments/:paymentId</code></td><td>None</td><td>Check payment status</td></tr>
              <tr><td><span className="badge badge-success">POST</span></td><td><code>/api/webhooks/register</code></td><td>API Key</td><td>Register webhook URL</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: "var(--space-3)" }}>Integration Snippet</h3>
        <p className="text-secondary text-sm" style={{ marginBottom: "var(--space-4)" }}>
          Copy this snippet to add a MezoPay payment button to your website.
        </p>
        <CodeSnippet code={SDK_CODE} />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Settings Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SettingsTab({ address }) {
  const [merchant, setMerchant] = useState(null);
  const { balance } = useMUSDBalance(address);

  useEffect(() => {
    fetchMerchant();
  }, [address]);

  async function fetchMerchant() {
    try {
      const res = await fetch(`${API_BASE}/merchants/wallet/${address}`);
      if (res.ok) setMerchant(await res.json());
    } catch (err) {}
  }

  function truncateAddr(addr) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)" }}>Settings</h1>
        <p className="text-secondary">Manage your merchant profile.</p>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <h3 style={{ marginBottom: "var(--space-4)" }}>Merchant Profile</h3>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between" style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" }}>
            <span className="text-secondary">Business Name</span>
            <span style={{ fontWeight: 500 }}>{merchant?.name || "Not Set"}</span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" }}>
            <span className="text-secondary">Wallet</span>
            <span style={{ fontFamily: "monospace", fontSize: "var(--font-size-sm)" }}>
              {truncateAddr(address)}
            </span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" }}>
            <span className="text-secondary">MUSD Balance</span>
            <span style={{ fontWeight: 600, color: "var(--color-success)" }}>
              {parseFloat(balance).toFixed(4)} MUSD
            </span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" }}>
            <span className="text-secondary">Webhook URL</span>
            <span className="text-sm">{merchant?.webhook_url || "Not configured"}</span>
          </div>
          <div className="flex items-center justify-between" style={{ padding: "var(--space-3) 0" }}>
            <span className="text-secondary">Registered</span>
            <span className="text-sm">{merchant?.created_at ? new Date(merchant.created_at).toLocaleDateString() : "Not Set"}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ background: "var(--color-surface)" }}>
        <div className="flex items-center gap-3" style={{ marginBottom: "var(--space-3)" }}>
          <span style={{ fontSize: 24 }}>ℹ️</span>
          <h3>About MezoPay</h3>
        </div>
        <p className="text-secondary text-sm">
          MezoPay is a MUSD payment infrastructure platform built on Mezo.
          All payments are settled directly on-chain via MUSD transfers from your customers' wallets
          to yours. No custodial accounts, no intermediaries.
        </p>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Keeper Tab - Process recurring payments on-chain
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function KeeperTab({ address }) {
  const [merchant, setMerchant] = useState(null);
  const [duePayments, setDuePayments] = useState([]);
  const [keeperStats, setKeeperStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchMerchant();
    fetchStats();
  }, [address]);

  async function fetchMerchant() {
    try {
      const res = await fetch(`${API_BASE}/merchants/wallet/${address}`);
      if (res.ok) setMerchant(await res.json());
    } catch (_) {}
  }

  async function fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/keeper/stats`);
      if (res.ok) setKeeperStats(await res.json());
    } catch (_) {}
  }

  async function checkDuePayments() {
    setIsChecking(true);
    try {
      const res = await fetch(`${API_BASE}/keeper/due`);
      if (res.ok) {
        const data = await res.json();
        setDuePayments(data.due || []);
        if (data.count === 0) toast.success("No payments due right now.");
        else toast(`Found ${data.count} payment(s) due!`, { icon: "⚡" });
      }
    } catch (_) {
      toast.error("Could not check due payments. Is the backend running?");
    } finally {
      setIsChecking(false);
    }
  }

  async function processPayment(subscriber, planId) {
    if (!merchant) return;
    const key = `${subscriber}-${planId}`;
    setProcessingId(key);
    try {
      const res = await fetch(`${API_BASE}/keeper/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": merchant.api_key,
        },
        body: JSON.stringify({ subscriber, planId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Payment collected! Tx: ${data.txHash?.slice(0, 10)}...`);
        setDuePayments((prev) => prev.filter((p) => !(p.subscriber === subscriber && p.planId === planId)));
      } else {
        toast.error(data.error || "Failed to process payment.");
      }
    } catch (_) {
      toast.error("Network error.");
    } finally {
      setProcessingId(null);
    }
  }

  function truncateAddr(addr) {
    if (!addr) return "";
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)" }}>⚡ Keeper - Recurring Payments</h1>
        <p className="text-secondary">
          Monitor and trigger on-chain recurring payment collection. Anyone can call{" "}
          <code style={{ fontSize: "var(--font-size-xs)", background: "var(--color-surface-2)", padding: "2px 6px", borderRadius: 4 }}>
            processPayment()
          </code>{" "}
          when a subscription is due.
        </p>
      </div>

      {/* Stats row */}
      {keeperStats && (
        <div className="grid grid-3" style={{ marginBottom: "var(--space-6)" }}>
          <StatCard icon="📊" value={keeperStats.total} label="Total Subscriptions" color="var(--color-primary-light)" />
          <StatCard icon="✅" value={keeperStats.active} label="Active Subscriptions" color="var(--color-success-bg)" />
          <StatCard icon="❌" value={keeperStats.cancelled} label="Cancelled" color="var(--color-error-bg)" />
        </div>
      )}

      {/* How it works info box */}
      <div className="keeper-section" style={{ marginBottom: "var(--space-6)" }}>
        <div className="keeper-header">
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <h3>How Keeper Works</h3>
          <span className="keeper-badge">Permissionless</span>
        </div>
        <p className="text-secondary text-sm" style={{ lineHeight: 1.7 }}>
          The MezoPayProcessor contract enforces billing intervals on-chain. When a subscription is due,{" "}
          <strong>anyone</strong> can call <code>processPayment(subscriber, planId)</code> to collect the MUSD.
          This follows the "keeper" pattern: a permissionless crank that anyone (or an automated bot) can run.
          The keeper backend uses your wallet to pay the BTC gas fee and trigger the on-chain collection.
        </p>
      </div>

      {/* Check & process */}
      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-4)" }}>
          <h3>Due Payments</h3>
          <button
            id="check-due-btn"
            className="btn btn-secondary"
            onClick={checkDuePayments}
            disabled={isChecking}
          >
            {isChecking ? (
              <><span className="spinner" style={{ width: 14, height: 14 }} /> Checking on-chain...</>
            ) : (
              "🔍 Check Due Payments"
            )}
          </button>
        </div>

        {duePayments.length === 0 ? (
          <div className="empty-state" style={{ padding: "var(--space-8)" }}>
            <div className="empty-state-icon">⚡</div>
            <h3>No due payments found</h3>
            <p>Click "Check Due Payments" to scan the contract for subscriptions that need collection.</p>
          </div>
        ) : (
          <div>
            {duePayments.map((p) => {
              const key = `${p.subscriber}-${p.planId}`;
              return (
                <div key={key} className="keeper-row">
                  <div className="keeper-sub-info">
                    <div className="keeper-sub-addr">{truncateAddr(p.subscriber)}</div>
                    <div className="keeper-sub-amount">{p.priceInMUSD} MUSD · Plan #{p.planId}</div>
                  </div>
                  <span className="keeper-due-tag">DUE NOW</span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => processPayment(p.subscriber, p.planId)}
                    disabled={processingId === key}
                  >
                    {processingId === key ? (
                      <><span className="spinner" style={{ width: 12, height: 12 }} /> Processing...</>
                    ) : (
                      "Collect Payment"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contract info */}
      <div className="card" style={{ background: "var(--color-surface)" }}>
        <h3 style={{ marginBottom: "var(--space-3)" }}>On-Chain Contract</h3>
        <div className="flex items-center gap-3">
          <code style={{ flex: 1, padding: "10px 14px", background: "var(--color-bg)", borderRadius: "var(--radius-md)", fontSize: "var(--font-size-xs)", fontFamily: "monospace", wordBreak: "break-all" }}>
            MezoPayProcessor: 0x0bA5B5eF1dF0F711535b6B63D2E2bED59C1C9fD2
          </code>
          <a
            href="https://explorer.test.mezo.org/address/0x0bA5B5eF1dF0F711535b6B63D2E2bED59C1C9fD2"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            ↗ Explorer
          </a>
        </div>
      </div>
    </div>
  );
}
