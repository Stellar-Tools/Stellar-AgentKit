import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StellarWalletsKit } from "../lib/wallet";
import { KitEventType } from "@creit-tech/stellar-wallets-kit";
import { Networks } from "@stellar/stellar-sdk";

interface WalletContextValue {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
  walletButtonRef: React.RefObject<HTMLDivElement>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// Module-level flag prevents double-mounting in React StrictMode
let _kitButtonCreated = false;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const walletButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsub1 = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event: any) => {
      setAddress(event.payload.address ?? null);
    });
    const unsub2 = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      setAddress(null);
    });

    // Restore previously connected wallet session
    (StellarWalletsKit.getAddress() as Promise<{ address: string }>)
      .then(({ address }) => {
        if (address) setAddress(address);
      })
      .catch(() => {});

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // Mount the kit's connect/profile button into the header div
  useEffect(() => {
    if (_kitButtonCreated || !walletButtonRef.current) return;
    _kitButtonCreated = true;
    StellarWalletsKit.createButton(walletButtonRef.current);
  });

  async function connect(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await StellarWalletsKit.authModal();
    setAddress(result.address);
  }

  async function signTransaction(xdr: string): Promise<string> {
    if (!address) throw new Error("Wallet not connected.");
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: Networks.TESTNET,
      address,
    });
    return signedTxXdr;
  }

  return (
    <WalletContext.Provider
      value={{ address, isConnected: !!address, connect, signTransaction, walletButtonRef }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
