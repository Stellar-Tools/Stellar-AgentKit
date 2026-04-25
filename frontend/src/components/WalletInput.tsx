type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function WalletInput({ value, onChange }: Props) {
  return (
    <div className="field secret-field">
      <label>🔑 Gizli Anahtar (Secret Key)</label>
      <input
        type="password"
        placeholder="S..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="field-hint">
        Yalnızca Testnet — anahtar tarayıcıdan çıkmaz, hiçbir sunucuya
        gönderilmez.
      </div>
    </div>
  );
}
