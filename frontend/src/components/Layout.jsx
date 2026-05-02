import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { ACTIVE_NETWORK } from "../config/contracts";

export function Header() {
  const { isConnected } = useAccount();

  return (
    <header className="header">
      <Link to="/" className="header-logo">
        <div className="logo-icon">M</div>
        <span>MezoPay</span>
        <NetworkBadge />
      </Link>

      <div className="header-nav">
        {isConnected && (
          <Link to="/dashboard" className="btn btn-ghost">
            Dashboard
          </Link>
        )}
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus="avatar"
        />
      </div>
    </header>
  );
}

export function NetworkBadge() {
  const isTestnet = ACTIVE_NETWORK === "testnet";

  return (
    <span className={`network-badge ${isTestnet ? "testnet" : "mainnet"}`}>
      <span className="dot" />
      {isTestnet ? "Testnet" : "Mainnet"}
    </span>
  );
}

export function Sidebar() {
  const location = useLocation();
  const path = location.pathname;

  const items = [
    { label: "Overview", path: "/dashboard", icon: "📊" },
    { label: "Plans", path: "/dashboard/plans", icon: "📋" },
    { label: "Subscribers", path: "/dashboard/subscribers", icon: "👥" },
    { label: "Keeper ⚡", path: "/dashboard/keeper", icon: "🔄" },
    { label: "API & SDK", path: "/dashboard/api", icon: "🔗" },
    { label: "Settings", path: "/dashboard/settings", icon: "⚙️" },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-section-title">Menu</div>
      {items.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`sidebar-item ${path === item.path ? "active" : ""}`}
        >
          <span>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function StatCard({ icon, value, label, color = "var(--color-primary-light)" }) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="stat-card-header">
        <div className="stat-card-icon" style={{ background: color }}>
          {icon}
        </div>
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

export function CodeSnippet({ code, language = "javascript" }) {
  function handleCopy() {
    navigator.clipboard.writeText(code);
  }

  return (
    <div className="code-block">
      <button className="copy-btn" onClick={handleCopy}>
        Copy
      </button>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state animate-fade-in">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center" style={{ padding: "var(--space-16)" }}>
      <div className="spinner" />
    </div>
  );
}
