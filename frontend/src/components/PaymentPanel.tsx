import { useState } from "react";
import { sendPayment } from "../lib/stellar";
import { useWallet } from "../context/WalletContext";

type AssetMode = "native" | "issued";

export default function PaymentPanel() {
  const { address, signTransaction } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [assetMode, setAssetMode] = useState<AssetMode>("native");
  const [assetCode, setAssetCode] = useState("");
  const [assetIssuer, setAssetIssuer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setResult(null);
    setLoading(true);
    try {
      const asset =
        assetMode === "issued"
          ? { code: assetCode.trim(), issuer: assetIssuer.trim() }
          : undefined;

      const hash = await sendPayment({
        address,
        signXdr: signTransaction,
        recipient: recipient.trim(),
        amount: amount.trim(),
        asset,
      });
      setResult({ ok: true, msg: hash });
    } catch (err: any) {
      setResult({ ok: false, msg: `❌ ${err.message ?? String(err)}` });
    } finally {
      setLoading(false);
    }
  }

  const explorerUrl = result?.ok
    ? `https://stellar.expert/explorer/testnet/tx/${result.msg}`
    : null;

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>Recipient Address</label>
        <input
          placeholder="G..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label>Amount</label>
        <input
          type="number"
          step="0.0000001"
          min="0.0000001"
          placeholder="10"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label>Asset Type</label>
        <select
          value={assetMode}
          onChange={(e) => setAssetMode(e.target.value as AssetMode)}
        >
          <option value="native">XLM (Native)</option>
          <option value="issued">Issued Asset (USDC, etc.)</option>
        </select>
      </div>

      {assetMode === "issued" && (
        <div className="field-row">
          <div className="field">
            <label>Asset Code</label>
            <input
              placeholder="USDC"
              value={assetCode}
              onChange={(e) => setAssetCode(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Asset Issuer</label>
            <input
              placeholder="G..."
              value={assetIssuer}
              onChange={(e) => setAssetIssuer(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      <button type="submit" className="btn" disabled={loading || !recipient || !amount}>
        {loading ? <><span className="spinner" />Sending...</> : "💸 Send Payment"}
      </button>

      {result && (
        <div className={`result-box ${result.ok ? "success" : "error"}`}>
          {result.ok && explorerUrl ? (
            <>
              ✅ Transaction successful!{" "}
              <a href={explorerUrl} target="_blank" rel="noreferrer">
                View on Explorer ↗
              </a>
            </>
          ) : (
            result.msg
          )}
        </div>
      )}
    </form>
  );
}
