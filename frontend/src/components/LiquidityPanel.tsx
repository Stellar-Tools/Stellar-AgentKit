import { useState } from "react";
import { getLpReserves, lpDeposit, lpWithdraw } from "../lib/stellar";
import { useWallet } from "../context/WalletContext";

type Action = "reserves" | "deposit" | "withdraw";

const DEFAULT_CONTRACT = "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ";

export default function LiquidityPanel() {
  const { address, signTransaction } = useWallet();
  const [action, setAction] = useState<Action>("reserves");
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);

  // Deposit fields
  const [to, setTo] = useState("");
  const [desiredA, setDesiredA] = useState("");
  const [minA, setMinA] = useState("");
  const [desiredB, setDesiredB] = useState("");
  const [minB, setMinB] = useState("");

  // Withdraw fields
  const [shareAmount, setShareAmount] = useState("");
  const [wMinA, setWMinA] = useState("");
  const [wMinB, setWMinB] = useState("");
  const [wTo, setWTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setResult(null);
    setLoading(true);
    try {
      if (action === "reserves") {
        const r = await getLpReserves(address, contractAddress || undefined);
        setResult({ ok: true, msg: `Reserve A: ${r.reserveA}\nReserve B: ${r.reserveB}` });
      } else if (action === "deposit") {
        const hash = await lpDeposit({
          address,
          signXdr: signTransaction,
          to: to.trim(),
          desiredA: desiredA.trim(),
          minA: minA.trim(),
          desiredB: desiredB.trim(),
          minB: minB.trim(),
          contractAddress: contractAddress || undefined,
        });
        setResult({ ok: true, msg: hash });
      } else {
        const hash = await lpWithdraw({
          address,
          signXdr: signTransaction,
          to: wTo.trim(),
          shareAmount: shareAmount.trim(),
          minA: wMinA.trim(),
          minB: wMinB.trim(),
          contractAddress: contractAddress || undefined,
        });
        setResult({ ok: true, msg: hash });
      }
    } catch (err: any) {
      setResult({ ok: false, msg: `❌ ${err.message ?? String(err)}` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>Action</label>
        <select value={action} onChange={(e) => { setAction(e.target.value as Action); setResult(null); }}>
          <option value="reserves">View Reserves</option>
          <option value="deposit">Add Liquidity (Deposit)</option>
          <option value="withdraw">Remove Liquidity (Withdraw)</option>
        </select>
      </div>

      <div className="field">
        <label>Contract Address</label>
        <input
          placeholder={DEFAULT_CONTRACT}
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
        <div className="field-hint">Leave empty to use the default testnet pool.</div>
      </div>

      {action === "deposit" && (
        <>
          <div className="divider" />
          <div className="field">
            <label>Recipient Address (to)</label>
            <input placeholder="G..." value={to} onChange={(e) => setTo(e.target.value)} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Desired A (stroops)</label>
              <input placeholder="1000000" value={desiredA} onChange={(e) => setDesiredA(e.target.value)} required />
            </div>
            <div className="field">
              <label>Min A (stroops)</label>
              <input placeholder="990000" value={minA} onChange={(e) => setMinA(e.target.value)} required />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Desired B (stroops)</label>
              <input placeholder="1000000" value={desiredB} onChange={(e) => setDesiredB(e.target.value)} required />
            </div>
            <div className="field">
              <label>Min B (stroops)</label>
              <input placeholder="990000" value={minB} onChange={(e) => setMinB(e.target.value)} required />
            </div>
          </div>
          <div className="field-hint" style={{ marginBottom: 16 }}>
            1 XLM = 10,000,000 stroops
          </div>
        </>
      )}

      {action === "withdraw" && (
        <>
          <div className="divider" />
          <div className="field">
            <label>Recipient Address (to)</label>
            <input placeholder="G..." value={wTo} onChange={(e) => setWTo(e.target.value)} required />
          </div>
          <div className="field">
            <label>Share Amount (stroops)</label>
            <input placeholder="500000" value={shareAmount} onChange={(e) => setShareAmount(e.target.value)} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Min A (stroops)</label>
              <input placeholder="490000" value={wMinA} onChange={(e) => setWMinA(e.target.value)} required />
            </div>
            <div className="field">
              <label>Min B (stroops)</label>
              <input placeholder="490000" value={wMinB} onChange={(e) => setWMinB(e.target.value)} required />
            </div>
          </div>
        </>
      )}

      <button type="submit" className="btn" disabled={loading}>
        {loading ? (
          <><span className="spinner" />Processing...</>
        ) : action === "reserves" ? (
          "📊 Fetch Reserves"
        ) : action === "deposit" ? (
          "💧 Add Liquidity"
        ) : (
          "📤 Remove Liquidity"
        )}
      </button>

      {result && (
        <div className={`result-box ${result.ok ? "success" : "error"}`}>
          {result.ok && action !== "reserves" ? (
            <>
              ✅ Transaction successful!{" "}
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${result.msg}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Explorer ↗
              </a>
            </>
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{result.msg}</pre>
          )}
        </div>
      )}
    </form>
  );
}
