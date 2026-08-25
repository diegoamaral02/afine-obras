// src/components/TermoRecebimento.js — Termo de Recebimento Definitivo (modelo BRADESCO/AFINE)
import React, { useState } from "react";
import AssinaturaDigital from "./AssinaturaDigital";

const AVALIACOES = ["Ruim", "Regular", "Bom", "Ótimo", "Não se aplica"];

export default function TermoRecebimento({ obra, onSalvar, onFechar }) {
  const [passo, setPasso] = useState(1);

  // Passo 1 — Informações gerais
  const [juncaoLocal,  setJuncaoLocal]  = useState(obra?.agenciaNome || "");
  const [nrProcesso,   setNrProcesso]   = useState(obra?.contrato    || "");
  const [endereco,     setEndereco]     = useState(
    [obra?.logradouro, obra?.cidade, obra?.uf].filter(Boolean).join(", ") || ""
  );
  const [tipoServico,  setTipoServico]  = useState("");
  const [areaIntervencao, setAreaIntervencao] = useState(obra?.area ? `${obra.area} m²` : "");
  const [respPatrimonioProjeto, setRespPatrimonioProjeto] = useState("");
  const [respPatrimonioObra,    setRespPatrimonioObra]    = useState("");
  const [acompanhamento,        setAcompanhamento]        = useState("");
  const [respGerenciadora,      setRespGerenciadora]      = useState("");
  const [contatoGerenciadora,   setContatoGerenciadora]   = useState("");

  // Programação / datas efetivas
  const [inicioEfetivo,  setInicioEfetivo]  = useState(obra?.inicio   || "");
  const [terminoEfetivo, setTerminoEfetivo] = useState(obra?.termino  || "");

  // Passo 2 — Escopo e avaliação
  const [escopo,     setEscopo]     = useState("");
  const [avPatrimonio,    setAvPatrimonio]    = useState("");
  const [avConstrutora,   setAvConstrutora]   = useState("");
  const [avGerenciadora,  setAvGerenciadora]  = useState("");
  const [avOutros,        setAvOutros]        = useState("");
  const [comentarios,     setComentarios]     = useState("");

  // Assinaturas
  const [assinGerencia,      setAssinGerencia]      = useState(null);
  const [assinConstrutora,   setAssinConstrutora]   = useState(null);
  const [assinGerenciadora,  setAssinGerenciadora]  = useState(null);
  const [geoGerencia,        setGeoGerencia]        = useState(null);
  const [nomeGerencia,       setNomeGerencia]       = useState("");
  const [cpfGerencia,        setCpfGerencia]        = useState("");
  const [nomeAssinConstrutora, setNomeAssinConstrutora] = useState("Diego Amaral");

  function avancar() {
    if (passo === 1) {
      if (!juncaoLocal.trim() || !endereco.trim()) { alert("Informe ao menos Junção/Local e Endereço."); return; }
    }
    if (passo === 2) {
      if (!escopo.trim()) { alert("Descreva o escopo dos serviços."); return; }
    }
    if (passo === 3) {
      if (!assinConstrutora) { alert("A Construtora/Executora precisa assinar."); return; }
    }
    if (passo === 4) {
      if (!assinGerencia)     { alert("A Gerência precisa assinar."); return; }
      if (!geoGerencia)       { alert("Confirme a localização do dispositivo para autenticar."); return; }
      if (!nomeGerencia.trim()) { alert("Informe o nome do responsável."); return; }
      if (!cpfGerencia.trim())  { alert("CPF do responsável é obrigatório."); return; }
      onSalvar({
        modelo: "termo_recebimento",
        numero: `TR-${Date.now()}`,
        data: new Date().toLocaleString("pt-BR"),
        geradaEm: new Date().toISOString(),
        juncaoLocal, nrProcesso, endereco, tipoServico, areaIntervencao,
        respPatrimonioProjeto, respPatrimonioObra, acompanhamento,
        respGerenciadora, contatoGerenciadora,
        inicioObra: obra?.inicio || "", terminoObra: obra?.termino || "",
        inicioEfetivo, terminoEfetivo,
        escopo, avPatrimonio, avConstrutora, avGerenciadora, avOutros, comentarios,
        assinGerencia, assinConstrutora, assinGerenciadora,
        geoGerencia, nomeGerencia, cpfGerencia, nomeAssinConstrutora,
      });
      return;
    }
    setPasso(p => p + 1);
  }

  const PASSOS = ["Informações", "Escopo & Avaliação", "Assin. Construtora", "Assin. Gerência"];
  const dataHora = new Date().toLocaleString("pt-BR");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Cabeçalho */}
      <div style={{ background: "#185FA5", borderRadius: 8, padding: 12, color: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>TERMO DE RECEBIMENTO DEFINITIVO</div>
        <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>AFINE – A.F. Nery Arquitetura e Construção · {dataHora}</div>
        <div style={{ fontSize: 11, marginTop: 6, opacity: .85 }}>
          Construtora/Executora: <strong>AFINE</strong> · Resp.: <strong>Diego Amaral</strong> · (11) 99188-5538
        </div>
      </div>

      {/* Indicador de passos */}
      <div style={{ display: "flex", gap: 4 }}>
        {PASSOS.map((l, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center", fontSize: 9, padding: "4px 2px", borderRadius: 6,
            background: passo === i + 1 ? "#185FA5" : passo > i + 1 ? "var(--verde-lt)" : "var(--cinza-lt)",
            color: passo === i + 1 ? "#fff" : passo > i + 1 ? "var(--verde)" : "#9CA3AF",
            fontWeight: 500,
          }}>
            {passo > i + 1 ? "✓ " : ""}{l}
          </div>
        ))}
      </div>

      {/* ── PASSO 1 — Informações gerais ── */}
      {passo === 1 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#185FA5", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Informações Gerais
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="required">Junção / Local</label>
              <input value={juncaoLocal} onChange={e => setJuncaoLocal(e.target.value)} placeholder="Ex: AG-1407 · Vila Barros"/>
            </div>
            <div className="form-group">
              <label>Nº Processo / OT</label>
              <input value={nrProcesso} onChange={e => setNrProcesso(e.target.value)} placeholder="Ex: OT-0001"/>
            </div>
            <div className="form-group span-2">
              <label className="required">Endereço</label>
              <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, nº, Cidade – UF"/>
            </div>
            <div className="form-group">
              <label>Tipo de Serviço</label>
              <select value={tipoServico} onChange={e => setTipoServico(e.target.value)}>
                <option value="">Selecione...</option>
                <option>Alteração de Layout</option>
                <option>Projeto estratégico</option>
                <option>Descaracterização de imóveis</option>
                <option>Devolução de imóveis</option>
                <option>Devolução de imóveis - BSP</option>
              </select>
            </div>
            <div className="form-group">
              <label>Área de Intervenção</label>
              <input value={areaIntervencao} onChange={e => setAreaIntervencao(e.target.value)} placeholder="Ex: 220 m²"/>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#185FA5", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Patrimônio / Responsáveis
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Responsável de Projeto (Patrimônio)</label>
              <input value={respPatrimonioProjeto} onChange={e => setRespPatrimonioProjeto(e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Responsável de Obra (Patrimônio)</label>
              <input value={respPatrimonioObra} onChange={e => setRespPatrimonioObra(e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Acompanhamento da Obra</label>
              <input value={acompanhamento} onChange={e => setAcompanhamento(e.target.value)} placeholder="Nome do fiscal/gestor"/>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#185FA5", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Gerenciadora / Mantenedora
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Responsável</label>
              <input value={respGerenciadora} onChange={e => setRespGerenciadora(e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Contato</label>
              <input value={contatoGerenciadora} onChange={e => setContatoGerenciadora(e.target.value)} placeholder="(11) 9xxxx-xxxx"/>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#185FA5", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Datas
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <div className="form-group">
              <label style={{ fontSize: 10 }}>Início previsto</label>
              <input type="date" value={obra?.inicio || ""} disabled style={{ background: "var(--cinza-lt)", fontSize: 12 }}/>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 10 }}>Término previsto</label>
              <input type="date" value={obra?.termino || ""} disabled style={{ background: "var(--cinza-lt)", fontSize: 12 }}/>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 10 }}>Início efetivo</label>
              <input type="date" value={inicioEfetivo} onChange={e => setInicioEfetivo(e.target.value)} style={{ fontSize: 12 }}/>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 10 }}>Término efetivo</label>
              <input type="date" value={terminoEfetivo} onChange={e => setTerminoEfetivo(e.target.value)} style={{ fontSize: 12 }}/>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onFechar}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={avancar}>Próximo →</button>
          </div>
        </>
      )}

      {/* ── PASSO 2 — Escopo e Avaliação ── */}
      {passo === 2 && (
        <>
          <div style={{ background: "var(--cinza-lt)", borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.6, color: "#4A4A4A" }}>
            Constatamos que a obra realizada na dependência considera-se <strong>recebida</strong> conforme execução do escopo abaixo. Este documento não tem propriedades avaliativas técnicas, apenas quanto ao acompanhamento e entrega do escopo acordado.
          </div>

          <div className="form-group">
            <label className="required">Escopo dos principais serviços executados</label>
            <textarea value={escopo} onChange={e => setEscopo(e.target.value)} rows={5}
              placeholder="Descreva os serviços realizados..."/>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "#185FA5", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Avaliação pela Gerência do Recebimento
          </div>
          {[
            ["Patrimônio", avPatrimonio, setAvPatrimonio],
            ["Construtora / Empresa executora", avConstrutora, setAvConstrutora],
            ["Gerenciadora / Mantenedora", avGerenciadora, setAvGerenciadora],
            ["Outros", avOutros, setAvOutros],
          ].map(([label, val, setVal]) => (
            <div key={label}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {AVALIACOES.map(av => (
                  <button key={av} type="button" onClick={() => setVal(av)}
                    style={{
                      padding: "5px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer",
                      border: `2px solid ${val === av ? "#185FA5" : "var(--border)"}`,
                      background: val === av ? "#185FA5" : "transparent",
                      color: val === av ? "#fff" : "#4A4A4A", fontWeight: val === av ? 600 : 400,
                    }}>
                    {av}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="form-group">
            <label>Comentários <span style={{ fontSize: 10, color: "#9CA3AF" }}>(obrigatório se Regular ou Ruim)</span></label>
            <textarea value={comentarios} onChange={e => setComentarios(e.target.value)} rows={3}
              placeholder="Justifique avaliações Ruim ou Regular..."/>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setPasso(1)}>← Voltar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={avancar}>Próximo →</button>
          </div>
        </>
      )}

      {/* ── PASSO 3 — Assinatura Construtora/Executora ── */}
      {passo === 3 && (
        <>
          <div className="alert alert-info" style={{ fontSize: 12 }}>
            ✍️ Assinatura da <strong>Construtora/Executora (AFINE)</strong>
          </div>
          <div className="form-group">
            <label>Nome do signatário</label>
            <input value={nomeAssinConstrutora} onChange={e => setNomeAssinConstrutora(e.target.value)}/>
          </div>
          <AssinaturaDigital
            label="Assinatura da Construtora/Executora"
            assinatura={assinConstrutora}
            onChange={setAssinConstrutora}
          />
          <div style={{ background: "var(--cinza-lt)", borderRadius: 8, padding: 10, fontSize: 12, color: "#7A7A7A", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ fontSize: 16 }}>📄</span>
            <span>A assinatura da <strong>Gerenciadora / Mantenedora</strong> é opcional neste momento — poderá ser coletada posteriormente no PDF impresso.</span>
          </div>
          <AssinaturaDigital
            label="Assinatura da Gerenciadora / Mantenedora (opcional)"
            assinatura={assinGerenciadora}
            onChange={setAssinGerenciadora}
            opcional
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setPasso(2)}>← Voltar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={avancar}>Próximo →</button>
          </div>
        </>
      )}

      {/* ── PASSO 4 — Assinatura Gerência da dependência ── */}
      {passo === 4 && (
        <>
          <div className="alert alert-warning" style={{ fontSize: 12 }}>
            📱 <strong>Entregue o dispositivo ao representante da dependência</strong> para assinar. A localização será solicitada para autenticar a assinatura.
          </div>
          <div className="form-group">
            <label className="required">Nome do responsável / gerente</label>
            <input value={nomeGerencia} onChange={e => setNomeGerencia(e.target.value)} placeholder="Nome completo"/>
          </div>
          <div className="form-group">
            <label className="required">CPF</label>
            <input value={cpfGerencia} onChange={e => setCpfGerencia(e.target.value)} placeholder="000.000.000-00"/>
          </div>
          <AssinaturaDigital
            label="Assinatura da Gerência / Dependência"
            assinatura={assinGerencia}
            onChange={setAssinGerencia}
            requererLocalizacao
            geoInicial={geoGerencia}
            onGeoChange={setGeoGerencia}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={() => setPasso(3)}>← Voltar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center", background: "var(--verde)", borderColor: "var(--verde)" }} onClick={avancar}>
              ✓ Finalizar Termo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
