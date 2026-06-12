// src/components/OSDigital.js
// Ordem de Serviço digital gerada e assinada na hora no celular
import React, { useRef, useState } from "react";
import AssinaturaDigital from "./AssinaturaDigital";

const SERVICOS_PRONTOS = {
  manutencao: [
    "Substituição de lâmpadas queimadas",
    "Troca de tomadas e interruptores defeituosos",
    "Reparo no quadro de distribuição elétrica",
    "Manutenção de ar-condicionado (limpeza de filtros)",
    "Reparo de vazamento hidráulico",
    "Substituição de torneiras e metais",
    "Reparo em forro/gesso danificado",
    "Fixação/reparo de revestimentos soltos",
    "Reparo em porta/fechadura/dobradiça",
    "Manutenção de cabeamento estruturado",
    "Reparo em câmera de CFTV",
    "Substituição de equipamento de controle de acesso",
    "Pintura corretiva em paredes e teto",
    "Rejunte e silicone em banheiros",
    "Revisão geral preventiva",
  ],
  obra: [
    "Execução de alvenaria / drywall",
    "Instalação elétrica — infraestrutura",
    "Instalação elétrica — fiação e acabamento",
    "Instalação hidráulica",
    "Aplicação de revestimento cerâmico",
    "Aplicação de piso laminado / carpete",
    "Pintura — massa corrida e tinta",
    "Instalação de forro",
    "Montagem de mobiliário",
    "Instalação de cabeamento estruturado",
    "Instalação de ar-condicionado",
    "Instalação de controle de acesso / CFTV",
    "Limpeza grossa",
    "Limpeza fina e entrega",
  ],
};

export default function OSDigital({ manutencao, funcionario, onSalvar, onFechar }) {
  const tipo = manutencao ? "manutencao" : "obra";
  const [servicosSel, setServicosSel] = useState([]);
  const [descricaoExtra, setDescricaoExtra] = useState("");
  const [assinPrestador, setAssinPrestador] = useState(null);
  const [assinGerente, setAssinGerente] = useState(null);
  const [nomeGerente, setNomeGerente] = useState("");
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [passo, setPasso] = useState(1); // 1=serviços, 2=assinatura prestador, 3=assinatura gerente

  function toggleServico(s) {
    setServicosSel(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  }

  function gerarOS() {
    if (servicosSel.length === 0 && !descricaoExtra.trim()) {
      alert("Selecione pelo menos um serviço ou adicione uma descrição.");
      return;
    }
    setPasso(2);
  }

  function avancarAssinGerente() {
    if (!assinPrestador) { alert("O prestador precisa assinar primeiro."); return; }
    setPasso(3);
  }

  function finalizar() {
    if (!assinGerente) { alert("O gerente precisa assinar para confirmar a OS."); return; }
    if (!nomeGerente.trim()) { alert("Informe o nome do gerente responsável."); return; }

    const os = {
      numero: `OS-${Date.now()}`,
      data: new Date().toLocaleString("pt-BR"),
      funcionario: funcionario || {},
      servicos: servicosSel,
      descricaoExtra,
      assinPrestador,
      assinGerente,
      nomeGerente,
      geradaEm: new Date().toISOString(),
    };
    onSalvar(os);
  }

  const dataHora = new Date().toLocaleString("pt-BR");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Cabeçalho da OS */}
      <div style={{ background: "var(--azul)", borderRadius: 8, padding: 14, color: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>ORDEM DE SERVIÇO DIGITAL</div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>AFINE – A.F. Nery Arquitetura e Construção</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, fontSize: 12 }}>
          <div><span style={{ opacity: 0.7 }}>Data/Hora:</span><br/><strong>{dataHora}</strong></div>
          <div><span style={{ opacity: 0.7 }}>Prestador:</span><br/><strong>{funcionario?.nome || "–"}</strong></div>
          <div><span style={{ opacity: 0.7 }}>Função:</span><br/><strong>{funcionario?.funcao || "–"}</strong></div>
          <div><span style={{ opacity: 0.7 }}>Empresa:</span><br/><strong>{funcionario?.empresa || "AFINE"}</strong></div>
        </div>
      </div>

      {/* PASSO 1 — Serviços */}
      {passo === 1 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#185FA5" }}>SERVIÇOS EXECUTADOS</div>
          <div style={{ fontSize: 12, color: "var(--cinza-med)", marginBottom: 4 }}>Selecione os serviços realizados:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
            {SERVICOS_PRONTOS[tipo].map(s => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "5px 8px", borderRadius: 6, background: servicosSel.includes(s) ? "var(--azul-claro)" : "var(--cinza-lt)" }}>
                <input type="checkbox" checked={servicosSel.includes(s)} onChange={() => toggleServico(s)} style={{ width: 15, height: 15, flexShrink: 0 }} />
                <span style={{ color: servicosSel.includes(s) ? "var(--azul)" : "inherit", fontWeight: servicosSel.includes(s) ? 500 : 400 }}>{s}</span>
              </label>
            ))}
          </div>

          <div className="form-group">
            <label>Descrição adicional / observações</label>
            <textarea value={descricaoExtra} onChange={e => setDescricaoExtra(e.target.value)} placeholder="Descreva detalhes adicionais do serviço executado..." rows={3} />
          </div>

          <button className="btn btn-primary" onClick={gerarOS} style={{ justifyContent: "center" }}>
            Próximo — Assinatura do prestador →
          </button>
        </>
      )}

      {/* PASSO 2 — Assinatura do prestador */}
      {passo === 2 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#185FA5" }}>RESUMO DOS SERVIÇOS</div>
          <div style={{ background: "var(--cinza-lt)", borderRadius: 6, padding: 10, fontSize: 12 }}>
            {servicosSel.map((s, i) => <div key={i}>• {s}</div>)}
            {descricaoExtra && <div style={{ marginTop: 6, fontStyle: "italic" }}>{descricaoExtra}</div>}
          </div>

          <AssinaturaDigital
            label="Assinatura do prestador de serviço"
            assinatura={assinPrestador}
            onChange={setAssinPrestador}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setPasso(1)}>← Voltar</button>
            <button className="btn btn-primary" onClick={avancarAssinGerente} style={{ flex: 1, justifyContent: "center" }}>
              Próximo — Assinatura do gerente →
            </button>
          </div>
        </>
      )}

      {/* PASSO 3 — Assinatura do gerente */}
      {passo === 3 && (
        <>
          <div className="alert alert-warning" style={{ fontSize: 12 }}>
            📱 <strong>Entregue o celular ao gerente da agência</strong> para que ele confirme e assine a OS.
          </div>

          <div className="form-group">
            <label className="required">Nome do gerente responsável</label>
            <input value={nomeGerente} onChange={e => setNomeGerente(e.target.value)} placeholder="Nome completo do gerente" />
          </div>

          <AssinaturaDigital
            label="Assinatura do gerente da agência"
            assinatura={assinGerente}
            onChange={setAssinGerente}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setPasso(2)}>← Voltar</button>
            <button className="btn btn-primary" onClick={finalizar} style={{ flex: 1, justifyContent: "center" }}>
              ✓ Finalizar e salvar OS
            </button>
          </div>
        </>
      )}
    </div>
  );
}
