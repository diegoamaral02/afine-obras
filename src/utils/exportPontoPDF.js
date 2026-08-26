// src/utils/exportPontoPDF.js — Relatórios de Folha de Ponto (PDF + Excel)
import { exportarExcel } from "./exportExcel";

// ── Constantes ──────────────────────────────────────────────────────────────
const FERIADOS = new Set([
  "2025-01-01","2025-03-03","2025-03-04","2025-04-18","2025-04-21","2025-05-01",
  "2025-06-19","2025-09-07","2025-10-12","2025-11-02","2025-11-15","2025-11-20","2025-12-25",
  "2026-01-01","2026-02-16","2026-02-17","2026-04-03","2026-04-21","2026-05-01",
  "2026-06-04","2026-09-07","2026-10-12","2026-11-02","2026-11-15","2026-11-20","2026-12-25",
]);

const DIAS_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtH  = ms => { if(!ms||ms<=0) return "—"; const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000); return `${h}h${String(m).padStart(2,"0")}m`; };
const fmtHora = iso => iso ? new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "—";
const fmtData = iso => iso ? new Date(iso+"T12:00:00").toLocaleDateString("pt-BR") : "—";
const dow     = iso => new Date(iso+"T12:00:00").getDay();
const isFeria = iso => FERIADOS.has(iso);

function nocturnoMs(startMs, endMs) {
  let total=0, cur=startMs;
  while(cur<endMs) {
    const d=new Date(cur);
    const msDay=cur-new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
    const h22=22*3600000,h05=5*3600000,h24=24*3600000;
    let next,isN;
    if(msDay>=h22){isN=true;next=cur+(h24-msDay);}
    else if(msDay<h05){isN=true;next=cur+(h05-msDay);}
    else{isN=false;next=cur+(h22-msDay);}
    const seg=Math.min(endMs,next);
    if(isN) total+=seg-cur;
    cur=seg;
  }
  return total;
}

function pararPontos(pts) {
  const res=[]; let ep=null;
  for(const p of [...pts].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))) {
    if(p.tipo==="ENTRADA"){if(ep)res.push({entrada:ep,saida:null});ep=p;}
    else if(p.tipo==="SAIDA"&&ep){res.push({entrada:ep,saida:p});ep=null;}
  }
  if(ep)res.push({entrada:ep,saida:null});
  return res;
}

function calcDia(pares, isoDate) {
  const d=dow(isoDate), feria=isFeria(isoDate);
  let normalMs=0,e50Ms=0,e100Ms=0,notMs=0,totalMs=0;
  const detalhes=[];
  for(const {entrada,saida} of pares) {
    if(!saida) { detalhes.push({entrada,saida:null}); continue; }
    const tIn=new Date(entrada.timestamp).getTime();
    const tOut=new Date(saida.timestamp).getTime();
    const ms=tOut-tIn;
    if(ms<=0) continue;
    notMs+=nocturnoMs(tIn,tOut);
    totalMs+=ms;
    if(d===0||feria){e100Ms+=ms;}
    else if(d===6){const lim=4*3600000;normalMs+=Math.min(ms,lim);e50Ms+=Math.max(0,ms-lim);}
    else{const lim=8*3600000;normalMs+=Math.min(ms,lim);e50Ms+=Math.max(0,ms-lim);}
    detalhes.push({entrada,saida,ms});
  }
  return {normalMs,e50Ms,e100Ms,notMs,totalMs,detalhes};
}

