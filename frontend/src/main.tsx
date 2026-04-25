import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import App from "./App";
import { WalletProvider } from "./context/WalletContext";
import { initKit } from "./lib/wallet";

initKit();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </StrictMode>
);
