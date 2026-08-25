import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import "./styles.css";
import App from "./App";
import { useAuthStore } from "@/store/authStore";

// Restauracao de sessao disparada AQUI (uma vez, antes do render); o AuthGate
// apenas espera o status resolver - a chamada e idempotente e o AuthGate a
// repete so como rede de seguranca.
useAuthStore.getState().inicializar();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