// ── Prepara dados agrupados por funcionário ─────────────────────────────────
export function prepararDadosPonto(pontos) {
  const byUser={};
  for(const p of pontos) {
    const uid=p.usuarioId, nome=p.usuarioNome||"Desconhecido";
    if(!byUser[uid]) byUser[uid]={uid,nome,dias:{}};
    const day=(p.timestamp||"").slice(0,10);
    if(!day) continue;
    if(!byUser[uid].dias[day]) byUser[uid].dias[day]={pontos:[],vinculo:p.vinculoNome||""};
    byUser[uid].dias[day].pontos.push(p);
    if(p.vinculoNome) byUser[uid].dias[day].vinculo=p.vinculoNome;
  }
  // Calcula horas de cada dia
  const result={};
  for(const [uid,u] of Object.entries(byUser)) {
    const diasCalc=[];
    let totNorm=0,totE50=0,totE100=0,totNot=0,totTotal=0;
    for(const [isoDate,dObj] of Object.entries(u.dias).sort((a,b)=>a[0].localeCompare(b[0]))) {
      const pares=pararPontos(dObj.pontos);
      const r=calcDia(pares,isoDate);
      totNorm+=r.normalMs; totE50+=r.e50Ms; totE100+=r.e100Ms; totNot+=r.notMs; totTotal+=r.totalMs;
      diasCalc.push({isoDate,vinculo:dObj.vinculo,pares,r});
    }
    result[uid]={...u,diasCalc,totNorm,totE50,totE100,totNot,totTotal};
  }
  return result;
}

// ── CSS base dos PDFs ───────────────────────────────────────────────────────
const CSS=`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:24px 32px;max-width:960px;margin:0 auto}
h1{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:0}
h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:14px 0 6px;color:#1a1a1a;border-bottom:2px solid #F5C800;padding-bottom:3px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{background:#1A1A1A;color:#F5C800;font-size:10px;font-weight:700;text-transform:uppercase;padding:5px 6px;text-align:left}
td{border:1px solid #ddd;padding:4px 6px;font-size:10px;vertical-align:middle}
tr:nth-child(even) td{background:#fafafa}
.tot td{font-weight:700;background:#fff8e1;border-top:2px solid #F5C800}
.norm{color:#333}.e50{color:#B8860B}.e100{color:#C0392B}.not{color:#5C35C9}
.badge{display:inline-block;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700}
.ent{background:#E8F5E9;color:#2E7D32}.sai{background:#FFEBEE;color:#C62828}
.kpi-row{display:flex;gap:12px;margin:10px 0 14px;flex-wrap:wrap}
.kpi{flex:1;min-width:100px;background:#fff;border:1px solid #ddd;border-radius:6px;padding:8px 10px;text-align:center;border-left:3px solid #F5C800}
.kpi-label{font-size:9px;font-weight:700;text-transform:uppercase;color:#7A7A7A;margin-bottom:3px}
.kpi-val{font-size:14px;font-weight:700}
.sep{height:14px}
.hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:3px solid #F5C800}
.meta{font-size:10px;color:#555;line-height:1.7}
@media print{body{padding:10px}button{display:none!important}.page-break{page-break-before:always}}
`;

const BOTOES=`<br><div style="text-align:center;margin-top:14px">
<button onclick="window.print()" style="background:#1A1A1A;color:#F5C800;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px">🖨️ Imprimir / PDF</button>
<button onclick="window.close()" style="background:#eee;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer">Fechar</button>
</div>`;

function cabecalho(titulo, periodo, subtitulo="") {
  return `<div class="hdr">
    <div>
      <div style="font-size:10px;color:#7A7A7A;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">AFINE — A.F. Nery Arquitetura e Construção</div>
      <h1>${titulo}</h1>
      ${subtitulo?`<div style="font-size:11px;color:#555;margin-top:3px">${subtitulo}</div>`:""}
    </div>
    <div class="meta">
      Período: <strong>${periodo}</strong><br>
      Emissão: <strong>${new Date().toLocaleDateString("pt-BR")}</strong>
    </div>
  </div>`;
}

function kpiRow(f) {
  const tot=f.totNorm+f.totE50+f.totE100;
  return `<div class="kpi-row">
    <div class="kpi"><div class="kpi-label">Total Trabalhado</div><div class="kpi-val">${fmtH(tot)}</div></div>
    <div class="kpi" style="border-left-color:#333"><div class="kpi-label">Normal</div><div class="kpi-val norm">${fmtH(f.totNorm)}</div></div>
    <div class="kpi" style="border-left-color:#B8860B"><div class="kpi-label">Extra 50%</div><div class="kpi-val e50">${fmtH(f.totE50)}</div></div>
    <div class="kpi" style="border-left-color:#C0392B"><div class="kpi-label">Extra 100%</div><div class="kpi-val e100">${fmtH(f.totE100)}</div></div>
    <div class="kpi" style="border-left-color:#5C35C9"><div class="kpi-label">Noturno (22h–05h)</div><div class="kpi-val not">${fmtH(f.totNot)}</div></div>
  </div>`;
}

