import { useState } from "react";
import { PLAN_TYPES, BILLING_INTERVALS } from "../config/contracts";

export function CreatePlanModal({ onClose, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    name: "",
    price: "",
    planType: 0,
    billingInterval: 2592000,
  });

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Payment Plan</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body flex flex-col gap-6">
            <div className="form-group">
              <label className="form-label">Plan Name</label>
              <input
                id="plan-name-input"
                className="form-input"
                type="text"
                placeholder="e.g. Monthly Pro, API Access, Premium"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Price (MUSD)</label>
              <input
                id="plan-price-input"
                className="form-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="10.00"
                value={form.price}
                onChange={(e) => handleChange("price", e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Type</label>
              <select
                id="plan-type-select"
                className="form-select"
                value={form.planType}
                onChange={(e) => handleChange("planType", parseInt(e.target.value))}
              >
                <option value={0}>One-Time Payment</option>
                <option value={1}>Subscription (Recurring)</option>
                <option value={2}>Pay-Per-Use</option>
              </select>
            </div>

            {form.planType !== 0 && (
              <div className="form-group">
                <label className="form-label">Billing Interval</label>
                <select
                  id="plan-interval-select"
                  className="form-select"
                  value={form.billingInterval}
                  onChange={(e) => handleChange("billingInterval", parseInt(e.target.value))}
                >
                  {Object.entries(BILLING_INTERVALS).map(([label, seconds]) => (
                    <option key={seconds} value={seconds}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview */}
            <div className="card" style={{ background: "var(--color-surface)" }}>
              <div className="text-sm text-secondary" style={{ marginBottom: "var(--space-2)" }}>
                Preview
              </div>
              <div style={{ fontWeight: 700, fontSize: "var(--font-size-2xl)" }}>
                {form.price || "0"} <span style={{ color: "var(--color-text-secondary)", fontWeight: 400, fontSize: "var(--font-size-base)" }}>MUSD</span>
              </div>
              <div className="flex items-center gap-2" style={{ marginTop: "var(--space-2)" }}>
                <span className={`badge ${form.planType === 0 ? "badge-info" : form.planType === 1 ? "badge-primary" : "badge-warning"}`}>
                  {PLAN_TYPES[form.planType]}
                </span>
                {form.planType !== 0 && (
                  <span className="badge badge-neutral">
                    Every {Object.entries(BILLING_INTERVALS).find(([, v]) => v === form.billingInterval)?.[0]}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              id="create-plan-submit"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !form.name || !form.price}
            >
              {isLoading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  Creating...
                </>
              ) : (
                "Create Plan"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
