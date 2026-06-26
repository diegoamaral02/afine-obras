// src/utils/exportPDF.js
// Gera e exporta OS como PDF usando canvas + window.print()
// Sem bibliotecas externas — funciona 100% no browser

export function exportarOSParaPDF(os, manut) {
  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para exportar o PDF."); return; }

  const servicos = [
    ...(os.servicos || []),
    ...(manut?.descProntas || []),
  ].filter(Boolean);
  const descExtra = os.descricaoExtra || manut?.descExtra || "";
  const data = new Date(os.geradaEm).toLocaleString("pt-BR");

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>OS ${os.numero}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:20px}
  .header{background:#1F3864;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;margin-bottom:0}
  .header h1{font-size:18px;font-weight:700}
  .header p{font-size:11px;opacity:.7;margin-top:2px}
  .orange-bar{background:#C55A11;color:#fff;padding:6px 18px;font-size:11px;font-weight:700;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-bottom:14px}
  .field label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.04em}
  .field p{font-size:13px;font-weight:500;border-bottom:1px solid #e0e0e0;padding-bottom:3px;margin-top:2px}
  h3{font-size:13px;font-weight:700;color:#1F3864;margin:14px 0 8px;border-bottom:2px solid #D9E1F2;padding-bottom:4px}
  .servico{padding:4px 0;font-size:12px;border-bottom:1px solid #f0f0f0}
  .servico::before{content:"• ";color:#2E5FA3}
  .desc{background:#f8f9fb;border-left:3px solid #2E5FA3;padding:8px 12px;font-size:12px;border-radius:0 4px 4px 0;margin-bottom:14px;white-space:pre-wrap}
  .assin-block{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}
  .assin-box{border:1px solid #e0e0e0;border-radius:6px;padding:10px;text-align:center}
  .assin-box img{max-height:80px;max-width:100%;object-fit:contain;display:block;margin:0 auto 6px}
  .assin-box .label{font-size:10px;color:#888;text-transform:uppercase}
  .assin-box .nome{font-size:12px;font-weight:700;margin-top:4px}
  .assin-box .cargo{font-size:11px;color:#555}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;padding-top:12px;border-top:1px solid #eee}
  @media print{body{padding:10px}button{display:none!important}}
</style>
</head>
<body>
<div class="header">
  <h1>ORDEM DE SERVIÇO — ${os.numero}</h1>
  <p>AFINE – A.F. Nery Arquitetura e Construção</p>
</div>
<div class="orange-bar">Data de emissão: ${data} &nbsp;|&nbsp; Status: ${manut?.status||"CONCLUÍDA"}</div>

<div class="grid">
  <div class="field"><label>Cliente</label><p>${manut?.cliente||"–"}</p></div>
  <div class="field"><label>Agência / Local</label><p>${manut?.agencia||"–"}</p></div>
  <div class="field"><label>Endereço</label><p>${manut?.endereco||"–"}</p></div>
  <div class="field"><label>Tipo de manutenção</label><p>${manut?.tipo||"–"}</p></div>
  ${manut?.numeroOT||manut?.semOT ? `<div class="field"><label>Número da OT</label><p>${manut.semOT?"S/OT":manut.numeroOT}</p></div>` : ""}
  ${manut?.camposCustom?.protocolo ? `<div class="field"><label>Protocolo</label><p>${manut.camposCustom.protocolo}</p></div>` : ""}
</div>

<div class="grid">
  <div class="field"><label>Prestador</label><p>${os.funcionario?.nome||"–"}</p></div>
  <div class="field"><label>Função</label><p>${os.funcionario?.funcao||"–"}</p></div>
  <div class="field"><label>Empresa</label><p>${os.funcionario?.empresa||"AFINE"}</p></div>
  <div class="field"><label>Data de abertura</label><p>${manut?.dataAbertura||"–"}</p></div>
  <div class="field"><label>Data de conclusão</label><p>${manut?.dataConclusao||"–"}</p></div>
  <div class="field"><label>Gerente responsável</label><p>${os.nomeGerente||"–"}</p></div>
</div>

${servicos.length > 0 ? `
<h3>SERVIÇOS EXECUTADOS</h3>
${servicos.map(s=>`<div class="servico">${s}</div>`).join("")}
` : ""}

${descExtra ? `
<h3>DESCRIÇÃO / OBSERVAÇÕES</h3>
<div class="desc">${descExtra}</div>
` : ""}

<div class="assin-block">
  <div class="assin-box">
    ${os.assinPrestador ? `<img src="${os.assinPrestador}" alt="Assinatura prestador"/>` : '<div style="height:80px;border-bottom:1px solid #ccc;margin-bottom:6px"></div>'}
    <div class="label">Assinatura do prestador</div>
    <div class="nome">${os.funcionario?.nome||"–"}</div>
    <div class="cargo">${os.funcionario?.funcao||""}</div>
  </div>
  <div class="assin-box">
    ${os.assinGerente ? `<img src="${os.assinGerente}" alt="Assinatura gerente"/>` : '<div style="height:80px;border-bottom:1px solid #ccc;margin-bottom:6px"></div>'}
    <div class="label">Assinatura do gerente</div>
    <div class="nome">${os.nomeGerente||"–"}</div>
    <div class="cargo">Gerente da agência</div>
  </div>
</div>

<div class="footer">
  Documento gerado automaticamente pelo sistema AFINE &nbsp;|&nbsp; ${os.numero} &nbsp;|&nbsp; ${data}
</div>

<br>
<div style="text-align:center">
  <button onclick="window.print()" style="background:#1F3864;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px">
    🖨️ Imprimir / Salvar PDF
  </button>
  <button onclick="window.close()" style="background:#eee;color:#333;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer">
    Fechar
  </button>
</div>
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
