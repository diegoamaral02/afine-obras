// src/pages/Compras.js — v5: permissões revisadas + recusa/revisão + rastreio por etapa + PDF
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { getAcesso } from "../constants/departamentos";

// ── Regras de aprovação ───────────────────────────────────────────────────────
// Para MANUTENÇÃO: todos menos campo podem aprovar
// Para OBRA: apenas ADM pode aprovar
function podeAprovar(userProfile, demandaTipo) {
  const dep = userProfile?.departamento || userProfile?.perfil || "campo";
  const adm = userProfile?.adm === true;
  if (adm) return true;
  if (demandaTipo === "obra") return false; // só ADM aprova obras
  // Manutenção: todos menos campo
  return !["campo"].includes(dep);
}

// Quem pode avançar para cotação — todos
function podeEnviarCotacao() { return true; }

// Rastreio: campo padrão por etapa
function traceField(etapa) {
  return {
    "SOLICITAÇÃO":     { ator:"atorSolicitacao",     em:"solicitadoEm" },
    "COTAÇÃO":         { ator:"atorCotacao",          em:"cotadoEm" },
    "APROVADA":        { ator:"atorAprovacao",        em:"aprovadoEm" },
    "ORDEM DE COMPRA": { ator:"atorOC",               em:"ocEm" },
    "RECEBIDO":        { ator:"atorRecebimento",      em:"recebidoEm" },
    "AGUARD. NF":      { ator:"atorAguardNF",         em:"aguardNFEm" },
    "NF VINCULADA":    { ator:"atorNFVinculada",      em:"nfVinculadaEm" },
  }[etapa] || {};
}

// ── Geração de PDF ────────────────────────────────────────────────────────────
function gerarPDFCompra(compra) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para gerar o PDF."); return; }

  const fmt = v => v ? `R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})}` : "–";
  const dt  = v => v ? new Date(v).toLocaleString("pt-BR") : "–";
  const dtD = v => v ? new Date(v+"T12:00").toLocaleDateString("pt-BR") : "–";

  const ETAPAS_PDF = [
    { id:"SOLICITAÇÃO",     label:"Solicitação",      ator:"atorSolicitacao",    em:"solicitadoEm",  icone:"📝" },
    { id:"COTAÇÃO",         label:"Cotação",           ator:"atorCotacao",        em:"cotadoEm",      icone:"💬" },
    { id:"APROVADA",        label:"Aprovação",         ator:"atorAprovacao",      em:"aprovadoEm",    icone:"✅" },
    { id:"ORDEM DE COMPRA", label:"Ordem de Compra",   ator:"atorOC",             em:"ocEm",          icone:"📋" },
    { id:"RECEBIDO",        label:"Recebimento",       ator:"atorRecebimento",    em:"recebidoEm",    icone:"📦" },
    { id:"AGUARD. NF",      label:"Aguard. NF",        ator:"atorAguardNF",       em:"aguardNFEm",    icone:"🧾" },
    { id:"NF VINCULADA",    label:"NF Vinculada",      ator:"atorNFVinculada",    em:"nfVinculadaEm", icone:"✔️" },
  ];

  const STATUS_CORES = {
    "SOLICITAÇÃO":"#4A4A4A","COTAÇÃO":"#185FA5","APROVADA":"#C9A200",
    "ORDEM DE COMPRA":"#7B4F00","RECEBIDO":"#2D6A1F",
    "AGUARD. NF":"#1A5A10","NF VINCULADA":"#0F3D0A",
    "RECUSADA":"#B83232","EM REVISÃO":"#8A6000",
  };

  const corStatus = STATUS_CORES[compra.status] || "#4A4A4A";
  const agora = new Date().toLocaleString("pt-BR");

  const itensHTML = (compra.itens||[]).map(it=>
    `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">${it.nome}</td>
     <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right">${it.qtd}</td>
     <td style="padding:5px 8px;border-bottom:1px solid #eee">${it.un}</td></tr>`
  ).join("");

  const timelineHTML = ETAPAS_PDF.filter(e => compra[e.ator]).map(e => `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">
      <div style="width:32px;height:32px;background:${STATUS_CORES[e.id]||"#4A4A4A"};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${e.icone}</div>
      <div>
        <div style="font-weight:700;font-size:13px">${e.label}</div>
        <div style="font-size:12px;color:#555">Por: <strong>${compra[e.ator]||"–"}</strong></div>
        <div style="font-size:11px;color:#888">${dt(compra[e.em])}</div>
      </div>
    </div>
  `).join("");

  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Compra — ${compra.titulo}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:13px;color:#1A1A1A;padding:24px;max-width:800px;margin:0 auto}
