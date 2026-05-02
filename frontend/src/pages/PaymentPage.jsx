import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther } from "viem";
import toast from "react-hot-toast";
import { useContracts } from "../hooks/useContracts";
import { useMUSDBalance, useMUSDAllowance } from "../hooks/useMUSDBalance";
import { getContracts, getExplorerUrl, PLAN_TYPES, BILLING_INTERVALS, ACTIVE_NETWORK } from "../config/contracts";

const API_BASE = "/api";

export default function PaymentPage() {
  const { planId } = useParams();
  const { address, isConnected } = useAccount();
  const { approveMUSD, subscribe, cancelSubscription, contracts } = useContracts();
  const { balance, balanceRaw } = useMUSDBalance(address);
  const { allowance, refetch: refetchAllowance } = useMUSDAllowance(address, contracts.processor);

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("idle"); // idle, approving, subscribing, success, error
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  async function fetchPlan() {
    try {
      const res = await fetch(`${API_BASE}/plans/${planId}`);
      if (res.ok) {
        setPlan(await res.json());
      } else {
        setError("Plan not found.");
      }
    } catch (err) {
      setError("Could not load plan. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  function getIntervalLabel(seconds) {
    const entry = Object.entries(BILLING_INTERVALS).find(([, v]) => v === seconds);
    return entry ? entry[0] : `${seconds}s`;
  }

  function needsApproval() {
    if (!plan) return false;
    const priceWei = parseEther(plan.price.toString());
    return allowance < priceWei;
  }

  async function handleApprove() {
    setStep("approving");
    try {
      const priceWei = parseEther(plan.price.toString());
      // Approve a large amount so user doesn't need to re-approve for recurring
      const approveAmount = priceWei * 1000n;
      const hash = await approveMUSD(contracts.processor, approveAmount);
      setTxHash(hash);
      toast.success("MUSD approved! Now you can pay.");
      await refetchAllowance();
      setStep("idle");
    } catch (err) {
      console.error("Approve error:", err);
      toast.error("Approval failed. " + (err.shortMessage || err.message));
      setStep("idle");
    }
  }

  async function handleSubscribe() {
    setStep("subscribing");
    try {
      const hash = await subscribe(planId);
      setTxHash(hash);


      setStep("success");
      toast.success("Payment successful!");
    } catch (err) {
      console.error("Subscribe error:", err);
      toast.error("Payment failed. " + (err.shortMessage || err.message));
      setStep("error");
      setError(err.shortMessage || err.message);
    }
  }

  async function handleCancel() {
    try {
      const hash = await cancelSubscription(planId);
      toast.success("Subscription cancelled.");
    } catch (err) {
      toast.error("Failed to cancel. " + (err.shortMessage || err.message));
    }
  }

  // ─── Loading / Error States ────────────────────────────

  if (loading) {
    return (
      <div className="payment-page">
        <div className="payment-card">
          <div style={{ padding: "var(--space-12)", textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto" }} />
            <p className="text-secondary" style={{ marginTop: "var(--space-4)" }}>Loading payment details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="payment-page">
        <div className="payment-card">
          <div style={{ padding: "var(--space-12)", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>😕</div>
            <h2 style={{ marginBottom: "var(--space-2)" }}>Plan not found</h2>
            <p className="text-secondary">{error}</p>
            <Link to="/" className="btn btn-secondary" style={{ marginTop: "var(--space-6)" }}>
              ← Back to MezoPay
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Success State ─────────────────────────────────────

  if (step === "success") {
    return (
      <div className="payment-page">
        <div className="payment-card animate-slide-up">
          <div className="payment-success">
            <div className="payment-success-icon">✓</div>
            <h2>Payment Confirmed!</h2>
            <p>Your payment has been successfully processed on-chain.</p>

            {txHash && (
              <div className="tx-hash" style={{ marginTop: "var(--space-6)" }}>
                <span>Tx:</span>
                <a
                  href={getExplorerUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-primary)" }}
                >
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              </div>
            )}

            <div className="flex flex-col gap-3" style={{ marginTop: "var(--space-8)" }}>
              <Link to="/" className="btn btn-secondary" style={{ width: "100%" }}>
                ← Back to MezoPay
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Payment Form ──────────────────────────────────────

  const hasSufficientBalance = balanceRaw >= parseEther(plan.price.toString());

  return (
    <div className="payment-page">
      <div className="payment-card">
        {/* Header */}
        <div className="payment-card-header">
          <div className="payment-merchant-name">
            <span>{plan.merchant_name}</span>
            <span className="verified">✓</span>
          </div>
          <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
            {plan.name}
          </div>
          <div className="payment-amount">
            {plan.price}
            <span className="currency"> MUSD</span>
          </div>
          <span className={`badge ${plan.plan_type === "ONE_TIME" ? "badge-info" : plan.plan_type === "SUBSCRIPTION" ? "badge-primary" : "badge-warning"}`}>
            {plan.plan_type?.replace("_", " ")}
            {plan.plan_type !== "ONE_TIME" && plan.billing_interval > 0 && ` · ${getIntervalLabel(plan.billing_interval)}`}
          </span>
        </div>

        {/* Body */}
        <div className="payment-card-body">
          <div className="payment-detail">
            <span className="payment-detail-label">Network</span>
            <span className={`network-badge ${ACTIVE_NETWORK}`}>
              <span className="dot" />
              Mezo {ACTIVE_NETWORK === "testnet" ? "Testnet" : "Mainnet"}
            </span>
          </div>
          <div className="payment-detail">
            <span className="payment-detail-label">Currency</span>
            <span className="payment-detail-value">MUSD (Mezo USD)</span>
          </div>
          {plan.plan_type !== "ONE_TIME" && (
            <div className="payment-detail">
              <span className="payment-detail-label">Billing</span>
              <span className="payment-detail-value">
                Every {getIntervalLabel(plan.billing_interval)}
              </span>
            </div>
          )}

          {isConnected && (
            <>
              <div className="payment-detail" style={{ borderTop: "1px solid var(--color-border)", marginTop: "var(--space-2)", paddingTop: "var(--space-4)" }}>
                <span className="payment-detail-label">Your MUSD Balance</span>
                <span
                  className="payment-detail-value"
                  style={{ color: hasSufficientBalance ? "var(--color-success)" : "var(--color-error)" }}
                >
                  {parseFloat(balance).toFixed(4)} MUSD
                </span>
              </div>

              {!hasSufficientBalance && (
                <div
                  style={{
                    marginTop: "var(--space-3)",
                    padding: "var(--space-3)",
                    background: "var(--color-error-bg)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-error)",
                    textAlign: "center",
                  }}
                >
                  Insufficient MUSD balance. You need {plan.price} MUSD.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer / Action */}
        <div className="payment-card-footer">
          {!isConnected ? (
            <div style={{ width: "100%" }}>
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button
                    id="connect-wallet-btn"
                    className="btn btn-primary btn-lg"
                    onClick={openConnectModal}
                    style={{ width: "100%" }}
                  >
                    Connect Wallet to Pay
                  </button>
                )}
              </ConnectButton.Custom>
            </div>
          ) : needsApproval() ? (
            <button
              id="approve-musd-btn"
              className="btn btn-secondary btn-lg"
              onClick={handleApprove}
              disabled={step === "approving" || !hasSufficientBalance}
              style={{ width: "100%" }}
            >
              {step === "approving" ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  Approving MUSD...
                </>
              ) : (
                "Step 1: Approve MUSD"
              )}
            </button>
          ) : (
            <button
              id="pay-now-btn"
              className="btn btn-primary btn-lg"
              onClick={handleSubscribe}
              disabled={step === "subscribing" || !hasSufficientBalance}
              style={{ width: "100%" }}
            >
              {step === "subscribing" ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  Processing Payment...
                </>
              ) : (
                `Pay ${plan.price} MUSD`
              )}
            </button>
          )}
        </div>

        {/* Powered by */}
        <div
          className="text-center text-xs text-tertiary"
          style={{ padding: "var(--space-4)", borderTop: "1px solid var(--color-border)" }}
        >
          Powered by <Link to="/" style={{ fontWeight: 600 }}>MezoPay</Link> on <strong>Mezo</strong>
        </div>
      </div>
    </div>
  );
}
