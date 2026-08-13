// src/components/HistoricoAlteracoes.js
// Exibe o histórico de alterações de qualquer documento (subcoleção /historico).
// Uso: <HistoricoAlteracoes colecao="obras" docId={id} />
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

function fmtDatetime(iso) {
  if (!iso) return "–";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch { return iso; }
}

function CampoRow({ nome, valor }) {
  const str = typeof valor === "object" ? JSON.stringify(valor, null, 2) : String(valor ?? "–");
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 2, fontSize: 12 }}>
      <span style={{ color: "var(--cinza-med)", minWidth: 130, flexShrink: 0 }}>{nome}:</span>
      <span style={{ wordBreak: "break-word", color: "var(--texto)" }}>{str.length > 120 ? str.slice(0, 120) + "…" : str}</span>
    </div>
  );
}

export default function HistoricoAlteracoes({ colecao, docId, maxEntradas = 20 }) {
  const [entradas, setEntradas] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [aberto,   setAberto]   = useState(false);

  useEffect(() => {
    if (!aberto || !colecao || !docId) return;
    setLoading(true);
    const q = query(
      collection(db, colecao, docId, "historico"),
      orderBy("alteradoEm", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setEntradas(snap.docs.slice(0, maxEntradas).map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [aberto, colecao, docId, maxEntradas]);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="btn btn-sm"
        onClick={() => setAberto(a => !a)}
        style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
      >
        🕑 {aberto ? "Fechar histórico" : "Ver histórico de alterações"}
      </button>

      {aberto && (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--borda)", paddingTop: 10 }}>
          {loading && <div className="spinner" style={{ width: 20, height: 20 }} />}

          {!loading && entradas.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--cinza-med)" }}>Nenhuma alteração registrada.</p>
          )}

          {!loading && entradas.map(e => (
            <div key={e.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--borda-leve)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--texto)" }}>
                  {e.alteradoPorNome || "–"}
                </span>
                <span style={{ fontSize: 11, color: "var(--cinza-med)" }}>
                  {fmtDatetime(e.alteradoEm)}
                </span>
              </div>
              {e.campos && typeof e.campos === "object" && !Array.isArray(e.campos) && (
                <div>
                  {Object.entries(e.campos)
                    .filter(([k]) => !["updatedAt","updatedBy","createdAt","createdBy"].includes(k))
                    .map(([k, v]) => <CampoRow key={k} nome={k} valor={v} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
