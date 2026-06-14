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
