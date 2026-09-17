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

// Guarda global de arrastar: sem ela, soltar um arquivo fora de uma <AreaDeSoltar> faz o
// navegador NAVEGAR para o arquivo e destruir a aplicação (formulário aberto, dado não gravado).
window.addEventListener("dragover", (event) => { event.preventDefault(); });
window.addEventListener("drop", (event) => { event.preventDefault(); });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