function tabelaDias(f) {
  const rows=f.diasCalc.map(({isoDate,vinculo,pares,r})=>{
    const d=dow(isoDate), feria=isFeria(isoDate);
    const flag=d===0||feria?"⛔":d===6?"🟡":"";
    return pares.map(({entrada,saida,ms},i)=>`
      <tr>
        ${i===0?`<td rowspan="${pares.length}">${fmtData(isoDate)} <span style="color:#7A7A7A">${DIAS_PT[d]}</span> ${flag}</td><td rowspan="${pares.length}" style="font-size:10px;max-width:120px;overflow:hidden">${vinculo||"—"}</td>`:""}
        <td><span class="badge ent">↗ ${fmtHora(entrada.timestamp)}</span></td>
        <td>${saida?`<span class="badge sai">↙ ${fmtHora(saida.timestamp)}</span>`:`<span style="color:#E65100;font-size:10px">Em aberto</span>`}</td>
        <td>${fmtH(ms||0)}</td>
      </tr>`).join("");
  }).join("");

  return `<table>
    <thead><tr><th>Data</th><th>Obra/Vínculo</th><th>Entrada</th><th>Saída</th><th>Tempo</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="tot">
        <td colspan="2">TOTAL DO PERÍODO</td>
        <td colspan="2"></td>
        <td>${fmtH(f.totTotal)}</td>
      </tr>
    </tbody>
  </table>
  <div style="font-size:10px;color:#555;margin-bottom:10px">
    🟢 Normal: ${fmtH(f.totNorm)} &nbsp;|&nbsp; 🟡 Extra 50%: ${fmtH(f.totE50)} &nbsp;|&nbsp; 🔴 Extra 100%: ${fmtH(f.totE100)} &nbsp;|&nbsp; 🌙 Noturno: ${fmtH(f.totNot)}
    <br>⛔ Domingo/Feriado = 100% &nbsp;|&nbsp; 🟡 Sábado: 08h–12h normal, após 50%
  </div>`;
}

// ── PDF Individual ──────────────────────────────────────────────────────────
export function gerarPontoPDFIndividual(dados, funcionarioId, periodo) {
  const f=dados[funcionarioId];
  if(!f) { alert("Funcionário não encontrado."); return; }
  const w=window.open("","_blank");
  if(!w){alert("Permita pop-ups para exportar o PDF.");return;}
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Folha de Ponto — ${f.nome}</title><style>${CSS}</style></head><body>
${cabecalho("Folha de Ponto",periodo,f.nome)}
${kpiRow(f)}
<h2>Registros por Dia</h2>
${tabelaDias(f)}
${BOTOES}</body></html>`);
  w.document.close();
}

// ── PDF Geral (todos os funcionários) ───────────────────────────────────────
export function gerarPontoPDFGeral(dados, periodo) {
  const funcs=Object.values(dados).sort((a,b)=>a.nome.localeCompare(b.nome));
  if(!funcs.length){alert("Nenhum dado para exportar.");return;}
  const w=window.open("","_blank");
  if(!w){alert("Permita pop-ups para exportar o PDF.");return;}

  // Tabela resumo geral
  const resumo=funcs.map(f=>{
    const tot=f.totNorm+f.totE50+f.totE100;
    return `<tr>
      <td style="font-weight:700">${f.nome}</td>
      <td>${fmtH(tot)}</td>
      <td class="norm">${fmtH(f.totNorm)}</td>
      <td class="e50">${fmtH(f.totE50)}</td>
      <td class="e100">${fmtH(f.totE100)}</td>
      <td class="not">${fmtH(f.totNot)}</td>
    </tr>`;
  }).join("");

  const secoes=funcs.map((f,i)=>`
    <div class="${i>0?"page-break":""}">
      <h2>${f.nome}</h2>
      ${kpiRow(f)}
      ${tabelaDias(f)}
    </div>`).join("");

  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Folha de Ponto Geral — ${periodo}</title><style>${CSS}</style></head><body>
${cabecalho("Folha de Ponto — Relatório Geral",periodo,`${funcs.length} colaborador(es)`)}

<h2>Resumo por Colaborador</h2>
<table>
  <thead><tr><th>Colaborador</th><th>Total</th><th>Normal</th><th>Extra 50%</th><th>Extra 100%</th><th>Noturno</th></tr></thead>
  <tbody>${resumo}</tbody>
</table>

<div class="sep"></div>
${secoes}
${BOTOES}</body></html>`);
  w.document.close();
}

