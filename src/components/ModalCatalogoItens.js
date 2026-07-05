// src/components/ModalCatalogoItens.js
// Modal de seleção rápida de itens por categoria de serviço
// Abre a partir do formulário de Solicitação em Compras.js

import React, { useState, useMemo } from "react";
import { CATEGORIAS_COMPRAS } from "../constants/itensCompras";

/**
 * Props:
 *   onConfirmar(itensAdicionados) — callback com array de itens selecionados
 *   onFechar()                   — fecha o modal sem adicionar
 *   itensJaAdicionados           — array atual de itens (para marcar duplicatas)
 */
export default function ModalCatalogoItens({ onConfirmar, onFechar, itensJaAdicionados = [] }) {
  const [categoriaAtiva, setCategoriaAtiva] = useState(CATEGORIAS_COMPRAS[0].id);
  const [selecionados, setSelecionados] = useState({}); // { "descricao": { qtd, un } }
  const [busca, setBusca] = useState("");

  const categoriaObj = useMemo(
    () => CATEGORIAS_COMPRAS.find((c) => c.id === categoriaAtiva),
    [categoriaAtiva]
  );

  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return categoriaObj?.itens || [];
    const q = busca.toLowerCase();
    return (categoriaObj?.itens || []).filter((i) =>
      i.descricao.toLowerCase().includes(q)
    );
  }, [categoriaObj, busca]);

  function toggleItem(item) {
    setSelecionados((prev) => {
      const key = item.descricao;
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { qtd: 1, un: item.unidade } };
    });
  }

  function setQtd(descricao, val) {
    setSelecionados((prev) => ({
      ...prev,
      [descricao]: { ...prev[descricao], qtd: Math.max(0.01, Number(val)) },
    }));
  }

  function setUn(descricao, val) {
    setSelecionados((prev) => ({
      ...prev,
      [descricao]: { ...prev[descricao], un: val },
    }));
  }

  const totalSelecionados = Object.keys(selecionados).length;

  function confirmar() {
    const itens = Object.entries(selecionados).map(([descricao, { qtd, un }]) => ({
      item: descricao,
      qtd,
      unidade: un,
    }));
    onConfirmar(itens);
  }

  const jaAdicionadosSet = new Set(itensJaAdicionados.map((i) => i.item));

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div
        className="modal-content catalogo-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 820, width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: "2px solid var(--afine-yellow)", paddingBottom: 12, marginBottom: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>📦 Catálogo de Itens por Serviço</h3>
          <button className="btn-fechar" onClick={onFechar} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#666" }}>×</button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Sidebar categorias */}
          <div style={{
            width: 220,
            minWidth: 220,
            borderRight: "1px solid #e0e0e0",
            overflowY: "auto",
            padding: "8px 0",
            background: "#fafafa",
          }}>
            {CATEGORIAS_COMPRAS.map((cat) => {
              const qtdNaCat = Object.keys(selecionados).filter((k) =>
                cat.itens.some((i) => i.descricao === k)
              ).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setCategoriaAtiva(cat.id); setBusca(""); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "10px 14px",
                    border: "none",
                    background: categoriaAtiva === cat.id ? "#1A1A1A" : "transparent",
                    color: categoriaAtiva === cat.id ? "#fff" : "#333",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: categoriaAtiva === cat.id ? 600 : 400,
                    borderLeft: categoriaAtiva === cat.id ? `4px solid ${cat.cor}` : "4px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <span>{cat.label}</span>
                  {qtdNaCat > 0 && (
                    <span style={{
                      background: "var(--afine-yellow)",
                      color: "#1A1A1A",
                      borderRadius: 10,
                      padding: "1px 7px",
                      fontSize: 11,
                      fontWeight: 700,
                      minWidth: 20,
                      textAlign: "center",
                    }}>{qtdNaCat}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Lista de itens */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Busca */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #eee" }}>
              <input
                type="text"
                placeholder="🔍 Filtrar itens desta categoria..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Items */}
            <div style={{ overflowY: "auto", flex: 1, padding: "8px 16px" }}>
              {itensFiltrados.length === 0 && (
                <p style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 24 }}>
                  Nenhum item encontrado.
                </p>
              )}
              {itensFiltrados.map((item) => {
                const key = item.descricao;
                const sel = selecionados[key];
                const jaTem = jaAdicionadosSet.has(key);

                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 0",
                      borderBottom: "1px solid #f0f0f0",
                      opacity: jaTem && !sel ? 0.5 : 1,
                    }}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={!!sel}
                      onChange={() => toggleItem(item)}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#1A1A1A", flexShrink: 0 }}
                    />

                    {/* Descrição */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: sel ? 600 : 400, color: "#1A1A1A", lineHeight: 1.3 }}>
                        {item.descricao}
                        {jaTem && !sel && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: "#888", background: "#eee", padding: "1px 5px", borderRadius: 4 }}>já adicionado</span>
                        )}
                      </div>
                      {item.fabricante && item.fabricante !== "Genérico" && (
                        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{item.fabricante}</div>
                      )}
                    </div>

                    {/* Qtd + Un (só quando selecionado) */}
                    {sel && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        <input
                          type="number"
                          min="0.01"
                          step="1"
                          value={sel.qtd}
                          onChange={(e) => setQtd(key, e.target.value)}
                          style={{
                            width: 70,
                            padding: "4px 8px",
                            border: "1px solid #ccc",
                            borderRadius: 5,
                            fontSize: 13,
                            textAlign: "right",
                          }}
                        />
                        <input
                          type="text"
                          value={sel.un}
                          onChange={(e) => setUn(key, e.target.value)}
                          style={{
                            width: 52,
                            padding: "4px 6px",
                            border: "1px solid #ccc",
                            borderRadius: 5,
                            fontSize: 12,
                            textAlign: "center",
                          }}
                        />
                      </div>
                    )}

                    {/* Unidade padrão (quando não selecionado) */}
                    {!sel && (
                      <span style={{ fontSize: 11, color: "#aaa", flexShrink: 0, width: 130, textAlign: "right" }}>
                        un: {item.unidade}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid #e0e0e0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fafafa",
        }}>
          <span style={{ fontSize: 13, color: "#555" }}>
            {totalSelecionados === 0
              ? "Nenhum item selecionado"
              : `${totalSelecionados} item${totalSelecionados > 1 ? "s" : ""} selecionado${totalSelecionados > 1 ? "s" : ""}`}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onFechar}
              style={{
                padding: "8px 18px",
                border: "1px solid #ccc",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={totalSelecionados === 0}
              style={{
                padding: "8px 22px",
                border: "none",
                borderRadius: 6,
                background: totalSelecionados > 0 ? "#1A1A1A" : "#ccc",
                color: totalSelecionados > 0 ? "var(--afine-yellow)" : "#888",
                cursor: totalSelecionados > 0 ? "pointer" : "not-allowed",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              ✓ Adicionar {totalSelecionados > 0 ? `(${totalSelecionados})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
