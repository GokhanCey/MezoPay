import { Link } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Header, CodeSnippet } from "../components/Layout";

const SDK_SNIPPET = `// Accept MUSD in 3 lines
import { MezoPay } from '@mezopay/sdk';

const pay = new MezoPay({ apiKey: 'mpk_live_...' });
pay.createButton('#checkout', {
  planId: 'plan_monthly_pro',
  onSuccess: (tx) => console.log('Paid!', tx.hash)
});`;

export default function Landing() {
  const { isConnected } = useAccount();

  return (
    <div className="landing-page-light">
      <Header />

      {/* ─── HERO ─── */}
      <section className="landing-hero-light">
        <div className="container hero-container-light">
          <div className="hero-content-light">
            <h1 className="hero-title-light">
              MUSD Payment Infrastructure
            </h1>
            <p className="hero-subtitle-light">
              Accept Bitcoin-backed stablecoin payments on Mezo. One-time, recurring, and usage-based billing with instant on-chain settlement.
            </p>
            
            <div className="hero-actions-light">
              {isConnected ? (
                <Link to="/dashboard" className="btn btn-primary btn-lg">
                  Go to Dashboard
                </Link>
              ) : (
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button className="btn btn-primary btn-lg" onClick={openConnectModal}>
                      Start Accepting MUSD
                    </button>
                  )}
                </ConnectButton.Custom>
              )}
              <a href="https://github.com/mezo-org/musd" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-lg">
                View GitHub
              </a>
            </div>
            
            <div className="hero-badges-light">
              <span>✓ Non-custodial</span>
              <span>✓ Direct settlement</span>
              <span>✓ Developer API</span>
            </div>
          </div>
          
          <div className="hero-visual-light">
            <div className="code-window">
              <div className="code-window-header">
                <span className="dot bg-red"></span>
                <span className="dot bg-yellow"></span>
                <span className="dot bg-green"></span>
              </div>
              <CodeSnippet code={SDK_SNIPPET} />
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="features-light">
        <div className="container">
          <div className="features-grid-light">
            <div className="feature-card-light">
              <div className="feature-icon-light">💳</div>
              <h3>Instant Payments</h3>
              <p>Direct MUSD transfers for digital goods and services. Verified instantly on Mezo.</p>
            </div>
            <div className="feature-card-light">
              <div className="feature-icon-light">🔄</div>
              <h3>Recurring Billing</h3>
              <p>Smart contract enforced subscriptions. Decentralized keeper network processes due payments automatically.</p>
            </div>
            <div className="feature-card-light">
              <div className="feature-icon-light">⚡</div>
              <h3>Usage-Based</h3>
              <p>Charge customers based on their exact consumption. Ideal for API gateways and compute resources.</p>
            </div>
            <div className="feature-card-light">
              <div className="feature-icon-light">🛠️</div>
              <h3>Developer First</h3>
              <p>Complete REST API, webhooks for real-time events, and a simple Javascript SDK.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer-light">
        <div className="container">
          <div className="footer-content-light">
            <div className="footer-brand">
              <div className="logo-icon">M</div>
              <strong>MezoPay</strong>
            </div>
            <div className="footer-links-light">
              <a href="https://docs.mezo.org" target="_blank" rel="noopener noreferrer">Mezo Docs</a>
              <a href="https://explorer.test.mezo.org" target="_blank" rel="noopener noreferrer">Explorer</a>
              <a href="https://faucet.test.mezo.org" target="_blank" rel="noopener noreferrer">Faucet</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

