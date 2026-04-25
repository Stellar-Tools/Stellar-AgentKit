import { useState } from "react";
import { useWallet } from "./context/WalletContext";
import PaymentPanel from "./components/PaymentPanel";
import SwapPanel from "./components/SwapPanel";
import LiquidityPanel from "./components/LiquidityPanel";

type Tab = "payment" | "swap" | "liquidity";

function ConnectScreen({ connect }: { connect: () => Promise<void> }) {
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      await connect();
    } catch {
      // user dismissed or error — silently ignore
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-logo">⭐</div>
        <h1 className="connect-title">Stellar AgentKit</h1>
        <p className="connect-subtitle">
          Connect your Stellar wallet to access payments, DEX swaps, and
          liquidity pool operations on Testnet.
        </p>
        <button className="btn btn-connect" onClick={handleConnect} disabled={connecting}>
          {connecting ? <><span className="spinner" />Connecting...</> : "Connect Wallet"}
        </button>
        <p className="connect-notice">
          Supports Freighter, Albedo, xBull, Lobstr, and more.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { address, isConnected, connect, walletButtonRef } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>("swap");

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-star">⭐</span>
            <span className="logo-text">Stellar AgentKit</span>
            <span className="badge">Testnet</span>
          </div>
          <div className="header-wallet" ref={walletButtonRef} />
        </div>
      </header>

      {isConnected && (
        <div className="warning-banner">
          ⚠️ This interface is <strong>Testnet only</strong>. Your keys never
          leave the browser.
        </div>
      )}

      <main className="app-main">
        {!isConnected ? (
          <ConnectScreen connect={connect} />
        ) : (
          <div className="card">
            {address && (
              <div className="address-bar">
                <span className="address-label">Connected</span>
                <span className="address-value">{address}</span>
              </div>
            )}
            <nav className="tab-nav">
              <button
                className={`tab-btn ${activeTab === "swap" ? "active" : ""}`}
                onClick={() => setActiveTab("swap")}
              >
                🔄 Swap (DEX)
              </button>
              <button
                className={`tab-btn ${activeTab === "payment" ? "active" : ""}`}
                onClick={() => setActiveTab("payment")}
              >
                💸 Send Payment
              </button>
              <button
                className={`tab-btn ${activeTab === "liquidity" ? "active" : ""}`}
                onClick={() => setActiveTab("liquidity")}
              >
                💧 Liquidity Pool
              </button>
            </nav>

            <div className="tab-content">
              {activeTab === "swap" && <SwapPanel />}
              {activeTab === "payment" && <PaymentPanel />}
              {activeTab === "liquidity" && <LiquidityPanel />}
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <a
          href="https://github.com/Stellar-Tools/Stellar-AgentKit"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>{" "}
        · MIT License
      </footer>
    </div>
  );
}
