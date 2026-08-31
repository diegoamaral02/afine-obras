import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(reg => {
        console.log("SW registrado");
        // Dispara Background Sync ao voltar online
        window.addEventListener("online", () => {
          if (reg.sync) reg.sync.register("afine-offline-queue").catch(()=>{});
        });
      })
      .catch(err => console.log("SW erro:", err));

    // Recebe mensagem do SW para processar fila offline
    navigator.serviceWorker.addEventListener("message", e => {
      if (e.data?.type === "SYNC_QUEUE") {
        window.dispatchEvent(new Event("afine-sync-queue"));
      }
    });
  });
}
