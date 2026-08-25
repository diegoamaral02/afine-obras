import React, { useState } from "react";
import AssinaturaDigital from "./AssinaturaDigital";
import { exportarTermoChavesBradescoParaPDF } from "../utils/exportPDF";

const hoje = () => new Date().toISOString().split("T")[0];

export default function TermoChaves({ obra, onSalvar, onCancelar }) {
  const [etapa, setEtapa] = useState(1);
  const [form, setForm] = useState({
    projeto: obra?.nome || "",
    processo: obra?.contrato || "",
    agencia: obra?.agenciaNome || "",
    agenciaNumero: obra?.agenciaNumero || "",
    municipio: obra?.cidade || "",
    lote: "",
    construtora: "AFINE",
    gerenciadora: "",
    dataRecebimento: hoje(),
    // Recebedor (Gerência da Agência)
    nomeRecebedor: "",
    dataRecebedor: hoje(),
    assinRecebedor: null,
    // Entregador (Construtora)
    nomeEntregador: "Diego Amaral",
    celularEntregador: "(11) 99188-5538",
    agenciaEntregador: obra?.agenciaNome || "",
    assinEntregador: null,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const podeAvancar = () => {
    if (etapa === 1) return form.projeto && form.agencia;
    if (etapa === 2) return !!form.assinRecebedor;
    if (etapa === 3) return !!form.assinEntregador;
    return true;
  };

  const salvar = () => {
    const tc = {
      ...form,
      modelo: "termo_chaves",
      numero: `TC-${Date.now()}`,
      geradaEm: new Date().toISOString(),
    };
    exportarTermoChavesBradescoParaPDF(tc);
    onSalvar(tc);
  };

  return (
    <div style={{ padding: "0 0 24px" }}>
      {/* Steps */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["Informações", "Assin. Recebedor", "Assin. Entregador"].map((label, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center", padding: "6px 4px", borderRadius: 6,
            background: etapa === i + 1 ? "var(--amarelo)" : etapa > i + 1 ? "var(--verde)" : "#eee",
            color: etapa > i + 1 ? "#fff" : "#333",
            fontSize: 12, fontWeight: 600,
          }}>
            {etapa > i + 1 ? "✓ " : ""}{label}
          </div>
        ))}
      </div>

      {etapa === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Projeto <span style={{ color: "var(--vermelho)" }}>*</span></label>
              <input className="form-control" value={form.projeto} onChange={e => set("projeto", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Processo</label>
              <input className="form-control" value={form.processo} onChange={e => set("processo", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Agência <span style={{ color: "var(--vermelho)" }}>*</span></label>
              <input className="form-control" value={form.agencia} onChange={e => set("agencia", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Número da Agência</label>
              <input className="form-control" value={form.agenciaNumero} onChange={e => set("agenciaNumero", e.target.value)} placeholder="ex: 1407" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Município</label>
              <input className="form-control" value={form.municipio} onChange={e => set("municipio", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Lote</label>
              <input className="form-control" value={form.lote} onChange={e => set("lote", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Data de recebimento das chaves</label>
              <input type="date" className="form-control" value={form.dataRecebimento} onChange={e => set("dataRecebimento", e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Gerenciadora</label>
            <input className="form-control" value={form.gerenciadora} onChange={e => set("gerenciadora", e.target.value)} />
          </div>
        </div>
      )}

      {etapa === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--cinza-med)" }}>
            Gerência da Agência — <strong>Recebedor das chaves</strong>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Nome completo <span style={{ color: "var(--vermelho)" }}>*</span></label>
              <input className="form-control" value={form.nomeRecebedor} onChange={e => set("nomeRecebedor", e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Data</label>
              <input type="date" className="form-control" value={form.dataRecebedor} onChange={e => set("dataRecebedor", e.target.value)} />
            </div>
          </div>
          <AssinaturaDigital
            label="Assinatura do Recebedor"
            assinatura={form.assinRecebedor}
            onChange={v => set("assinRecebedor", v)}
          />
        </div>
      )}

      {etapa === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: "var(--cinza-med)" }}>
            Construtora / AFINE — <strong>Entregador das chaves</strong>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Nome completo</label>
              <input className="form-control" value={form.nomeEntregador} onChange={e => set("nomeEntregador", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Celular</label>
              <input className="form-control" value={form.celularEntregador} onChange={e => set("celularEntregador", e.target.value)} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Agência</label>
              <input className="form-control" value={form.agenciaEntregador} onChange={e => set("agenciaEntregador", e.target.value)} />
            </div>
          </div>
          <AssinaturaDigital
            label="Assinatura do Entregador"
            assinatura={form.assinEntregador}
            onChange={v => set("assinEntregador", v)}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
        <button className="btn" onClick={etapa === 1 ? onCancelar : () => setEtapa(e => e - 1)}>
          {etapa === 1 ? "Cancelar" : "← Voltar"}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {etapa < 3 ? (
            <button className="btn btn-primary" onClick={() => setEtapa(e => e + 1)} disabled={!podeAvancar()}>
              Próximo →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={salvar} disabled={!podeAvancar()}>
              ✓ Salvar Termo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
