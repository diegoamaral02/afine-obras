// src/components/EtapasEditor.js — editor inline de etapas do cronograma
import React from "react";

const STATUS_ETAPA = ["NÃO INICIADA", "EM ANDAMENTO", "CONCLUÍDA", "ATRASADA"];

const CORES_PRESET = [
  { cor: "#185FA5", label: "Azul"     },
  { cor: "#2A6B3F", label: "Verde"    },
  { cor: "#BD3838", label: "Vermelho" },
  { cor: "#B8910A", label: "Âmbar"   },
  { cor: "#6B21A8", label: "Roxo"     },
  { cor: "#0E7490", label: "Ciano"    },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function EtapasEditor({ etapas = [], onChange, dataInicioObra, dataFimObra }) {
  function update(idx, campo, valor) {
    const nova = etapas.map((e, i) => i === idx ? { ...e, [campo]: valor } : e);
    onChange(nova);
  }

  function adicionar() {
    onChange([
      ...etapas,
      {
        id: uid(),
        nome: "",
        dataInicio: dataInicioObra || "",
        dataFim: dataFimObra || "",
        status: "NÃO_INICIADA",
        cor: "#185FA5",
      },
    ]);
  }

  function remover(idx) {
    onChange(etapas.filter((_, i) => i !== idx));
  }

  function validar(etapa) {
    if (!etapa.dataInicio || !etapa.dataFim) return null;
    if (etapa.dataFim < etapa.dataInicio) return "Data de fim deve ser >= data de início.";
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#7A7A7A", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Etapas do cronograma ({etapas.length})
        </span>
        <button
          className="btn btn-primary btn-sm"
          onClick={adicionar}
          type="button"
        >
          ＋ Adicionar etapa
        </button>
      </div>

      {etapas.length === 0 && (
        <div style={{ textAlign: "center", padding: "20px 16px", color: "#9CA3AF",
          background: "#F3F2EF", borderRadius: 8, border: "1px dashed #D6D3CB", fontSize: 13 }}>
          Nenhuma etapa cadastrada. Clique em "＋ Adicionar etapa" para começar.
        </div>
      )}

      {etapas.map((etapa, idx) => {
        const erro = validar(etapa);
        return (
          <div key={etapa.id || idx}
            style={{
              border: `1px solid ${erro ? "var(--vermelho)" : "var(--border)"}`,
              borderRadius: 8,
              padding: "10px 12px",
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Número */}
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: etapa.cor || "#185FA5",
                color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0 }}>
                {idx + 1}
              </span>

              {/* Nome */}
              <input
                value={etapa.nome}
                onChange={e => update(idx, "nome", e.target.value)}
                placeholder="Nome da etapa (ex: Fundação)"
                style={{ flex: 1, fontSize: 13 }}
              />

              {/* Remover */}
              <button
                type="button"
                onClick={() => remover(idx)}
                style={{ background: "none", border: "none", color: "var(--vermelho)",
                  cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1 }}
                title="Remover etapa"
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              {/* Data início */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Início</label>
                <input type="date" value={etapa.dataInicio}
                  min={dataInicioObra || undefined}
                  max={dataFimObra || undefined}
                  onChange={e => update(idx, "dataInicio", e.target.value)}
                  style={{ fontSize: 12 }}/>
              </div>

              {/* Data fim */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Fim</label>
                <input type="date" value={etapa.dataFim}
                  min={etapa.dataInicio || dataInicioObra || undefined}
                  max={dataFimObra || undefined}
                  onChange={e => update(idx, "dataFim", e.target.value)}
                  style={{ fontSize: 12 }}/>
              </div>

              {/* Status */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Status</label>
                <select value={etapa.status} onChange={e => update(idx, "status", e.target.value)}
                  style={{ fontSize: 12 }}>
                  {STATUS_ETAPA.map(s => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              {/* Cor */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#46464C" }}>Cor</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {CORES_PRESET.map(({ cor, label }) => (
                    <button
                      key={cor}
                      type="button"
                      title={label}
                      onClick={() => update(idx, "cor", cor)}
                      style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: cor, border: etapa.cor === cor ? "2px solid #17171A" : "2px solid transparent",
                        cursor: "pointer", padding: 0, flexShrink: 0,
                        boxShadow: etapa.cor === cor ? "0 0 0 2px #fff, 0 0 0 3px #17171A" : "none",
                        transition: "box-shadow .15s",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {erro && (
              <div style={{ fontSize: 11, color: "var(--vermelho)", marginTop: 2 }}>{erro}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