// ── Excel Detalhado ─────────────────────────────────────────────────────────
export function gerarPontoExcel(dados, periodo) {
  const funcs=Object.values(dados).sort((a,b)=>a.nome.localeCompare(b.nome));
  const rows=[];

  for(const f of funcs) {
    // Linha de cabeçalho do funcionário
    rows.push({
      _tipo:"HEADER",
      funcionario:f.nome, data:"",dia:"",vinculo:"",
      entrada:"",saida:"",totalHoras:"",
      normal:"",extra50:"",extra100:"",noturno:"",obs:"COLABORADOR",
    });
    for(const {isoDate,vinculo,pares,r} of f.diasCalc) {
      const d=dow(isoDate), feria=isFeria(isoDate);
      const diaLabel=DIAS_PT[d]+(d===0||feria?" 🔴":d===6?" 🟡":"");
      pares.forEach(({entrada,saida,ms})=>{
        rows.push({
          funcionario:f.nome,
          data:fmtData(isoDate),
          dia:diaLabel,
          vinculo:vinculo||"—",
          entrada:fmtHora(entrada.timestamp),
          saida:saida?fmtHora(saida.timestamp):"Em aberto",
          totalHoras:fmtH(ms||0),
          normal:fmtH(r.normalMs),
          extra50:fmtH(r.e50Ms),
          extra100:fmtH(r.e100Ms),
          noturno:fmtH(r.notMs),
          obs:"",
        });
      });
      // Se dia tem cálculo, linha de subtotal do dia
      if(f.diasCalc.length>1) {
        rows.push({
          funcionario:"",data:"↳ Subtotal dia",dia:"",vinculo:"",entrada:"",saida:"",
          totalHoras:fmtH(r.totalMs),
          normal:fmtH(r.normalMs),extra50:fmtH(r.e50Ms),extra100:fmtH(r.e100Ms),noturno:fmtH(r.notMs),obs:"",
        });
      }
    }
    // Total do funcionário
    const tot=f.totNorm+f.totE50+f.totE100;
    rows.push({
      funcionario:f.nome,data:"TOTAL DO PERÍODO",dia:"",vinculo:"",entrada:"",saida:"",
      totalHoras:fmtH(tot),
      normal:fmtH(f.totNorm),extra50:fmtH(f.totE50),extra100:fmtH(f.totE100),noturno:fmtH(f.totNot),obs:"",
    });
    rows.push({funcionario:"",data:"",dia:"",vinculo:"",entrada:"",saida:"",totalHoras:"",normal:"",extra50:"",extra100:"",noturno:"",obs:""});
  }

  exportarExcel(rows,`folha_ponto_${periodo.replace(/\//g,"-").replace(/ a /g,"_")}`, [
    {key:"funcionario",  header:"Funcionário"},
    {key:"data",         header:"Data"},
    {key:"dia",          header:"Dia"},
    {key:"vinculo",      header:"Obra / Vínculo"},
    {key:"entrada",      header:"Entrada"},
    {key:"saida",        header:"Saída"},
    {key:"totalHoras",   header:"Total Horas"},
    {key:"normal",       header:"Normal"},
    {key:"extra50",      header:"Extra 50%"},
    {key:"extra100",     header:"Extra 100%"},
    {key:"noturno",      header:"Noturno (22h-05h)"},
  ]);
}
