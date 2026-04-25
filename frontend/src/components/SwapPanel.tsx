import { useState } from "react";
import { quoteSwap, executeSwap, type RouteQuote, type AssetInput } from "../lib/stellar";
import { useWallet } from "../context/WalletContext";

type Mode = "strict-send" | "strict-receive";

interface AssetForm {
  type: "native" | "issued";
  code: string;
  issuer: string;
}

function assetFormToInput(a: AssetForm): AssetInput {
  if (a.type === "native") return { type: "native" };
  return { code: a.code.trim(), issuer: a.issuer.trim() };
}

function AssetFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: AssetForm;
  onChange: (v: AssetForm) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select
        value={value.type}
        onChange={(e) =>
          onChange({ ...value, type: e.target.value as "native" | "issued" })
        }
        style={{ marginBottom: 8 }}
      >
        <option value="native">XLM (Native)</option>
        <option value="issued">Issued Asset</option>
      </select>
      {value.type === "issued" && (
        <div className="field-row">
          <input
            placeholder="Code (USDC)"
            value={value.code}
            onChange={(e) => onChange({ ...value, code: e.target.value })}
          />
          <input
            placeholder="Issuer (G...)"
            value={value.issuer}
            onChange={(e) => onChange({ ...value, issuer: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export default function SwapPanel() {
  const { address, signTransaction } = useWallet();
  const [mode, setMode] = useState<Mode>("strict-send");
  const [sendAsset, setSendAsset] = useState<AssetForm>({ type: "native", code: "", issuer: "" });
  const [destAsset, setDestAsset] = useState<AssetForm>({ type: "issued", code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" });
  const [sendAmount, setSendAmount] = useState("");
  const [destAmount, setDestAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState("100");
  const [quotes, setQuotes] = useState<RouteQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleQuote() {
    setResult(null);
    setQuotes([]);
    setSelectedQuote(null);
    setQuoteLoading(true);
    try {
      const qs = await quoteSwap({
        mode,
        sendAsset: assetFormToInput(sendAsset),
        destAsset: assetFormToInput(destAsset),
        sendAmount: mode === "strict-send" ? sendAmount : undefined,
        destAmount: mode === "strict-receive" ? destAmount : undefined,
        limit: 5,
      });
      setQuotes(qs);
      if (qs.length > 0) setSelectedQuote(0);
      if (qs.length === 0) setResult({ ok: false, msg: "No route found for this pair." });
    } catch (err: any) {
      setResult({ ok: false, msg: `❌ ${err.message ?? String(err)}` });
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleSwap() {
    if (!address) return;
    const parsedSlippage = parseInt(slippageBps, 10);
    if (isNaN(parsedSlippage) || parsedSlippage < 0) {
      setResult({ ok: false, msg: "❌ Invalid slippage value." });
      return;
    }
    setResult(null);
    setSwapLoading(true);
    try {
      const hash = await executeSwap({
        address,
        signXdr: signTransaction,
        mode,
        sendAsset: assetFormToInput(sendAsset),
        destAsset: assetFormToInput(destAsset),
        sendAmount: mode === "strict-send" ? sendAmount : undefined,
        destAmount: mode === "strict-receive" ? destAmount : undefined,
        slippageBps: parsedSlippage,
        route: selectedQuote !== null ? quotes[selectedQuote] : undefined,
      });
      setResult({ ok: true, msg: hash });
    } catch (err: any) {
      setResult({ ok: false, msg: `❌ ${err.message ?? String(err)}` });
    } finally {
      setSwapLoading(false);
    }
  }

  const amountLabel = mode === "strict-send" ? "Send Amount" : "Receive Amount";
  const amountValue = mode === "strict-send" ? sendAmount : destAmount;
  const setAmountValue = mode === "strict-send" ? setSendAmount : setDestAmount;
  const canQuote = amountValue.trim().length > 0;
  const canSwap = canQuote && quotes.length > 0;

  return (
    <div>
      <div className="field">
        <label>Mode</label>
        <select value={mode} onChange={(e) => { setMode(e.target.value as Mode); setQuotes([]); setSelectedQuote(null); }}>
          <option value="strict-send">Strict Send (exact send amount)</option>
          <option value="strict-receive">Strict Receive (exact receive amount)</option>
        </select>
      </div>

      <AssetFields label="Send" value={sendAsset} onChange={setSendAsset} />
      <AssetFields label="Receive" value={destAsset} onChange={setDestAsset} />

      <div className="field">
        <label>{amountLabel}</label>
        <input
          type="number"
          step="0.0000001"
          min="0"
          placeholder="0.00"
          value={amountValue}
          onChange={(e) => setAmountValue(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleQuote}
        disabled={quoteLoading || !canQuote}
      >
        {quoteLoading ? <><span className="spinner" />Fetching quotes...</> : "📊 Get Quote"}
      </button>

      {quotes.length > 0 && (
        <div>
          <div className="section-title">Routes</div>
          <div className="quote-list">
            {quotes.map((q, i) => (
              <div
                key={i}
                className={`quote-card ${selectedQuote === i ? "selected" : ""}`}
                onClick={() => setSelectedQuote(i)}
              >
                <div className="rate">
                  {q.sendAmount} → {q.destAmount}
                </div>
                <div className="hops">
                  {q.hopCount === 0 ? "Direct" : `${q.hopCount} intermediate asset(s)`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {quotes.length > 0 && (
        <>
          <div className="divider" />

          <div className="field">
            <label>Slippage (bps)</label>
            <input
              type="number"
              min="0"
              max="5000"
              value={slippageBps}
              onChange={(e) => setSlippageBps(e.target.value)}
            />
            <div className="field-hint">100 bps = 1% slippage tolerance</div>
          </div>

          <button
            type="button"
            className="btn"
            onClick={handleSwap}
            disabled={swapLoading || !canSwap}
          >
            {swapLoading ? <><span className="spinner" />Swapping...</> : "🔄 Execute Swap"}
          </button>
        </>
      )}

      {result && (
        <div className={`result-box ${result.ok ? "success" : "error"}`}>
          {result.ok ? (
            <>
              ✅ Swap successful!{" "}
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${result.msg}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Explorer ↗
              </a>
            </>
          ) : (
            result.msg
          )}
        </div>
      )}
    </div>
  );
}