.header{background:#1A1A1A;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:18px;font-weight:700;color:#F5C800}
.header p{font-size:11px;opacity:.5;margin-top:4px}
.yellow-bar{background:#F5C800;height:4px;margin-bottom:20px;border-radius:0 0 4px 4px}
.status-badge{display:inline-block;padding:4px 14px;border-radius:20px;color:#fff;font-weight:700;font-size:13px;background:${corStatus}}
.section{margin-bottom:20px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden}
.section-title{background:#f5f5f3;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;border-bottom:1px solid #e0e0e0}
.section-body{padding:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.field label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:2px}
.field strong{font-size:13px;font-weight:600}
table{width:100%;border-collapse:collapse}
th{background:#1A1A1A;color:#F5C800;padding:7px 8px;text-align:left;font-size:11px}
tr:nth-child(even){background:#fafaf8}
.recusa{background:#FCEBEB;border:1px solid #F5C2C2;border-radius:8px;padding:12px;margin-bottom:16px}
.footer{text-align:center;font-size:10px;color:#aaa;margin-top:24px;padding-top:12px;border-top:1px solid #eee}
@media print{button{display:none!important}}
</style></head><body>
<div class="header">
  <div><h1>Pedido de Compra</h1><p>AFINE A.F. Nery Arquitetura e Construção</p></div>
  <div style="text-align:right">
    <span class="status-badge">${compra.status}</span>
    <div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:4px">Emitido: ${agora}</div>
  </div>
</div>
<div class="yellow-bar"></div>

<div class="section">
  <div class="section-title">Identificação</div>
  <div class="section-body">
    <div class="grid">
      <div class="field"><label>Título</label><strong>${compra.titulo||"–"}</strong></div>
      <div class="field"><label>Demanda vinculada</label><strong>${compra.demandaNome||compra.demandaTipo||"–"}</strong></div>
      <div class="field"><label>Urgência</label><strong>${compra.urgencia||"normal"}</strong></div>
      <div class="field"><label>Criado em</label><strong>${dt(compra.createdAt)}</strong></div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Itens solicitados</div>
  <div class="section-body" style="padding:0">
    <table>
      <thead><tr><th>Item</th><th style="text-align:right">Qtd.</th><th>Un.</th></tr></thead>
      <tbody>${itensHTML||"<tr><td colspan='3' style='padding:10px;color:#888'>Nenhum item</td></tr>"}</tbody>
    </table>
  </div>
</div>

${compra.fornecedorNome||compra.valorCotado?`
<div class="section">
  <div class="section-title">Cotação</div>
  <div class="section-body">
    <div class="grid">
      <div class="field"><label>Fornecedor</label><strong>${compra.fornecedorNome||"–"}</strong></div>
      <div class="field"><label>Valor cotado</label><strong>${fmt(compra.valorCotado)}</strong></div>
      <div class="field"><label>Prazo de entrega</label><strong>${dtD(compra.prazoEntrega)}</strong></div>
      <div class="field"><label>Responsável</label><strong>${compra.atorCotacao||"–"}</strong></div>
    </div>
    ${compra.obsCotacao?`<p style="margin-top:8px;font-size:12px;color:#555"><em>${compra.obsCotacao}</em></p>`:""}
  </div>
</div>`:""}

${compra.valorAprovado?`
<div class="section">
  <div class="section-title">Aprovação</div>
  <div class="section-body">
    <div class="grid">
      <div class="field"><label>Valor aprovado</label><strong style="color:#2D6A1F">${fmt(compra.valorAprovado)}</strong></div>
      <div class="field"><label>Forma de pagamento</label><strong>${compra.formaPagamento||"–"}</strong></div>
      <div class="field"><label>Aprovado por</label><strong>${compra.atorAprovacao||"–"}</strong></div>
      <div class="field"><label>Data aprovação</label><strong>${dt(compra.aprovadoEm)}</strong></div>
    </div>
    ${compra.obsAprovacao?`<p style="margin-top:8px;font-size:12px;color:#555"><em>${compra.obsAprovacao}</em></p>`:""}
  </div>
</div>`:""}

${compra.numeroPedido?`
<div class="section">
  <div class="section-title">Ordem de Compra</div>
  <div class="section-body">
    <div class="grid">
      <div class="field"><label>Número OC</label><strong>${compra.numeroPedido}</strong></div>
      <div class="field"><label>Prazo confirmado</label><strong>${dtD(compra.prazoOC)}</strong></div>
      <div class="field"><label>Emitido por</label><strong>${compra.atorOC||"–"}</strong></div>
      <div class="field"><label>Data emissão</label><strong>${dt(compra.ocEm)}</strong></div>
    </div>
    ${compra.obsOC?`<p style="margin-top:8px;font-size:12px;color:#555"><em>${compra.obsOC}</em></p>`:""}
  </div>
</div>`:""}

${compra.dataRecebimento?`
<div class="section">
  <div class="section-title">Recebimento</div>
  <div class="section-body">
    <div class="grid">
      <div class="field"><label>Data</label><strong>${dtD(compra.dataRecebimento)}</strong></div>
      <div class="field"><label>Resultado</label><strong>${compra.tipoReceb==="conforme"?"✅ Conforme":compra.tipoReceb==="troca"?"🔄 Troca":"↩️ Devolução"}</strong></div>
      <div class="field"><label>Conferido por</label><strong>${compra.atorRecebimento||"–"}</strong></div>
    </div>
    ${compra.obsReceb?`<p style="margin-top:8px;font-size:12px;color:#B83232"><strong>Observação:</strong> ${compra.obsReceb}</p>`:""}
  </div>
</div>`:""}

${compra.numeroNF?`
<div class="section">
  <div class="section-title">Nota Fiscal</div>
  <div class="section-body">
    <div class="grid">
      <div class="field"><label>Número NF</label><strong>${compra.numeroNF}</strong></div>
      <div class="field"><label>Valor NF</label><strong>${fmt(compra.valorNF)}</strong></div>
      <div class="field"><label>Data emissão</label><strong>${dtD(compra.dataNF)}</strong></div>
      <div class="field"><label>Vinculado por</label><strong>${compra.atorNFVinculada||compra.atorAguardNF||"–"}</strong></div>
    </div>
    ${compra.obsNF?`<p style="margin-top:8px;font-size:12px;color:#555"><em>${compra.obsNF}</em></p>`:""}
  </div>
</div>`:""}

${compra.motivoRecusa?`
<div class="recusa">
  <strong style="color:#B83232">⚠️ ${compra.status==="RECUSADA"?"Recusada":"Em revisão"}</strong>
  <p style="margin-top:6px;font-size:12px">${compra.motivoRecusa}</p>
  <p style="font-size:11px;color:#888;margin-top:4px">Por: ${compra.atorRecusa||"–"} · ${dt(compra.recusadoEm)}</p>
</div>`:""}

<div class="section">
  <div class="section-title">Trilha de aprovação</div>
  <div class="section-body">${timelineHTML||"<p style='color:#888;font-size:12px'>Sem registros</p>"}</div>
</div>

<div class="footer">
  AFINE A.F. Nery Arquitetura e Construção · Documento gerado em ${agora}
</div>
<br>
<div style="text-align:center">
  <button onclick="window.print()" style="background:#1A1A1A;color:#F5C800;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px">🖨️ Imprimir / Salvar PDF</button>
  <button onclick="window.close()" style="background:#eee;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer">Fechar</button>
</div>
</body></html>`);
  w.document.close();
}

// ── Definição das etapas ──────────────────────────────────────────────────────
const ETAPAS = [
  { id:"SOLICITAÇÃO",     label:"Solicitação",     icone:"📝", cor:"#4A4A4A", proximaLabel:"Enviar para Cotação →",      proxima:"COTAÇÃO" },
  { id:"COTAÇÃO",         label:"Cotação",          icone:"💬", cor:"#185FA5", proximaLabel:"Enviar para Aprovação →",    proxima:"APROVADA" },
  { id:"APROVADA",        label:"Aprovada",         icone:"✅", cor:"#C9A200", proximaLabel:"Gerar Ordem de Compra →",    proxima:"ORDEM DE COMPRA" },
  { id:"ORDEM DE COMPRA", label:"Ordem de Compra",  icone:"📋", cor:"#7B4F00", proximaLabel:"Confirmar Recebimento →",   proxima:"RECEBIDO" },
  { id:"RECEBIDO",        label:"Recebido",         icone:"📦", cor:"#2D6A1F", proximaLabel:"Enviar para Aguard. NF →",  proxima:"AGUARD. NF" },
  { id:"AGUARD. NF",      label:"Aguard. NF",       icone:"🧾", cor:"#1A5A10", proximaLabel:"Concluir (NF Vinculada) →", proxima:"NF VINCULADA" },
  { id:"NF VINCULADA",    label:"NF Vinculada",     icone:"✔️", cor:"#0F3D0A", proximaLabel:null,                        proxima:null },
  { id:"RECUSADA",        label:"Recusada",         icone:"❌", cor:"#B83232", proximaLabel:null,                        proxima:null },
  { id:"EM REVISÃO",      label:"Em revisão",       icone:"🔄", cor:"#8A6000", proximaLabel:"Reenviar como solicitação →",proxima:"SOLICITAÇÃO" },
];

const ETAPAS_BARRA = ETAPAS.filter(e=>!["RECUSADA","EM REVISÃO"].includes(e.id));

// ── Modal principal ───────────────────────────────────────────────────────────
function CompraModal({ compra, obras, manutencoes, fornecedores, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const isNova   = !compra?.id;
  const etapaAtual = isNova ? "SOLICITAÇÃO" : (compra?.status || "SOLICITAÇÃO");
  const etapaInfo  = ETAPAS.find(e=>e.id===etapaAtual);
  const nomeUser   = userProfile?.nome || currentUser?.email || "–";
  const agora      = () => new Date().toISOString();

  // Campos de formulário
  const [titulo,         setTitulo]         = useState(compra?.titulo          || "");
  const [demandaTipo,    setDemandaTipo]     = useState(compra?.demandaTipo     || "obra");
  const [demandaId,      setDemandaId]       = useState(compra?.demandaId       || "");
  const [urgencia,       setUrgencia]        = useState(compra?.urgencia        || "normal");
  const [obs,            setObs]             = useState(compra?.obs             || "");
  const [itens,          setItens]           = useState(compra?.itens           || []);
  // Cotação
  const [fornecedorId,   setFornecedorId]    = useState(compra?.fornecedorId    || "");
  const [valorCotado,    setValorCotado]     = useState(compra?.valorCotado     || "");
  const [prazoEntrega,   setPrazoEntrega]    = useState(compra?.prazoEntrega    || "");
  const [obsCotacao,     setObsCotacao]      = useState(compra?.obsCotacao      || "");
  // Aprovação
  const [valorAprovado,  setValorAprovado]   = useState(compra?.valorAprovado   || "");
  const [formaPagamento, setFormaPagamento]  = useState(compra?.formaPagamento  || "");
  const [obsAprovacao,   setObsAprovacao]    = useState(compra?.obsAprovacao    || "");
  // OC
  const [numeroPedido,   setNumeroPedido]    = useState(compra?.numeroPedido    || "");
  const [prazoOC,        setPrazoOC]         = useState(compra?.prazoOC         || "");
  const [obsOC,          setObsOC]           = useState(compra?.obsOC           || "");
  // Recebimento
  const [tipoReceb,      setTipoReceb]       = useState(compra?.tipoReceb       || "conforme");
  const [dataRecebimento,setDataRecebimento] = useState(compra?.dataRecebimento || new Date().toISOString().split("T")[0]);
  const [obsReceb,       setObsReceb]        = useState(compra?.obsReceb        || "");
  // NF
  const [numeroNF,       setNumeroNF]        = useState(compra?.numeroNF        || "");
  const [valorNF,        setValorNF]         = useState(compra?.valorNF         || "");
  const [dataNF,         setDataNF]          = useState(compra?.dataNF          || "");
  const [obsNF,          setObsNF]           = useState(compra?.obsNF           || "");
  // Recusa / Revisão
  const [modalRecusa,    setModalRecusa]     = useState(null); // null | "recusa" | "revisao"
  const [motivoRecusa,   setMotivoRecusa]    = useState("");
  const [saving,         setSaving]          = useState(false);
  // Itens
  const [itemNome,       setItemNome]        = useState("");
  const [itemQtd,        setItemQtd]         = useState("");
  const [itemUn,         setItemUn]          = useState("un");

  const demandas = demandaTipo === "obra" ? obras : manutencoes;
  const fornSel  = fornecedores.find(f=>f.id===fornecedorId);
  const canAprovar = podeAprovar(userProfile, demandaTipo);

  function addItem() {
    if (!itemNome||!itemQtd) { alert("Informe o item e a quantidade."); return; }
    setItens(p=>[...p,{nome:itemNome,qtd:Number(itemQtd),un:itemUn}]);
    setItemNome(""); setItemQtd("");
  }

  function buildPayload(novoStatus) {
    const base = {
      titulo, demandaTipo, demandaId,
      demandaNome: demandas.find(d=>d.id===demandaId)?.nome||demandas.find(d=>d.id===demandaId)?.titulo||compra?.demandaNome||"",
      urgencia, obs, itens,
      fornecedorId, fornecedorNome:fornSel?.razaoSocial||compra?.fornecedorNome||"",
      valorCotado:Number(valorCotado)||compra?.valorCotado||0, prazoEntrega, obsCotacao,
      valorAprovado:Number(valorAprovado)||compra?.valorAprovado||0, formaPagamento, obsAprovacao,
      numeroPedido, prazoOC, obsOC,
      tipoReceb, dataRecebimento, obsReceb,
      numeroNF, valorNF:Number(valorNF)||0, dataNF, obsNF,
      status: novoStatus || etapaAtual,
      autorNome: compra?.autorNome || nomeUser,
      updatedAt: agora(),
    };
    // FIX: grava o ator da etapa ATUAL (quem executa esta etapa), não a próxima
    if (novoStatus && novoStatus !== etapaAtual) {
      const tfAtual = traceField(etapaAtual);
      if (tfAtual.ator && !base[tfAtual.ator]) {
        base[tfAtual.ator] = nomeUser;
        base[tfAtual.em]   = agora();
      }
    }
    // Preservar todos os atorXXX já gravados
    if (compra) {
      ["atorSolicitacao","solicitadoEm","atorCotacao","cotadoEm","atorAprovacao","aprovadoEm",
       "atorOC","ocEm","atorRecebimento","recebidoEm","atorAguardNF","aguardNFEm",
       "atorNFVinculada","nfVinculadaEm"].forEach(k=>{
        if (compra[k] && !base[k]) base[k] = compra[k];
      });
    }
    return base;
  }

  async function salvar(novoStatus) {
    if (!titulo) { alert("Informe o título."); return; }
    if (isNova && !itens.length) { alert("Adicione pelo menos 1 item."); return; }
    // Validação de aprovação
    if (novoStatus === "APROVADA" && !canAprovar) {
      alert(demandaTipo==="obra"
        ? "Somente o ADM pode aprovar compras vinculadas a obras."
        : "Você não tem permissão para aprovar esta compra.");
      return;
    }
    setSaving(true);
    try {
      const data = buildPayload(novoStatus);
      if (compra?.id) {
        await updateDoc(doc(db,"compras",compra.id), data);
        addToast(novoStatus && novoStatus!==etapaAtual ? `✓ Movido para: ${novoStatus}` : "Salvo!");
      } else {
        data.createdAt = agora();
        data.atorSolicitacao = nomeUser;
        data.solicitadoEm    = agora();
        await addDoc(collection(db,"compras"), data);
        addToast("✓ Solicitação criada!");
      }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  async function recusarOuRevisar(tipo) {
    if (!motivoRecusa.trim()) { alert(`Informe o motivo ${tipo==="recusa"?"da recusa":"da revisão"}.`); return; }
    setSaving(true);
    const novoStatus = tipo==="recusa" ? "RECUSADA" : "EM REVISÃO";
    try {
      await updateDoc(doc(db,"compras",compra.id), {
        status:       novoStatus,
        motivoRecusa: motivoRecusa,
        atorRecusa:   nomeUser,
        recusadoEm:   agora(),
        updatedAt:    agora(),
      });
      addToast(tipo==="recusa"?"Compra recusada.":"Enviado para revisão.");
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  const fmt = v => v ? `R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})}` : "";

  // Pode recusar/revisar: quem pode aprovar pode também recusar
  const podeRecusar = !isNova && canAprovar && !["RECUSADA","NF VINCULADA"].includes(etapaAtual);

  return (
    <Modal title={isNova?"Nova solicitação de compra":compra.titulo} onClose={onClose}
      footer={
        <div style={{display:"flex",gap:8,width:"100%",justifyContent:"space-between",flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:6}}>
            <button className="btn" onClick={onClose}>Fechar</button>
            {/* PDF */}
            {!isNova && (
              <button className="btn btn-sm" onClick={()=>gerarPDFCompra({...compra,...buildPayload(null)})} title="Gerar PDF">
                📄 PDF
              </button>
            )}
            {/* Recusar / Revisar */}
            {podeRecusar && (
              <>
                <button className="btn btn-sm" onClick={()=>setModalRecusa("revisao")}
                  style={{background:"var(--afine-yellow-lt)",borderColor:"var(--afine-yellow-dk)",color:"var(--afine-yellow-dk)"}}>
                  🔄 Revisão
                </button>
                <button className="btn btn-sm" onClick={()=>setModalRecusa("recusa")}
                  style={{background:"var(--vermelho-lt)",borderColor:"rgba(184,50,50,.3)",color:"var(--vermelho)"}}>
                  ❌ Recusar
                </button>
              </>
            )}
          </div>
          <div style={{display:"flex",gap:8}}>
            {!isNova && <button className="btn" onClick={()=>salvar(etapaAtual)} disabled={saving}>Salvar rascunho</button>}
            {isNova
              ? <button className="btn btn-primary" onClick={()=>salvar("SOLICITAÇÃO")} disabled={saving}>{saving?"Criando...":"✓ Criar solicitação"}</button>
              : etapaInfo?.proxima
                ? (() => {
                    const podeEtapa = etapaInfo.proxima === "APROVADA" ? canAprovar : true;
                    return (
                      <button className="btn btn-primary" onClick={()=>salvar(etapaInfo.proxima)} disabled={saving||!podeEtapa}
                        title={!podeEtapa?(demandaTipo==="obra"?"Apenas ADM pode aprovar obras":"Sem permissão"):""}
                        style={{opacity:podeEtapa?1:.5}}>
                        {saving?"Salvando...":etapaInfo.proximaLabel}
                      </button>
                    );
                  })()
                : etapaAtual==="EM REVISÃO"
                  ? <button className="btn btn-primary" onClick={()=>salvar("SOLICITAÇÃO")} disabled={saving}>↩️ Reenviar para Solicitação</button>
                  : null
            }
          </div>
        </div>
      }>

      {/* Sub-modal recusa/revisão */}
      {modalRecusa && (
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:420,boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:6,color:modalRecusa==="recusa"?"var(--vermelho)":"var(--afine-yellow-dk)"}}>
              {modalRecusa==="recusa"?"❌ Recusar compra":"🔄 Solicitar revisão"}
            </div>
            <p style={{fontSize:12,color:"#7A7A7A",marginBottom:14}}>
              {modalRecusa==="recusa"
                ?"A compra será marcada como RECUSADA. Informe o motivo:"
                :"A compra voltará para o solicitante revisar. Informe o que precisa ser corrigido:"}
            </p>
            <textarea value={motivoRecusa} onChange={e=>setMotivoRecusa(e.target.value)} rows={4}
              placeholder={`Motivo ${modalRecusa==="recusa"?"da recusa":"da revisão"}... (obrigatório)`}
              style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`2px solid ${modalRecusa==="recusa"?"var(--vermelho)":"var(--afine-yellow-dk)"}`,
                fontSize:13,fontFamily:"inherit",resize:"vertical"}}/>
            <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}>
              <button className="btn" onClick={()=>{setModalRecusa(null);setMotivoRecusa("");}}>Cancelar</button>
              <button onClick={()=>recusarOuRevisar(modalRecusa)} disabled={saving||!motivoRecusa.trim()}
                className="btn btn-primary"
                style={{background:modalRecusa==="recusa"?"var(--vermelho)":"var(--afine-yellow-dk)",
                  opacity:!motivoRecusa.trim()?.5:1}}>
                {saving?"Salvando...":modalRecusa==="recusa"?"Confirmar recusa":"Enviar para revisão"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Badge de etapa */}
        {!isNova && (
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
            background:etapaInfo?.cor||"#4A4A4A",borderRadius:8,color:"#fff"}}>
            <span style={{fontSize:18}}>{etapaInfo?.icone}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700}}>{etapaInfo?.label}</div>
              {etapaInfo?.proxima && <div style={{fontSize:10,opacity:.6}}>Próximo: {etapaInfo.proxima}</div>}
            </div>
            {/* Rastreio do responsável por esta etapa */}
            {(() => {
              const tf = traceField(etapaAtual);
              return compra?.[tf.ator]
                ? <div style={{fontSize:10,textAlign:"right",opacity:.7}}>por {compra[tf.ator]}</div>
                : null;
            })()}
          </div>
        )}

        {/* Alerta de recusa/revisão */}
        {compra?.motivoRecusa && (
          <div style={{background:"var(--vermelho-lt)",border:"1px solid rgba(184,50,50,.3)",borderRadius:8,padding:10,fontSize:12}}>
            <strong style={{color:"var(--vermelho)"}}>
              {compra.status==="RECUSADA"?"❌ Recusada":"🔄 Em revisão"} por {compra.atorRecusa}
            </strong>
            <p style={{marginTop:4,color:"#4A4A4A"}}>{compra.motivoRecusa}</p>
          </div>
        )}

        {/* ── SOLICITAÇÃO ─────────────────────────────── */}
        {(isNova || etapaAtual==="SOLICITAÇÃO" || etapaAtual==="EM REVISÃO") && (
          <>
            <div className="form-group">
              <label className="required">Título da compra</label>
              <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Ex: Cabos elétricos — AG 0442"/>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Vinculado a</label>
                <select value={demandaTipo} onChange={e=>{setDemandaTipo(e.target.value);setDemandaId("");}}>
                  <option value="obra">Obra</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="geral">Estoque geral</option>
                </select>
              </div>
              {demandaTipo!=="geral" && (
                <div className="form-group">
                  <label>Qual {demandaTipo==="obra"?"obra":"manutenção"}?</label>
                  <select value={demandaId} onChange={e=>setDemandaId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {demandas.map(d=><option key={d.id} value={d.id}>{d.nome||d.titulo}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Urgência</label>
                <select value={urgencia} onChange={e=>setUrgencia(e.target.value)}>
                  {["baixa","normal","alta","urgente"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Itens solicitados</div>
            <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
              <div className="form-group" style={{flex:2}}><label>Item</label><input value={itemNome} onChange={e=>setItemNome(e.target.value)} placeholder="Ex: Cabo 10mm²"/></div>
              <div className="form-group" style={{width:80}}><label>Qtd.</label><input type="number" min="1" value={itemQtd} onChange={e=>setItemQtd(e.target.value)}/></div>
              <div className="form-group" style={{width:80}}><label>Un.</label>
                <select value={itemUn} onChange={e=>setItemUn(e.target.value)}>
                  {["un","m","m²","kg","saco","cx","rolo","litro"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addItem} style={{marginBottom:1}}>+ Add</button>
            </div>
            {itens.length>0&&(<div className="table-wrap"><table><thead><tr><th>Item</th><th>Qtd.</th><th>Un.</th><th></th></tr></thead>
              <tbody>{itens.map((it,i)=>(
                <tr key={i}><td style={{fontWeight:500}}>{it.nome}</td><td>{it.qtd}</td><td>{it.un}</td>
                  <td><button className="btn btn-sm" style={{color:"var(--vermelho)"}} onClick={()=>setItens(p=>p.filter((_,j)=>j!==i))}>✕</button></td>
                </tr>))}</tbody>
            </table></div>)}
            <div className="form-group"><label>Observações</label><textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}/></div>
          </>
        )}

        {/* ── COTAÇÃO ─────────────────────────────────── */}
        {!isNova && etapaAtual==="COTAÇÃO" && (
          <>
            <ResumoItens itens={compra.itens} demandaNome={compra.demandaNome}/>
            <div style={{fontSize:11,fontWeight:700,color:"#185FA5",textTransform:"uppercase",letterSpacing:".06em"}}>Dados da cotação</div>
            <div className="form-grid">
              <div className="form-group span-2">
                <label className="required">Fornecedor</label>
                <select value={fornecedorId} onChange={e=>setFornecedorId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {fornecedores.filter(f=>f.status!=="BLOQUEADO").map(f=><option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="required">Valor cotado (R$)</label>
                <input type="number" value={valorCotado} onChange={e=>setValorCotado(e.target.value)} placeholder="0,00"/>
              </div>
              <div className="form-group">
                <label>Prazo de entrega</label>
                <input type="date" value={prazoEntrega} onChange={e=>setPrazoEntrega(e.target.value)}/>
              </div>
            </div>
            <div className="form-group"><label>Observações</label><textarea value={obsCotacao} onChange={e=>setObsCotacao(e.target.value)} rows={2} placeholder="Condições negociadas, validade..."/></div>
          </>
        )}

        {/* ── APROVADA ─────────────────────────────────── */}
        {!isNova && etapaAtual==="APROVADA" && (
          <>
            <ResumoItens itens={compra.itens} demandaNome={compra.demandaNome}/>
            <ResumoCotacao valorCotado={compra.valorCotado} fornecedorNome={compra.fornecedorNome} prazoEntrega={compra.prazoEntrega}/>
            {!canAprovar && (
              <div className="alert alert-warning" style={{fontSize:12}}>
                🔒 {demandaTipo==="obra"?"Apenas ADM pode gerar OC para obras.":"Você não tem permissão para gerar a OC."}
              </div>
            )}
            <div className="alert alert-warning" style={{fontSize:12}}>
              ⚠️ Ao gerar a Ordem de Compra, o valor será registrado como comprometido no financeiro.
            </div>
            <div style={{fontSize:11,fontWeight:700,color:"#C9A200",textTransform:"uppercase",letterSpacing:".06em"}}>Dados da aprovação</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="required">Valor aprovado (R$)</label>
                <input type="number" value={valorAprovado} onChange={e=>setValorAprovado(e.target.value)} placeholder={String(compra.valorCotado||"0,00")}/>
                {compra.valorCotado&&valorAprovado&&Math.abs(Number(valorAprovado)-compra.valorCotado)>0.01&&(
                  <span style={{fontSize:11,color:Number(valorAprovado)<compra.valorCotado?"var(--verde)":"var(--vermelho)",fontWeight:600}}>
                    {Number(valorAprovado)<compra.valorCotado?"▼ Economia":"▲ Acréscimo"}: R$ {Math.abs(Number(valorAprovado)-compra.valorCotado).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>Forma de pagamento</label>
                <select value={formaPagamento} onChange={e=>setFormaPagamento(e.target.value)}>
                  <option value="">Selecione...</option>
                  {["À vista","30 dias","30/60","30/60/90","Boleto","PIX"].map(f=><option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label>Observações</label><textarea value={obsAprovacao} onChange={e=>setObsAprovacao(e.target.value)} rows={2}/></div>
          </>
        )}

        {/* ── ORDEM DE COMPRA ──────────────────────────── */}
        {!isNova && etapaAtual==="ORDEM DE COMPRA" && (
          <>
            <ResumoItens itens={compra.itens} demandaNome={compra.demandaNome}/>
            <ResumoCotacao valorCotado={compra.valorCotado} fornecedorNome={compra.fornecedorNome} prazoEntrega={compra.prazoEntrega}/>
            {compra.valorAprovado&&<div style={{background:"var(--verde-lt)",borderRadius:8,padding:10,fontSize:12}}>✅ Aprovado: <strong style={{color:"var(--verde)"}}>R$ {Number(compra.valorAprovado).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong>{compra.formaPagamento&&<> · {compra.formaPagamento}</>}</div>}
            <div style={{fontSize:11,fontWeight:700,color:"#7B4F00",textTransform:"uppercase",letterSpacing:".06em"}}>Ordem de Compra</div>
            <div className="form-grid">
              <div className="form-group"><label>Nº do pedido / OC</label><input value={numeroPedido} onChange={e=>setNumeroPedido(e.target.value)} placeholder="OC-2025-001"/></div>
              <div className="form-group"><label>Prazo confirmado</label><input type="date" value={prazoOC} onChange={e=>setPrazoOC(e.target.value)}/></div>
            </div>
            <div className="form-group"><label>Observações</label><textarea value={obsOC} onChange={e=>setObsOC(e.target.value)} rows={2}/></div>
          </>
        )}

        {/* ── RECEBIDO ─────────────────────────────────── */}
        {!isNova && etapaAtual==="RECEBIDO" && (
          <>
            <ResumoItens itens={compra.itens} demandaNome={compra.demandaNome}/>
            {compra.numeroPedido&&<div style={{background:"var(--cinza-lt)",borderRadius:8,padding:10,fontSize:12}}>📋 {compra.numeroPedido}{compra.fornecedorNome&&<> · {compra.fornecedorNome}</>}{compra.prazoOC&&<> · Prazo: {fmtDate(compra.prazoOC)}</>}</div>}
            <div style={{fontSize:11,fontWeight:700,color:"#2D6A1F",textTransform:"uppercase",letterSpacing:".06em"}}>Conferência do recebimento</div>
            <div className="form-group">
              <label className="required">Resultado</label>
              <select value={tipoReceb} onChange={e=>setTipoReceb(e.target.value)}
                style={{fontWeight:600,background:tipoReceb==="conforme"?"var(--verde-lt)":tipoReceb==="troca"?"var(--afine-yellow-lt)":"var(--vermelho-lt)",
                  color:tipoReceb==="conforme"?"var(--verde)":tipoReceb==="troca"?"var(--afine-yellow-dk)":"var(--vermelho)"}}>
                <option value="conforme">✅ Concluído — tudo conforme</option>
                <option value="troca">🔄 Troca — material incorreto ou com defeito</option>
                <option value="devolucao">↩️ Devolução — material não aceito</option>
              </select>
            </div>
            <div className="form-group"><label className="required">Data de recebimento</label><input type="date" value={dataRecebimento} onChange={e=>setDataRecebimento(e.target.value)}/></div>
            {tipoReceb!=="conforme"&&(
              <div className="form-group">
                <label className="required" style={{color:tipoReceb==="troca"?"var(--afine-yellow-dk)":"var(--vermelho)"}}>
                  Motivo {tipoReceb==="troca"?"da troca":"da devolução"}
                </label>
                <textarea value={obsReceb} onChange={e=>setObsReceb(e.target.value)} rows={3}
                  placeholder={tipoReceb==="troca"?"Descreva o problema e o que foi solicitado ao fornecedor...":"Descreva a não conformidade e os próximos passos..."}
                  style={{borderColor:tipoReceb==="troca"?"var(--afine-yellow-dk)":"var(--vermelho)"}}/>
              </div>
            )}
            {tipoReceb==="conforme"&&<div className="form-group"><label>Observações (opcional)</label><textarea value={obsReceb} onChange={e=>setObsReceb(e.target.value)} rows={2}/></div>}
          </>
        )}

        {/* ── AGUARD. NF ───────────────────────────────── */}
        {!isNova && etapaAtual==="AGUARD. NF" && (
          <>
            <ResumoItens itens={compra.itens} demandaNome={compra.demandaNome}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,background:"var(--cinza-lt)",borderRadius:8,padding:10,fontSize:12}}>
              {compra.fornecedorNome&&<span>🤝 <strong>{compra.fornecedorNome}</strong></span>}
              {compra.valorAprovado&&<span>✅ <strong style={{color:"var(--verde)"}}>R$ {Number(compra.valorAprovado).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></span>}
              {compra.numeroPedido&&<span>📋 OC: <strong>{compra.numeroPedido}</strong></span>}
              {compra.dataRecebimento&&<span>📦 Recebido: <strong>{fmtDate(compra.dataRecebimento)}</strong></span>}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:"#1A5A10",textTransform:"uppercase",letterSpacing:".06em"}}>Nota Fiscal</div>
            <div className="form-grid">
              <div className="form-group"><label className="required">Número da NF</label><input value={numeroNF} onChange={e=>setNumeroNF(e.target.value)} placeholder="NF-4521"/></div>
              <div className="form-group">
                <label className="required">Valor da NF (R$)</label>
                <input type="number" value={valorNF} onChange={e=>setValorNF(e.target.value)} placeholder="0,00"/>
                {compra.valorAprovado&&valorNF&&Math.abs(Number(valorNF)-compra.valorAprovado)>0.01&&(
                  <span style={{fontSize:11,color:Number(valorNF)>compra.valorAprovado?"var(--vermelho)":"var(--verde)",fontWeight:600}}>
                    {Number(valorNF)>compra.valorAprovado?"⚠ Acima":"✓ Abaixo"} do aprovado
                  </span>
                )}
              </div>
              <div className="form-group"><label>Data emissão NF</label><input type="date" value={dataNF} onChange={e=>setDataNF(e.target.value)}/></div>
            </div>
            <div className="form-group"><label>Observações</label><textarea value={obsNF} onChange={e=>setObsNF(e.target.value)} rows={2}/></div>
          </>
        )}

        {/* ── NF VINCULADA (concluído) ─────────────────── */}
        {!isNova && etapaAtual==="NF VINCULADA" && (
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{fontSize:44,marginBottom:10}}>✅</div>
            <div style={{fontSize:17,fontWeight:700,color:"var(--verde)",marginBottom:6}}>Compra concluída!</div>
            <div style={{fontSize:12,color:"#7A7A7A",marginBottom:16}}>Arquivada e disponível para consulta.</div>
            <div style={{background:"var(--cinza-lt)",borderRadius:10,padding:14,textAlign:"left",fontSize:12}}>
              {compra.fornecedorNome&&<div style={{marginBottom:5}}>🤝 Fornecedor: <strong>{compra.fornecedorNome}</strong></div>}
              {compra.valorNF&&<div style={{marginBottom:5}}>🧾 Valor NF: <strong>R$ {Number(compra.valorNF).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></div>}
              {compra.numeroNF&&<div style={{marginBottom:5}}>📄 NF: <strong>{compra.numeroNF}</strong></div>}
              {compra.dataRecebimento&&<div>📦 Recebido: <strong>{fmtDate(compra.dataRecebimento)}</strong></div>}
            </div>
          </div>
        )}

        {/* ── RECUSADA ─────────────────────────────────── */}
        {!isNova && etapaAtual==="RECUSADA" && (
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{fontSize:44,marginBottom:10}}>❌</div>
            <div style={{fontSize:17,fontWeight:700,color:"var(--vermelho)",marginBottom:6}}>Compra recusada</div>
            <div style={{background:"var(--vermelho-lt)",border:"1px solid rgba(184,50,50,.3)",borderRadius:10,padding:14,textAlign:"left",fontSize:12,marginTop:12}}>
              <div style={{fontWeight:600,color:"var(--vermelho)",marginBottom:4}}>Motivo da recusa:</div>
              <p>{compra.motivoRecusa}</p>
              <p style={{color:"#888",marginTop:6,fontSize:11}}>Por {compra.atorRecusa} · {fmtDate(compra.recusadoEm?.split("T")[0])}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function ResumoItens({ itens, demandaNome }) {
  if (!itens?.length) return null;
  return (
    <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:10}}>
      {demandaNome&&<div style={{fontSize:11,color:"#7A7A7A",marginBottom:4}}>Pedido · {demandaNome}</div>}
      {itens.slice(0,5).map((it,i)=>(
        <div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"2px 0",borderBottom:i<itens.length-1?"1px solid var(--border)":"none"}}>
          <span style={{flex:1,fontWeight:500}}>{it.nome}</span>
          <span style={{color:"#7A7A7A"}}>{it.qtd} {it.un}</span>
        </div>
      ))}
      {itens.length>5&&<div style={{fontSize:11,color:"#7A7A7A",marginTop:3}}>+{itens.length-5} itens</div>}
    </div>
  );
}

function ResumoCotacao({ valorCotado, fornecedorNome, prazoEntrega }) {
  if (!valorCotado&&!fornecedorNome) return null;
  return (
    <div style={{background:"rgba(24,95,165,.06)",border:"1px solid rgba(24,95,165,.2)",borderRadius:8,padding:10,fontSize:12,display:"flex",gap:16,flexWrap:"wrap"}}>
      {fornecedorNome&&<span>🤝 <strong>{fornecedorNome}</strong></span>}
      {valorCotado&&<span>💬 Cotado: <strong>R$ {Number(valorCotado).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></span>}
      {prazoEntrega&&<span>📅 {fmtDate(prazoEntrega)}</span>}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function Compras() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [compras,      setCompras]      = useState([]);
  const [obras,        setObras]        = useState([]);
  const [manutencoes,  setManutencoes]  = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [etapaAtiva,   setEtapaAtiva]   = useState("SOLICITAÇÃO");
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState(null);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"compras"),snap=>{const d=snap.docs.map(x=>({id:x.id,...x.data()}));d.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));setCompras(d);setLoading(false);});
    const u2=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"manutencoes"),snap=>setManutencoes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4=onSnapshot(collection(db,"fornecedores"),snap=>setFornecedores(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();u4();};
  },[]);

  const comprasFiltradas = useMemo(()=>{
    const q=search.toLowerCase();
    return compras.filter(c=>c.status===etapaAtiva&&(!q||c.titulo?.toLowerCase().includes(q)||c.demandaNome?.toLowerCase().includes(q)||c.fornecedorNome?.toLowerCase().includes(q)));
  },[compras,etapaAtiva,search]);

  const kpis = useMemo(()=>({
    solicit:      compras.filter(c=>c.status==="SOLICITAÇÃO").length,
    cotacao:      compras.filter(c=>c.status==="COTAÇÃO").length,
    aprovadas:    compras.filter(c=>c.status==="APROVADA").length,
    oc:           compras.filter(c=>c.status==="ORDEM DE COMPRA").length,
    aguardNF:     compras.filter(c=>c.status==="AGUARD. NF").length,
    revisao:      compras.filter(c=>c.status==="EM REVISÃO").length,
    recusadas:    compras.filter(c=>c.status==="RECUSADA").length,
    comprometido: compras.filter(c=>["APROVADA","ORDEM DE COMPRA"].includes(c.status)).reduce((s,c)=>s+(c.valorAprovado||0),0),
  }),[compras]);

  const fmt = v=>`R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0})}`;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div><div className="panel-title">Compras</div><div style={{fontSize:12,color:"#7A7A7A"}}>{compras.length} pedidos totais</div></div>
        <button className="btn btn-primary" onClick={()=>setModal({compra:null})}>+ Nova solicitação</button>
      </div>

      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="metric"><div className="metric-label">Solicitações</div><div className="metric-value amber">{kpis.solicit}</div></div>
        <div className="metric"><div className="metric-label">Em cotação</div><div className="metric-value" style={{color:"#185FA5"}}>{kpis.cotacao}</div></div>
        <div className="metric"><div className="metric-label">Aguard. OC</div><div className="metric-value yellow">{kpis.aprovadas}</div></div>
        <div className="metric"><div className="metric-label">Em OC</div><div className="metric-value" style={{color:"#7B4F00"}}>{kpis.oc}</div></div>
        <div className="metric"><div className="metric-label">Aguard. NF</div><div className="metric-value amber">{kpis.aguardNF}</div></div>
        <div className="metric"><div className="metric-label">Em revisão</div><div className="metric-value" style={{color:"#8A6000"}}>{kpis.revisao}</div></div>
        {kpis.recusadas>0&&<div className="metric"><div className="metric-label">Recusadas</div><div className="metric-value red">{kpis.recusadas}</div></div>}
        <div className="metric"><div className="metric-label">Comprometido</div><div className="metric-value red" style={{fontSize:15}}>{fmt(kpis.comprometido)}</div></div>
      </div>

      {/* Barra de etapas */}
      <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:10,overflow:"hidden",border:"1px solid var(--border)"}}>
        {[...ETAPAS_BARRA,{id:"EM REVISÃO",label:"Em revisão",icone:"🔄",cor:"#8A6000"},{id:"RECUSADA",label:"Recusada",icone:"❌",cor:"#B83232"}].map((e,i,arr)=>{
          const count=compras.filter(c=>c.status===e.id).length;
          const ativa=etapaAtiva===e.id;
          return (
            <button key={e.id} onClick={()=>setEtapaAtiva(e.id)}
              style={{flex:1,padding:"10px 4px",border:"none",cursor:"pointer",
                background:ativa?e.cor:"var(--cinza-lt)",color:ativa?"#fff":"#4A4A4A",
                borderRight:i<arr.length-1?"1px solid var(--border)":"none",
                transition:"all .15s",position:"relative"}}>
              <div style={{fontSize:13,marginBottom:1}}>{e.icone}</div>
              <div style={{fontSize:9,fontWeight:700,lineHeight:1.2}}>{e.label}</div>
              {count>0&&<div style={{position:"absolute",top:4,right:4,background:ativa?"rgba(255,255,255,.3)":e.cor,color:"#fff",fontSize:9,fontWeight:700,borderRadius:10,padding:"1px 5px"}}>{count}</div>}
            </button>
          );
        })}
      </div>

      <div className="search-bar">🔍<input placeholder={`Buscar...`} value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"#7A7A7A"}}>✕</button>}</div>

      {loading&&<div className="spinner"/>}
      {!loading&&comprasFiltradas.length===0&&(
        <div className="empty-state">
          <div className="empty-icon">{ETAPAS.find(e=>e.id===etapaAtiva)?.icone||"📋"}</div>
          <p>Nenhuma compra em <strong>{etapaAtiva}</strong></p>
          {etapaAtiva==="SOLICITAÇÃO"&&<button className="btn btn-primary" style={{marginTop:12}} onClick={()=>setModal({compra:null})}>+ Nova solicitação</button>}
        </div>
      )}

      {!loading&&comprasFiltradas.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {comprasFiltradas.map(c=>{
            const ei=ETAPAS.find(e=>e.id===c.status);
            return (
              <div key={c.id} className="rdo-card" style={{borderLeft:`4px solid ${ei?.cor||"#ccc"}`}}>
                <div className="rdo-header">
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{c.titulo}</div>
                    <div style={{fontSize:12,color:"#7A7A7A",marginTop:2}}>
                      {c.demandaNome||c.demandaTipo}{c.fornecedorNome&&<> · <strong>{c.fornecedorNome}</strong></>}
                      {c.autorNome&&<> · {c.autorNome}</>}
                    </div>
                    <div style={{display:"flex",gap:10,marginTop:5,flexWrap:"wrap",fontSize:12}}>
                      {c.urgencia&&c.urgencia!=="normal"&&<span className={`badge ${c.urgencia==="urgente"?"badge-red":c.urgencia==="alta"?"badge-amber":"badge-gray"}`} style={{fontSize:10}}>{c.urgencia}</span>}
                      {c.valorCotado>0&&<span>💬 {fmt(c.valorCotado)}</span>}
                      {c.valorAprovado>0&&<span style={{color:"var(--verde)"}}>✅ {fmt(c.valorAprovado)}</span>}
                      {c.numeroPedido&&<span>📋 {c.numeroPedido}</span>}
                      {c.tipoReceb&&c.tipoReceb!=="conforme"&&<span className="badge badge-amber" style={{fontSize:10}}>⚠ {c.tipoReceb}</span>}
                      {c.numeroNF&&<span>🧾 NF {c.numeroNF}</span>}
                      {c.motivoRecusa&&<span style={{color:"var(--vermelho)",fontSize:11}}>❌ {c.motivoRecusa.slice(0,40)}</span>}
                    </div>
                    {c.itens?.length>0&&<div style={{marginTop:4,fontSize:11,color:"#7A7A7A"}}>{c.itens.slice(0,3).map(it=>`${it.nome} (${it.qtd}${it.un})`).join(" · ")}{c.itens.length>3&&` +${c.itens.length-3}`}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                    <div style={{display:"flex",gap:6}}>
                      <button className="btn btn-sm" onClick={()=>gerarPDFCompra(c)} title="Gerar PDF" style={{padding:"4px 8px"}}>📄</button>
                      <button className="btn btn-sm btn-primary" onClick={()=>setModal({compra:c})}>
                        {["NF VINCULADA","RECUSADA"].includes(c.status)?"👁️ Ver":"✏️ Abrir"}
                      </button>
                    </div>
                    <span style={{fontSize:10,color:"#7A7A7A"}}>{fmtDate(c.updatedAt||c.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal&&<CompraModal compra={modal.compra} obras={obras} manutencoes={manutencoes} fornecedores={fornecedores} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
