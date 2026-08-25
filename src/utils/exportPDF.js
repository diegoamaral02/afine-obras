// src/utils/exportPDF.js
// Gera e exporta OS como PDF usando canvas + window.print()
// Sem bibliotecas externas — funciona 100% no browser
import { LOGO_BASE64 } from "./assets";
import { BRADESCO_BASE64, AFINE_TERMO_BASE64, BARRA_BRADESCO_BASE64 } from "./assetsTermo";
import { CHAVES_LOGO1_BASE64, CHAVES_LOGO2_BASE64, CHAVES_BARRA_BASE64 } from "./assetsChaves";

export function exportarOSParaPDF(os, contexto) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar o PDF."); return; }

  const servicos = [
    ...(os.servicos || []),
    ...(contexto?.descProntas || []),
  ].filter(Boolean);
  const descExtra = os.descricaoExtra || contexto?.descExtra || "";
  const data = new Date(os.geradaEm || Date.now()).toLocaleString("pt-BR");
  const loja = os.loja || contexto?.agencia || contexto?.agenciaNome || "–";
  const otTicket = os.otTicket || (contexto?.semOT ? "S/OT" : contexto?.numeroOT) || contexto?.contrato || "–";
  const dataDoc = (os.geradaEm ? new Date(os.geradaEm) : new Date()).toLocaleDateString("pt-BR");
  const epis = os.epis || [];
  const EPIS_TODOS = [
    "Capacete de segurança","Protetor auricular","Luvas de borracha","Luvas revestida em PU",
    "Máscara PFF2","Óculos de proteção","Cinto de segurança tipo paraquedista","Botina de segurança",
  ];

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>OS ${os.numero}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:28px}
  .header{display:flex;align-items:flex-start;gap:16px;margin-bottom:16px}
  .header img{height:56px;width:auto;border-radius:6px;flex-shrink:0}
  .header .empresa{flex:1;text-align:center}
  .header .empresa h1{font-size:17px;font-weight:800;letter-spacing:.02em}
  .header .empresa .info{font-size:11px;color:#555;margin-top:2px;line-height:1.5}
  .titulo-doc{text-align:center;font-size:14px;font-weight:700;text-decoration:underline;margin:10px 0 18px}
  .campos-topo{display:flex;gap:24px;margin-bottom:16px;font-size:12px;flex-wrap:wrap}
  .campos-topo b{font-weight:700}
  .campos-topo span{border-bottom:1px solid #999;padding:0 6px 2px;display:inline-block;min-width:80px}
  h3.secao{font-size:12px;font-weight:700;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.04em;color:#1a1a1a}
  .desc-box{border:1px solid #1a1a1a;border-radius:0;min-height:140px;padding:0;margin-bottom:18px}
  .desc-linha{border-bottom:1px solid #1a1a1a;min-height:24px;padding:4px 10px;font-size:13px;display:flex;align-items:center}
  .desc-linha:last-child{border-bottom:none}
  .servico-item{font-size:12px;padding:2px 0}
  .servico-item::before{content:"• "}
  .assin-grid{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:24px}
  .assin-col{text-align:center}
  .assin-col img{max-height:70px;max-width:100%;object-fit:contain;display:block;margin:0 auto 4px}
  .assin-linha{border-top:1px solid #1a1a1a;margin-top:40px;padding-top:4px}
  .assin-col .papel{font-size:10px;color:#888}
  .assin-col .nome{font-size:12px;font-weight:700;margin-top:2px}
  .assin-col .extra{font-size:11px;color:#444}
  .bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:30px;border-top:1px solid #ccc;padding-top:16px}
  .bottom-grid h4{font-size:12px;font-weight:700;text-decoration:underline;margin-bottom:8px}
  .epi-item{font-size:11px;padding:2px 0}
  .epi-item .check{display:inline-block;width:14px;text-align:center;font-weight:700}
  .obs-seguranca{font-size:10.5px;color:#333;line-height:1.6;text-align:justify}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:24px;padding-top:10px;border-top:1px solid #eee}
  @media print{body{padding:14px}button{display:none!important}}
</style>
</head>
<body>
<div class="header">
  <img src="${LOGO_BASE64}" alt="AFINE">
  <div class="empresa">
    <h1>AFINE – ARQUITETURA E CONSTRUÇÃO</h1>
    <div class="info">
      CNPJ: 32.431.928/0001-17<br>
      Rua Zabel Burunsuzian, 25 — Tatuapé – São Paulo / SP
    </div>
  </div>
</div>
<div class="titulo-doc">MANUTENÇÃO E CONSTRUÇÃO PREDIAL</div>

<div class="campos-topo">
  <div><b>Loja/Agência:</b> <span>${loja}</span></div>
  <div><b>Data:</b> <span>${dataDoc}</span></div>
  <div><b>OT/Tickets:</b> <span>${otTicket}</span></div>
</div>

<h3 class="secao">Descrição do serviço</h3>
<div class="desc-box">
  ${servicos.map(s=>`<div class="desc-linha">${s}</div>`).join("")}
  ${descExtra ? `<div class="desc-linha" style="white-space:pre-wrap">${descExtra}</div>` : ""}
  ${Array.from({length: Math.max(0, 8 - servicos.length - (descExtra?1:0))}).map(()=>`<div class="desc-linha">&nbsp;</div>`).join("")}
</div>

<div class="assin-grid">
  <div class="assin-col">
    <div class="papel" style="margin-bottom:6px">TELEFONE: ${os.telefoneGerente||"–"}</div>
    ${os.assinGerente ? `<img src="${os.assinGerente}" alt="Assinatura gerente">` : ""}
    <div class="assin-linha">
      <div class="nome">${os.nomeGerente||"–"}</div>
      <div class="extra">CPF: ${os.cpfGerente||"–"}</div>
      <div class="extra">RG: ${os.rgGerente||"–"}</div>
      <div class="extra">Tel: ${os.telefoneGerente||"–"}</div>
      <div class="papel">Gerente / Cliente</div>
    </div>
  </div>
  <div class="assin-col">
    <div class="papel" style="margin-bottom:6px">AFINE</div>
    ${os.assinPrestador ? `<img src="${os.assinPrestador}" alt="Assinatura técnico">` : ""}
    <div class="assin-linha">
      <div class="nome">${os.funcionario?.nome||"–"}</div>
      <div class="papel">Técnico</div>
    </div>
  </div>
</div>

<div class="bottom-grid">
  <div>
    <h4>CHECKLIST DE EPIs UTILIZADOS</h4>
    ${EPIS_TODOS.map(e=>`<div class="epi-item"><span class="check">${epis.includes(e)?"✓":"( )"}</span> ${e}</div>`).join("")}
  </div>
  <div>
    <h4>OBSERVAÇÕES DE SEGURANÇA</h4>
    <div class="obs-seguranca">
      É expressamente proibido realizar qualquer tipo de intervenção em circuitos ou equipamentos energizados.
      Antes de iniciar qualquer serviço elétrico, certifique-se de que a energia está desligada, bloqueada e sinalizada.
    </div>
  </div>
</div>

<div class="footer">
  Documento gerado automaticamente pelo sistema AFINE &nbsp;|&nbsp; ${os.numero} &nbsp;|&nbsp; ${data}
</div>
${BOTOES_PDF}
</body></html>`);
  w.document.close();
}

// Exportar RDO como PDF
export function exportarRDOParaPDF(rdos, obraInfo) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar."); return; }
  const data = new Date().toLocaleString("pt-BR");
  const rdoHTML = rdos.map(r => `
    <div class="rdo">
      <div class="rdo-header">
        <div>
          <span class="rdo-date">${new Date(r.data).toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</span>
          <span class="clima">${r.clima||""}</span>
        </div>
        <div class="autor">por ${r.autorNome||"–"}</div>
      </div>
      ${r.atividades?.length?("<div class='section'><strong>Atividades:</strong><ul>"+r.atividades.map(a=>"<li>"+a+"</li>").join("")+"</ul></div>"):""}
      ${r.atividadeExtra?`<div class='section'><strong>Detalhe:</strong> ${r.atividadeExtra}</div>`:""}
      ${r.equipePresente?.length?`<div class='section'><strong>Equipe:</strong> ${r.equipePresente.join(", ")}</div>`:""}
      ${r.materiais?`<div class='section'><strong>Materiais recebidos:</strong> ${r.materiais}</div>`:""}
      ${(r.ocorrencias?.length||r.ocorrenciaExtra)?("<div class='section ocorr'><strong>⚠ Ocorrências:</strong><ul>"+(r.ocorrencias||[]).map(o=>"<li>"+o+"</li>").join("")+"</ul>"+(r.ocorrenciaExtra?"<p>"+r.ocorrenciaExtra+"</p>":"")+"</div>"):""}
      ${r.obs?`<div class='section obs'><strong>Obs:</strong> ${r.obs}</div>`:""}
    </div>
  `).join("");

  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Diário de Obra — ${obraInfo?.nome||""}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:13px;padding:20px;color:#1a1a1a}
.header-doc{background:#1A1A1A;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0}
.header-doc h1{font-size:18px;font-weight:700}
.header-doc p{font-size:11px;opacity:.6;margin-top:2px}
.yellow-bar{background:#F5C800;height:4px;margin-bottom:16px;border-radius:0 0 4px 4px}
.rdo{border:1px solid #e0e0e0;border-radius:8px;padding:14px;margin-bottom:12px}
.rdo-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #f0f0f0}
.rdo-date{font-size:14px;font-weight:700}
.clima{font-size:12px;color:#888;margin-left:8px}
.autor{font-size:11px;color:#888}
.section{margin-top:6px;font-size:12px;line-height:1.6}
.section ul{padding-left:18px;margin-top:4px}
.ocorr{color:#B83232;background:#FFF5F5;padding:8px;border-radius:4px;border-left:3px solid #B83232;margin-top:8px}
.obs{color:#666;font-style:italic}
.footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee}
@media print{body{padding:10px}button{display:none!important}}
</style></head><body>
<div class="header-doc"><h1>Diário de Obra — ${obraInfo?.nome||"AFINE"}</h1><p>AFINE A.F. Nery Arquitetura e Construção · Emissão: ${data}</p></div>
<div class="yellow-bar"></div>
${rdoHTML}
<div class="footer">AFINE — Documento gerado automaticamente · ${data}</div>
<br><div style="text-align:center">
<button onclick="window.print()" style="background:#1A1A1A;color:#F5C800;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px">🖨️ Imprimir / PDF</button>
<button onclick="window.close()" style="background:#eee;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer">Fechar</button>
</div></body></html>`);
  w.document.close();
}


// Estilos base compartilhados pelos novos relatórios (Obra/Financeiro/Despesas)
const BASE_STYLE = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:20px}
  .header{background:#1A1A1A;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0}
  .header h1{font-size:18px;font-weight:700}
  .header p{font-size:11px;opacity:.65;margin-top:2px}
  .yellow-bar{background:#F5C800;height:4px;margin-bottom:16px;border-radius:0 0 4px 4px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-bottom:14px}
  .field label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.04em}
  .field p{font-size:13px;font-weight:500;border-bottom:1px solid #e0e0e0;padding-bottom:3px;margin-top:2px}
  h3{font-size:13px;font-weight:700;color:#1A1A1A;margin:16px 0 8px;border-bottom:2px solid #F5C800;padding-bottom:4px;display:inline-block}
  table{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:10px}
  thead tr{background:#1A1A1A}
  thead th{color:#fff;text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
  tbody td{padding:6px 8px;border-bottom:1px solid #eee}
  tbody tr:nth-child(even){background:#fafafa}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px}
  .kpi{border:1px solid #e0e0e0;border-radius:6px;padding:10px}
  .kpi label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.04em}
  .kpi .v{font-size:18px;font-weight:700;margin-top:2px}
  .v.green{color:#2A6B3F}.v.red{color:#BD3838}.v.yellow{color:#B8910A}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee}
  @media print{body{padding:10px}.no-print{display:none!important}}
`;
// ── Termo de Recebimento Definitivo (layout fiel ao docx BRADESCO/AFINE) ─────
export function exportarTermoRecebimentoParaPDF(tr) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar o PDF."); return; }

  const fmtD = iso => iso ? iso.split("-").reverse().join("/") : "";

  // Checkbox: □ vazio, ☑ marcado — igual ao docx
  const av = (val, opcao) => {
    const marcado = val === opcao;
    return `<td style="text-align:center;border:1px solid #555;padding:3px 4px;font-size:13px">${marcado ? "☑" : "☐"}</td>`;
  };

  // Coluna de assinatura: área vazia + imagem se houver + linha + label embaixo (igual docx)
  const assinColuna = (label1, label2, imgBase64) => `
    <td style="border:1px solid #555;padding:0;text-align:center;vertical-align:bottom;width:33.3%">
      <div style="height:80px;display:flex;align-items:flex-end;justify-content:center;padding:6px">
        ${imgBase64 ? `<img src="${imgBase64}" style="max-height:70px;max-width:90%;object-fit:contain">` : ""}
      </div>
      <div style="border-top:1px solid #555;padding:4px;font-size:10px;text-align:center;line-height:1.5">
        ${label1}<br>${label2}
      </div>
    </td>`;

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Termo de Recebimento — ${tr.numero}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:28px 36px;max-width:860px;margin:0 auto}
  table{width:100%;border-collapse:collapse;margin-bottom:0}
  td{border:1px solid #555;padding:4px 6px;vertical-align:middle;font-size:11px}
  .sh{font-weight:700;font-size:11px;text-transform:uppercase;text-align:center;padding:4px 6px}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:14px;padding-top:6px;border-top:1px solid #eee}
  @media print{body{padding:12px}button{display:none!important}}
</style>
</head>
<body>

<!-- Faixa diagonal Bradesco — TOPO -->
<div style="margin:-28px -36px 0 -36px;height:20px;overflow:hidden">
  <img src="${BARRA_BRADESCO_BASE64}" alt="" style="width:100%;height:20px;object-fit:cover;display:block">
</div>

<!-- Cabeçalho branco com logos -->
<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0 8px;border-bottom:1px solid #ccc;margin-bottom:8px">
  <img src="${BRADESCO_BASE64}" alt="Bradesco" style="height:32px;object-fit:contain">
  <img src="${AFINE_TERMO_BASE64}" alt="AFINE" style="height:50px;object-fit:contain">
  <div style="display:flex;align-items:center;gap:6px;border:1px solid #888;padding:4px 10px">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="1"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>
    <span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Confidencial</span>
  </div>
</div>

<!-- Título — negrito, sem borda, centralizado (igual ao docx) -->
<p style="text-align:center;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:8px 0 8px">TERMO DE RECEBIMENTO DEFINITIVO</p>

<!-- INFORMAÇÕES GERAIS -->
<table style="margin-bottom:0">
  <tr><td colspan="4" class="sh">Informações Gerais</td></tr>
  <tr>
    <td style="width:22%">Junção/ Local:</td>
    <td style="width:28%">${tr.juncaoLocal||""}</td>
    <td style="width:22%">Nº Processo:</td>
    <td>${tr.nrProcesso||""}</td>
  </tr>
  <tr>
    <td>Endereço:</td>
    <td colspan="3">${tr.endereco||""}</td>
  </tr>
  <tr>
    <td>Tipo de Serviço:</td>
    <td>${tr.tipoServico||""}</td>
    <td>Área de intervenção:</td>
    <td>${tr.areaIntervencao||""}</td>
  </tr>
</table>

<!-- Patrimônio -->
<table style="margin-bottom:0">
  <tr>
    <td>Patrimônio - Responsável de Projeto:</td>
    <td>${tr.respPatrimonioProjeto||""}</td>
  </tr>
  <tr>
    <td>Patrimônio - Responsável de Obra:</td>
    <td>${tr.respPatrimonioObra||""}</td>
  </tr>
  <tr>
    <td>Acompanhamento da obra:</td>
    <td>${tr.acompanhamento||""}</td>
  </tr>
</table>

<!-- Construtora | Gerenciadora — 3 colunas, 2 linhas, texto normal centrado -->
<table style="margin-bottom:0">
  <tr>
    <td style="width:33%;text-align:center">Construtora/Executora<br>AFINE</td>
    <td style="width:34%;text-align:center">Responsável Construtora<br>${tr.nomeAssinConstrutora||"Diego Amaral"}</td>
    <td style="width:33%;text-align:center">Contato<br>(11) 99188-5538</td>
  </tr>
  <tr>
    <td style="text-align:center">Gerenciadora / Mantenedora</td>
    <td style="text-align:center">Responsável Gerenciadora/ Mantenedora:<br>${tr.respGerenciadora||""}</td>
    <td style="text-align:center">Contato<br>${tr.contatoGerenciadora||""}</td>
  </tr>
</table>

<!-- Datas + texto legal + escopo — tudo em uma única tabela como no docx -->
<table style="margin-bottom:0;margin-top:0">
  <tr>
    <td colspan="2" class="sh" style="width:50%">Programação Inicial</td>
    <td colspan="2" class="sh" style="width:50%">Datas Efetivas</td>
  </tr>
  <tr>
    <td style="text-align:center;width:25%">Início:</td>
    <td style="text-align:center;width:25%">Término:</td>
    <td style="text-align:center;width:25%">Início:</td>
    <td style="text-align:center;width:25%">Término:</td>
  </tr>
  <tr>
    <td style="text-align:center">${fmtD(tr.inicioObra)}</td>
    <td style="text-align:center">${fmtD(tr.terminoObra)}</td>
    <td style="text-align:center">${fmtD(tr.inicioEfetivo)}</td>
    <td style="text-align:center">${fmtD(tr.terminoEfetivo)}</td>
  </tr>
  <tr>
    <td colspan="4" style="font-size:11px;line-height:1.6;text-align:justify;padding:6px 8px">
      Constatamos para os devidos fins que a obra realizada na nossa dependência considera-se <strong>recebida pela dependência/unidade</strong> conforme a execução do escopo abaixo. Este documento não tem propriedades avaliativas técnicas, apenas quanto ao acompanhamento e entrega do escopo acordado.
    </td>
  </tr>
  <tr><td colspan="4" class="sh">Escopo dos Principais Serviços</td></tr>
  <tr><td colspan="4" style="min-height:80px;height:80px;padding:6px;vertical-align:top;white-space:pre-wrap">${tr.escopo||""}</td></tr>
  <tr><td colspan="4" style="height:36px">&nbsp;</td></tr>
</table>

<!-- Avaliação -->
<table style="margin-bottom:0;margin-top:0">
  <tr><td colspan="6" class="sh">Avaliação pela Gerência do Recebimento da Obra</td></tr>
  <tr>
    <td style="width:34%"></td>
    <td style="text-align:center;width:13%">Ruim*</td>
    <td style="text-align:center;width:13%">Regular*</td>
    <td style="text-align:center;width:13%">Bom</td>
    <td style="text-align:center;width:13%">Ótimo</td>
    <td style="text-align:center;width:14%">Não se aplica</td>
  </tr>
  <tr>
    <td>Patrimônio:</td>
    ${av(tr.avPatrimonio,"Ruim")}${av(tr.avPatrimonio,"Regular")}${av(tr.avPatrimonio,"Bom")}${av(tr.avPatrimonio,"Ótimo")}${av(tr.avPatrimonio,"Não se aplica")}
  </tr>
  <tr>
    <td>Construtora/Empresa executora:</td>
    ${av(tr.avConstrutora,"Ruim")}${av(tr.avConstrutora,"Regular")}${av(tr.avConstrutora,"Bom")}${av(tr.avConstrutora,"Ótimo")}${av(tr.avConstrutora,"Não se aplica")}
  </tr>
  <tr>
    <td>Gerenciadora / Mantenedora:</td>
    ${av(tr.avGerenciadora,"Ruim")}${av(tr.avGerenciadora,"Regular")}${av(tr.avGerenciadora,"Bom")}${av(tr.avGerenciadora,"Ótimo")}${av(tr.avGerenciadora,"Não se aplica")}
  </tr>
  <tr>
    <td>Outros. Especifique:</td>
    ${av(tr.avOutros,"Ruim")}${av(tr.avOutros,"Regular")}${av(tr.avOutros,"Bom")}${av(tr.avOutros,"Ótimo")}${av(tr.avOutros,"Não se aplica")}
  </tr>
  <tr>
    <td colspan="6" class="sh">Comentários</td>
  </tr>
  <tr>
    <td colspan="6" style="font-size:10px;text-align:center;padding:3px">*Justificar caso a avaliação caso seja Regular ou Ruim</td>
  </tr>
  <tr>
    <td colspan="6" style="min-height:50px;height:50px;padding:6px;vertical-align:top;white-space:pre-wrap">${tr.comentarios||""}</td>
  </tr>
</table>

<!-- Assinaturas -->
<table style="margin-top:0">
  <tr><td colspan="3" class="sh">Assinatura dos Envolvidos</td></tr>
  <tr>
    <td colspan="3" style="font-size:11px;padding:6px 8px;line-height:1.6;text-align:justify">
      Considerando que os trabalhos do escopo do processo foram atendidos, declaramos estar de acordo com o recebimento de obra.
    </td>
  </tr>
  <tr style="height:90px">
    ${assinColuna("Assinatura da Gerência","Visto e Carimbo", tr.assinGerencia)}
    ${assinColuna("Assinatura da Construtora/Executora","Visto", tr.assinConstrutora)}
    ${assinColuna("Assinatura Gerenciadora/Mantenedora","Visto", tr.assinGerenciadora)}
  </tr>
</table>

<div class="footer">
  ${tr.numero} · Gerado em ${new Date(tr.geradaEm||Date.now()).toLocaleString("pt-BR")} · Sistema AFINE
</div>
<br>
<div class="no-print" style="text-align:center">
  <button onclick="window.print()" style="background:#1A1A1A;color:#F5C800;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px">🖨️ Imprimir / PDF</button>
  <button onclick="window.close()" style="background:#eee;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer">Fechar</button>
</div>
</body></html>`);
  w.document.close();
}

// ── Termo de Entrega de Chaves — formato BRADESCO (Obras) ────────────────────
export function exportarTermoChavesBradescoParaPDF(tc) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar o PDF."); return; }

  const fmtD = iso => iso ? iso.split("-").reverse().join("/") : "__/__/____";

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Termo de Entrega de Chaves — ${tc.numero}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:28px 36px;max-width:860px;margin:0 auto}
  table{width:100%;border-collapse:collapse;margin-bottom:0}
  td{border:1px solid #555;padding:4px 7px;vertical-align:middle;font-size:11px}
  .sh{font-weight:700;font-size:11px;text-transform:uppercase;text-align:center;padding:4px 6px}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:14px;padding-top:6px;border-top:1px solid #eee}
  @media print{body{padding:12px}button{display:none!important}}
</style>
</head>
<body>

<!-- Faixa diagonal — TOPO -->
<div style="margin:-28px -36px 0 -36px;height:20px;overflow:hidden">
  <img src="${CHAVES_BARRA_BASE64}" alt="" style="width:100%;height:20px;object-fit:cover;display:block">
</div>

<!-- Cabeçalho com logos -->
<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0 8px;border-bottom:1px solid #ccc;margin-bottom:8px">
  <img src="${CHAVES_LOGO1_BASE64}" alt="" style="height:32px;object-fit:contain">
  <img src="${CHAVES_LOGO2_BASE64}" alt="" style="height:50px;object-fit:contain">
  <div style="display:flex;align-items:center;gap:6px;border:1px solid #888;padding:4px 10px">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="1"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>
    <span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Confidencial</span>
  </div>
</div>

<!-- Título -->
<p style="text-align:center;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:8px 0">TERMO – ENTREGA CHAVES</p>

<!-- Tabela principal -->
<table>
  <tr>
    <td style="width:18%">Projeto:</td>
    <td style="width:32%">${tc.projeto||""}</td>
    <td style="width:18%">Processo:</td>
    <td>${tc.processo||""}</td>
  </tr>
  <tr>
    <td>Agência:</td>
    <td>${tc.agencia||""}</td>
    <td>Município:</td>
    <td>${tc.municipio||""}</td>
  </tr>
  <tr>
    <td>Lote:</td>
    <td colspan="3">${tc.lote||""}</td>
  </tr>
  <tr>
    <td>Construtora:</td>
    <td colspan="3">${tc.construtora||"AFINE"}</td>
  </tr>
  <tr>
    <td>Gerenciadora:</td>
    <td colspan="3">${tc.gerenciadora||""}</td>
  </tr>
  <tr>
    <td colspan="4" style="height:12px;border:none"></td>
  </tr>
  <tr>
    <td colspan="4" class="sh">Recebimento Chaves Imóvel BSP</td>
  </tr>
  <tr>
    <td colspan="4" style="line-height:1.6;padding:8px;text-align:justify">
      Declaro que recebi nesta data as chaves do imóvel da agência ${tc.agencia||"___"}, assumindo a responsabilidade pela guarda e utilização das mesmas.
    </td>
  </tr>
  <tr>
    <td colspan="4">Data recebimento chaves em: ${fmtD(tc.dataRecebimento)}</td>
  </tr>
</table>

<!-- Assinatura Recebedor -->
<table style="margin-top:8px">
  <tr>
    <td colspan="3" class="sh">Gerência da Agência – Recebedor Chaves</td>
  </tr>
  <tr>
    <td style="width:50%">Nome completo: ${tc.nomeRecebedor||""}</td>
    <td colspan="2"></td>
  </tr>
  <tr style="height:80px">
    <td style="vertical-align:bottom;padding:6px;text-align:center">
      ${tc.assinRecebedor ? `<img src="${tc.assinRecebedor}" style="max-height:70px;max-width:90%;object-fit:contain">` : ""}
    </td>
    <td style="width:35%;vertical-align:bottom;padding:6px;text-align:center"></td>
    <td style="width:20%;vertical-align:bottom;padding:6px;text-align:center"></td>
  </tr>
  <tr>
    <td>Assinatura:</td>
    <td>Data: ${fmtD(tc.dataRecebedor)}</td>
    <td></td>
  </tr>
</table>

<!-- Assinatura Entregador -->
<table style="margin-top:8px">
  <tr>
    <td colspan="3" class="sh">Construtora – Entregador Chaves</td>
  </tr>
  <tr>
    <td style="width:50%">Nome completo: ${tc.nomeEntregador||""}</td>
    <td colspan="2"></td>
  </tr>
  <tr>
    <td>Celular: ${tc.celularEntregador||""}</td>
    <td colspan="2"></td>
  </tr>
  <tr style="height:80px">
    <td style="vertical-align:bottom;padding:6px;text-align:center">
      ${tc.assinEntregador ? `<img src="${tc.assinEntregador}" style="max-height:70px;max-width:90%;object-fit:contain">` : ""}
    </td>
    <td style="width:35%;vertical-align:bottom;padding:6px;text-align:center"></td>
    <td style="width:20%;vertical-align:bottom;padding:6px;text-align:center"></td>
  </tr>
  <tr>
    <td>Assinatura:</td>
    <td>Agência: ${tc.agenciaEntregador||""}</td>
    <td></td>
  </tr>
</table>

<div class="footer">
  ${tc.numero} · Gerado em ${new Date(tc.geradaEm||Date.now()).toLocaleString("pt-BR")} · Sistema AFINE
</div>
<br>
<div class="no-print" style="text-align:center">
  <button onclick="window.print()" style="background:#1A1A1A;color:#F5C800;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px">🖨️ Imprimir / PDF</button>
  <button onclick="window.close()" style="background:#eee;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer">Fechar</button>
</div>
</body></html>`);
  w.document.close();
}

const BOTOES_PDF_STR = `<br><div class="no-print" style="text-align:center">
<button onclick="window.print()" style="background:#1A1A1A;color:#F5C800;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px">🖨️ Imprimir / PDF</button>
<button onclick="window.close()" style="background:#eee;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer">Fechar</button>
</div>`;

const BOTOES_PDF = `
<br><div class="no-print" style="text-align:center">
<button onclick="window.print()" style="background:#1A1A1A;color:#F5C800;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px">🖨️ Imprimir / PDF</button>
<button onclick="window.close()" style="background:#eee;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer">Fechar</button>
</div>`;
function fmtMoeda(v) { return `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`; }
function fmtDataBR(iso) { return iso ? iso.split("-").reverse().join("/") : "–"; }

// ── Relatório de Obra (ficha completa) ──────────────────────────────────────
export function exportarObraParaPDF(obra, funcionariosMap = {}) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar o PDF."); return; }
  const data = new Date().toLocaleString("pt-BR");
  const equipe = (obra.equipeIds||[]).map(id => funcionariosMap[id]?.nome || id).join(", ") || "–";
  const materiais = obra.materiais||[];
  const checklistOk = Object.values(obra.checklist||{}).filter(Boolean).length;
  const checklistTotal = Object.keys(obra.checklist||{}).length;

  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Ficha da Obra — ${obra.nome}</title><style>${BASE_STYLE}</style></head><body>
<div class="header"><h1>FICHA DA OBRA — ${obra.nome}</h1><p>AFINE A.F. Nery Arquitetura e Construção · Emissão: ${data}</p></div>
<div class="yellow-bar"></div>

<div class="grid">
  <div class="field"><label>Cliente</label><p>${obra.cliente||"–"}</p></div>
  <div class="field"><label>Agência / Local</label><p>${obra.agenciaNome||"–"}</p></div>
  <div class="field"><label>Endereço</label><p>${[obra.logradouro,obra.numero,obra.bairro,obra.cidade,obra.uf].filter(Boolean).join(", ")||"–"}</p></div>
  <div class="field"><label>Tipo de obra</label><p>${obra.tipo||"–"}</p></div>
  <div class="field"><label>Responsável técnico</label><p>${obra.responsavelNome||"–"}</p></div>
  <div class="field"><label>Contrato Nº</label><p>${obra.contrato||"–"}</p></div>
  <div class="field"><label>Status</label><p>${obra.status||"–"} (${obra.progresso||0}%)</p></div>
  <div class="field"><label>Equipe alocada</label><p>${equipe}</p></div>
  <div class="field"><label>Início</label><p>${fmtDataBR(obra.inicio)}</p></div>
  <div class="field"><label>Término previsto</label><p>${fmtDataBR(obra.termino)}</p></div>
  <div class="field"><label>Data de vistoria</label><p>${fmtDataBR(obra.dataVistoria)}</p></div>
  <div class="field"><label>Conclusão real</label><p>${fmtDataBR(obra.conclusaoReal)}</p></div>
</div>

<h3>Financeiro</h3>
<div class="kpis">
  <div class="kpi"><label>Orçamento</label><div class="v">${fmtMoeda(obra.valorOrcamento)}</div></div>
  <div class="kpi"><label>Orçamento enviado?</label><div class="v" style="font-size:13px">${obra.orcamentoEnviado||"–"}</div></div>
  <div class="kpi"><label>Relatório enviado?</label><div class="v" style="font-size:13px">${obra.relatorioEnviado||"–"}</div></div>
</div>

<h3>Materiais utilizados (${materiais.length})</h3>
${materiais.length ? `<table><thead><tr><th>Material</th><th>Qtd.</th><th>Un.</th><th>Origem</th></tr></thead>
<tbody>${materiais.map(m=>`<tr><td>${m.nome}</td><td>${m.qtd}</td><td>${m.un}</td><td>${m.origemCompra?"Comprado":"Avulso"}</td></tr>`).join("")}</tbody></table>`
: `<p style="font-size:12px;color:#888">${obra.semMaterial?`Sem materiais — motivo: ${obra.motivoSemMaterial||"–"}`:"Nenhum material registrado."}</p>`}

<h3>Checklist de vistoria</h3>
<p style="font-size:12px">${checklistOk} de ${checklistTotal} itens conferidos.</p>

<h3>Subcontratados / empresas envolvidas</h3>
<p style="font-size:12px">${obra.subcontratados||"–"}</p>

${obra.obs ? `<h3>Observações</h3><p style="font-size:12px;white-space:pre-wrap">${obra.obs}</p>` : ""}

<div class="footer">AFINE — Documento gerado automaticamente · ${data}</div>
${BOTOES_PDF}
</body></html>`);
  w.document.close();
}

// ── Relatório Financeiro Consolidado ────────────────────────────────────────
export function exportarFinanceiroParaPDF(lancamentos, kpis, periodoLabel = "") {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar o PDF."); return; }
  const data = new Date().toLocaleString("pt-BR");

  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório Financeiro Consolidado</title><style>${BASE_STYLE}</style></head><body>
<div class="header"><h1>RELATÓRIO FINANCEIRO CONSOLIDADO</h1><p>AFINE A.F. Nery Arquitetura e Construção · Emissão: ${data}${periodoLabel?` · ${periodoLabel}`:""}</p></div>
<div class="yellow-bar"></div>

<div class="kpis">
  <div class="kpi"><label>A receber</label><div class="v green">${fmtMoeda(kpis?.aReceber)}</div></div>
  <div class="kpi"><label>A pagar</label><div class="v red">${fmtMoeda(kpis?.aPagar)}</div></div>
  <div class="kpi"><label>Saldo</label><div class="v ${(kpis?.saldo||0)>=0?"green":"red"}">${fmtMoeda(kpis?.saldo)}</div></div>
  <div class="kpi"><label>Vencido</label><div class="v red">${fmtMoeda(kpis?.vencido)}</div></div>
  <div class="kpi"><label>Lançamentos</label><div class="v">${lancamentos.length}</div></div>
</div>

<h3>Lançamentos (${lancamentos.length})</h3>
<table><thead><tr><th>Vencimento</th><th>Tipo</th><th>Descrição</th><th>Obra</th><th>Categoria</th><th>Status</th><th>Valor</th></tr></thead>
<tbody>${lancamentos.map(l=>`<tr>
  <td>${fmtDataBR(l.vencimento)}</td>
  <td>${l.tipo==="PAGAR"?"A Pagar":"A Receber"}</td>
  <td>${l.descricao||"–"}</td>
  <td>${l.obraNome||"–"}</td>
  <td>${l.categoria||"–"}</td>
  <td>${l.status||"–"}</td>
  <td style="font-weight:700">${fmtMoeda(l.valor)}</td>
</tr>`).join("")}</tbody></table>

<div class="footer">AFINE — Documento gerado automaticamente · ${data}</div>
${BOTOES_PDF}
</body></html>`);
  w.document.close();
}

// ── Relatório de Despesas ────────────────────────────────────────────────────
export function exportarDespesasParaPDF(despesas, periodoLabel = "") {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar o PDF."); return; }
  const data = new Date().toLocaleString("pt-BR");
  const total = despesas.reduce((s,d)=>s+(d.valor||0),0);
  const aReembolsar = despesas.filter(d=>d.reembolso).reduce((s,d)=>s+(d.valor||0),0);

  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório de Despesas</title><style>${BASE_STYLE}</style></head><body>
<div class="header"><h1>RELATÓRIO DE DESPESAS</h1><p>AFINE A.F. Nery Arquitetura e Construção · Emissão: ${data}${periodoLabel?` · ${periodoLabel}`:""}</p></div>
<div class="yellow-bar"></div>

<div class="kpis">
  <div class="kpi"><label>Total no período</label><div class="v">${fmtMoeda(total)}</div></div>
  <div class="kpi"><label>A reembolsar</label><div class="v red">${fmtMoeda(aReembolsar)}</div></div>
  <div class="kpi"><label>Lançamentos</label><div class="v">${despesas.length}</div></div>
</div>

<h3>Despesas (${despesas.length})</h3>
<table><thead><tr><th>Data</th><th>Descrição</th><th>Funcionário</th><th>Obra</th><th>Método</th><th>Reembolso</th><th>Valor</th></tr></thead>
<tbody>${despesas.map(d=>`<tr>
  <td>${fmtDataBR(d.data)}</td>
  <td>${d.descricao||"–"}</td>
  <td>${d.funcionarioNome||"–"}</td>
  <td>${d.obraNome||"Geral"}</td>
  <td>${d.metodoPagamento||"–"}</td>
  <td>${d.reembolso?"Sim":"Não"}</td>
  <td style="font-weight:700">${fmtMoeda(d.valor)}</td>
</tr>`).join("")}</tbody></table>

<div class="footer">AFINE — Documento gerado automaticamente · ${data}</div>
${BOTOES_PDF}
</body></html>`);
  w.document.close();
}

// ── Termo de Entrega de Chaves — formato AFINE (Manutenção) ──────────────────
export function exportarTermoChavesParaPDF(termo) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar o PDF."); return; }

  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataDoc = termo.dataDocumento ? new Date(termo.dataDocumento+"T12:00:00") : new Date();
  const dia = dataDoc.getDate();
  const mes = MESES[dataDoc.getMonth()];
  const ano = dataDoc.getFullYear();

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Termo de Entrega de Chaves</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;padding:40px;line-height:1.7}
  .header{display:flex;align-items:center;gap:16px;margin-bottom:30px;border-bottom:2px solid #F5C800;padding-bottom:16px}
  .header img{height:48px;width:auto;border-radius:6px;flex-shrink:0}
  .header .titulos{flex:1}
  .header h1{font-size:18px;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
  .header .sub{font-size:11px;color:#888;margin-top:4px}
  .corpo{font-size:14px;text-align:justify;margin-bottom:40px}
  .corpo p{margin-bottom:16px}
  .corpo strong{font-weight:700}
  .data-local{text-align:right;margin:40px 0 60px}
  .assinatura-area{text-align:center;margin-top:10px}
  .assinatura-area img{max-height:90px;max-width:280px;object-fit:contain;display:block;margin:0 auto 6px}
  .linha-assinatura{border-top:1px solid #1a1a1a;width:320px;margin:0 auto 6px}
  .nome-recebeu{font-size:13px;font-weight:700;margin-top:4px}
  .doc-info{font-size:12px;color:#444;margin-top:2px}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:50px;padding-top:12px;border-top:1px solid #eee}
  @media print{body{padding:20px}button{display:none!important}}
</style>
</head>
<body>
<div class="header">
  <img src="${LOGO_BASE64}" alt="AFINE">
  <div class="titulos">
    <h1>Termo de Entrega de Chaves</h1>
    <div class="sub">AFINE — A.F. Nery Arquitetura e Construção</div>
  </div>
</div>
<div class="corpo">
  <p><strong>Imóvel:</strong> ${termo.enderecoCompleto||"–"}${termo.agenciaNome?` — ${termo.agenciaNome}`:""} — ${termo.cidade||"–"} - ${termo.estado||"–"}</p>
  <p>Neste ato, o representante do imóvel acima citado recebe as chaves, <strong>${termo.quantidadeChaves||"–"} chave(s)</strong>, do imóvel.</p>
  <p>Com a entrega da posse, a partir desta data, consequentemente a AFINE — Arquitetura &amp; Construção, não será responsável por qualquer dano posterior que possa vir a ocorrer.</p>
</div>
<div class="data-local">${termo.cidade||"–"}, ${dia} de ${mes} de ${ano}</div>
<div class="assinatura-area">
  ${termo.assinatura ? `<img src="${termo.assinatura}" alt="assinatura">` : ""}
  <div class="linha-assinatura"></div>
  <div style="font-size:11px;color:#888">(assinatura)</div>
  <div class="nome-recebeu">${termo.nomeRecebeu||"–"}</div>
  <div class="doc-info">CPF: ${termo.cpf||"–"}</div>
  <div class="doc-info">RG: ${termo.rg||"–"}</div>
</div>
<div class="footer">Documento gerado automaticamente pelo sistema AFINE</div>
${BOTOES_PDF}
</body></html>`);
  w.document.close();
}

