// src/pages/FinanceiroUnificado.js — Financeiro, DRE e Despesas em abas unificadas
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Financeiro from "./Financeiro";
import DRE from "./DRE";
import Despesas from "./Despesas";

const ABAS = [
  { id: "fluxo",   label: "💰 Fluxo de Caixa",  componente: Financeiro },
  { id: "dre",     label: "📈 DRE",              componente: DRE },
  { id: "despesas",label: "🧾 Despesas",          componente: Despesas },
];

export default function FinanceiroUnificado() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const tabParam = params.get("tab");
  const abaInicial = ABAS.find(a => a.id === tabParam) ? tabParam : "fluxo";
  const [abaAtiva, setAbaAtiva] = useState(abaInicial);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab && ABAS.find(a => a.id === tab)) {
      setAbaAtiva(tab);
    }
  }, [location.search]);

  function irPara(id) {
    setAbaAtiva(id);
    navigate(`/financeiro?tab=${id}`, { replace: true });
  }

  const Componente = ABAS.find(a => a.id === abaAtiva)?.componente || Financeiro;

  return (
    <div>
      {/* Tabs de navegação */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        borderBottom: "2px solid var(--border)", paddingBottom: 0,
      }}>
        {ABAS.map(aba => (
          <button
            key={aba.id}
            onClick={() => irPara(aba.id)}
            style={{
              padding: "8px 18px",
              background: "none",
              border: "none",
              borderBottom: abaAtiva === aba.id ? "2px solid var(--afine-yellow)" : "2px solid transparent",
              marginBottom: -2,
              cursor: "pointer",
              fontWeight: abaAtiva === aba.id ? 700 : 400,
              fontSize: 14,
              color: abaAtiva === aba.id ? "var(--afine-yellow)" : "var(--cinza-med)",
              transition: "all .15s",
              whiteSpace: "nowrap",
            }}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba ativa */}
      <Componente />
    </div>
  );
}
