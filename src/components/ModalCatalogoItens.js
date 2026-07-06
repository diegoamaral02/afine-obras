// src/components/ModalCatalogoItens.js — v2: visual refinado
import React, { useState, useMemo } from "react";
import { CATEGORIAS_COMPRAS } from "../constants/itensCompras";

export default function ModalCatalogoItens({ onConfirmar, onFechar, itensJaAdicionados = [] }) {
  const [categoriaAtiva, setCategoriaAtiva] = useState(CATEGORIAS_COMPRAS[0].id);
  const [selecionados, setSelecionados]     = useState({});
  const [busca, setBusca]                  = useState("");

  const categoriaObj = useMemo(
    () => CATEGORIAS_COMPRAS.find(c => c.id === categoriaAtiva),
    [categoriaAtiva]
  );

  const itensFiltrados = useMemo(() => {
    const base = categoriaObj?.itens || [];
    if (!busca.trim()) return base;
    const q = busca.toLowerCase();
    return base.filter(i => i.descricao.toLowerCase().includes(q));
  }, [categoriaObj, busca]);

  function toggleItem(item) {
    setSelecionados(prev => {
      const key = item.descricao;
      if (prev[key]) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: { qtd: 1, un: item.unidade } };
    });
  }

  function setQtd(key, val) {
    setSelecionados(prev => ({ ...prev, [key]: { ...prev[key], qtd: Math.max(0.01, Number(val)) } }));
  }
  function setUn(key, val) {
    setSelecionados(prev => ({ ...prev, [key]: { ...prev[key], un: val } }));
  }

  const total = Object.keys(selecionados).length;
  const jaSet = new Set(itensJaAdicionados.map(i => i.item));

  function confirmar() {
    onConfirmar(
      Object.entries(selecionados).map(([descricao, { qtd, un }]) => ({
        item: descricao, qtd, unidade: un,
      }))
    );
  }

  return (
    <div
      onClick={onFechar}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(10,10,10,.65)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(860px, 96vw)",
          maxHeight: "88vh",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 24px 64px rgba(0,0,0,.28)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── HEADER ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "2px solid #F5C400",
          background: "#1A1A1A",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📦</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#F5C400", letterSpacing: "-.01em" }}>
                Catálogo de Itens por Serviço
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 1 }}>
                Selecione os itens e ajuste as quantidades
              </div>
            </div>
          </div>
          <button
            onClick={onFechar}
            style={{
              background: "rgba(255,255,255,.08)", border: "none",
              borderRadius: 8, width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,.6)", fontSize: 18,
              transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.15)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.08)"}
          >×</button>
        </div>

        {/* ── BODY ── */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

          {/* Sidebar */}
          <div style={{
            width: 210, minWidth: 210,
            background: "#F8F7F4",
            borderRight: "1px solid #E2DFD8",
            overflowY: "auto",
            padding: "8px 0",
          }}>
            {CATEGORIAS_COMPRAS.map(cat => {
              const qtdNaCat = Object.keys(selecionados).filter(k =>
                cat.itens.some(i => i.descricao === k)
              ).length;
              const ativa = categoriaAtiva === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setCategoriaAtiva(cat.id); setBusca(""); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "9px 14px 9px 12px",
                    border: "none", borderLeft: `3px solid ${ativa ? cat.cor : "transparent"}`,
                    background: ativa ? "#fff" : "transparent",
                    color: ativa ? "#1A1A1A" : "#555",
                    textAlign: "left", cursor: "pointer",
                    fontSize: 12.5, fontWeight: ativa ? 700 : 400,
                    boxShadow: ativa ? "0 1px 4px rgba(0,0,0,.07)" : "none",
                    transition: "all .12s",
                  }}
                >
                  <span style={{ lineHeight: 1.35 }}>{cat.label}</span>
                  {qtdNaCat > 0 && (
                    <span style={{
                      background: cat.cor, color: "#fff",
                      borderRadius: 20, padding: "1px 7px",
                      fontSize: 10, fontWeight: 700, minWidth: 18,
                      textAlign: "center", flexShrink: 0, marginLeft: 4,
                    }}>{qtdNaCat}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Lista */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Busca + título categoria */}
            <div style={{
              padding: "12px 16px 10px",
              borderBottom: "1px solid #E2DFD8",
              background: "#fff",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#F3F2EF", borderRadius: 8, padding: "7px 12px",
                border: "1px solid #E2DFD8",
              }}>
                <span style={{ fontSize: 13, color: "#aaa" }}>🔍</span>
                <input
                  type="text"
                  placeholder={`Filtrar em "${categoriaObj?.label.replace(/.*—\s*/,"") || ""}"`}
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  style={{
                    border: "none", background: "transparent", outline: "none",
                    fontSize: 13, flex: 1, color: "#1A1A1A",
                  }}
                />
                {busca && (
                  <button onClick={() => setBusca("")} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#aaa", fontSize: 15, padding: 0, lineHeight: 1,
                  }}>×</button>
                )}
              </div>
            </div>

            {/* Itens */}
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
              {itensFiltrados.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 13 }}>
                  Nenhum item encontrado.
                </div>
              )}
              {itensFiltrados.map((item, idx) => {
                const key  = item.descricao;
                const sel  = selecionados[key];
                const jaTem = jaSet.has(key);

                return (
                  <div
                    key={key}
                    onClick={() => toggleItem(item)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 18px",
                      borderBottom: idx < itensFiltrados.length - 1 ? "1px solid #F0EDE8" : "none",
                      background: sel ? "#FFFBEA" : "transparent",
                      cursor: "pointer",
                      transition: "background .1s",
                      opacity: jaTem && !sel ? 0.45 : 1,
                    }}
                    onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#F8F7F4"; }}
                    onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Checkbox customizado */}
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: sel ? "none" : "2px solid #ccc",
                      background: sel ? "#1A1A1A" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .12s",
                    }}>
                      {sel && <span style={{ color: "#F5C400", fontSize: 12, fontWeight: 800 }}>✓</span>}
                    </div>

                    {/* Texto */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: sel ? 600 : 400,
                        color: "#1A1A1A", lineHeight: 1.35,
                      }}>
                        {item.descricao}
                        {jaTem && !sel && (
                          <span style={{
                            marginLeft: 7, fontSize: 10, color: "#999",
                            background: "#eee", padding: "1px 6px", borderRadius: 4,
                          }}>já na lista</span>
                        )}
                      </div>
                      {item.fabricante && item.fabricante !== "Genérico" && (
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>
                          {item.fabricante}
                        </div>
                      )}
                    </div>

                    {/* Qtd + Un quando selecionado */}
                    {sel ? (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}
                      >
                        <input
                          type="number" min="0.01" step="1" value={sel.qtd}
                          onChange={e => setQtd(key, e.target.value)}
                          style={{
                            width: 68, padding: "5px 8px",
                            border: "1px solid #E2DFD8", borderRadius: 6,
                            fontSize: 13, textAlign: "right", fontWeight: 600,
                            background: "#fff", outline: "none",
                          }}
                        />
                        <input
                          type="text" value={sel.un}
                          onChange={e => setUn(key, e.target.value)}
                          style={{
                            width: 46, padding: "5px 6px",
                            border: "1px solid #E2DFD8", borderRadius: 6,
                            fontSize: 12, textAlign: "center",
                            background: "#fff", outline: "none",
                            color: "#555",
                          }}
                        />
                      </div>
                    ) : (
                      <span style={{
                        fontSize: 11, color: "#ccc", flexShrink: 0,
                        minWidth: 120, textAlign: "right",
                      }}>
                        {item.unidade}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px",
          borderTop: "1px solid #E2DFD8",
          background: "#F8F7F4",
        }}>
          {/* Resumo seleção */}
          <div style={{ fontSize: 13, color: total > 0 ? "#1A1A1A" : "#aaa" }}>
            {total === 0
              ? "Nenhum item selecionado"
              : (
                <span>
                  <strong style={{ color: "#1A1A1A" }}>{total}</strong>
                  {" "}item{total > 1 ? "s" : ""} selecionado{total > 1 ? "s" : ""}
                </span>
              )
            }
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onFechar}
              style={{
                padding: "9px 20px", border: "1px solid #E2DFD8",
                borderRadius: 8, background: "#fff",
                color: "#555", cursor: "pointer", fontSize: 13,
                fontWeight: 500,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={total === 0}
              style={{
                padding: "9px 24px", border: "none", borderRadius: 8,
                background: total > 0 ? "#1A1A1A" : "#E2DFD8",
                color: total > 0 ? "#F5C400" : "#aaa",
                cursor: total > 0 ? "pointer" : "not-allowed",
                fontWeight: 700, fontSize: 13,
                boxShadow: total > 0 ? "0 2px 8px rgba(0,0,0,.18)" : "none",
                transition: "all .15s",
                display: "flex", alignItems: "center", gap: 7,
              }}
            >
              <span>✓</span>
              <span>Adicionar{total > 0 ? ` (${total})` : ""}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
