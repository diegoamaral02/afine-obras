// src/components/CustosMaoDeObra.js
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

// ── Constantes ─────────────────────────────────────────────────────────────
const BASE      = { lat: -23.5440, lng: -46.5683 }; // R. Zabel Burunsuzian, São Paulo-SP
const DIST_KM   = 100;
const HORA_MES  = 220;  // horas CLT/mês
const DIAS_MES  = 22;   // dias úteis/mês (para diária de viagem)

// ── Feriados nacionais 2025-2026 ────────────────────────────────────────────
const FERIADOS = new Set([
  // 2025
  "2025-01-01","2025-03-03","2025-03-04","2025-04-18",
  "2025-04-21","2025-05-01","2025-06-19","2025-09-07",
  "2025-10-12","2025-11-02","2025-11-15","2025-11-20","2025-12-25",
  // 2026
  "2026-01-01","2026-02-16","2026-02-17","2026-04-03",
  "2026-04-21","2026-05-01","2026-06-04","2026-09-07",
  "2026-10-12","2026-11-02","2026-11-15","2026-11-20","2026-12-25",
]);
const isFeriado = d => FERIADOS.has(d);

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt  = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const fmtH = ms => { const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000); return `${h}h${String(m).padStart(2,"0")}m`; };
const dow  = iso => new Date(iso+"T12:00:00").getDay(); // 0=Dom,6=Sab

function haversineKm(lat1,lng1,lat2,lng2) {
  const R=6371, dL=(lat2-lat1)*Math.PI/180, dG=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dG/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

/** ms de horas noturnas (22h-05h) dentro do intervalo [startMs, endMs] */
function nocturnoMs(startMs, endMs) {
  let total=0, cur=startMs;
  while (cur<endMs) {
    const d=new Date(cur);
    const msDay=cur - new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
    const h22=22*3600000, h05=5*3600000, h24=24*3600000;
    let next, isN;
    if (msDay>=h22)       { isN=true;  next=cur+(h24-msDay); }
    else if (msDay<h05)   { isN=true;  next=cur+(h05-msDay); }
    else                  { isN=false; next=cur+(h22-msDay); }
    const seg=Math.min(endMs,next);
    if(isN) total+=seg-cur;
    cur=seg;
  }
  return total;
}

/** Pares ENTRADA/SAÍDA de um dia (pontos já ordenados por timestamp) */
function pararPontos(pts) {
  const res=[]; let ep=null;
  for (const p of pts) {
    if (p.tipo==="ENTRADA") { if(ep) res.push({entrada:ep,saida:null}); ep=p; }
    else if (p.tipo==="SAIDA"&&ep) { res.push({entrada:ep,saida:p}); ep=null; }
  }
  if(ep) res.push({entrada:ep,saida:null});
  return res;
}

/** Calcula horas de um dia, retornando { normalMs, e50Ms, e100Ms, noturnoMs } */
function calcDia(pares, isoDate) {
  const d=dow(isoDate), feria=isFeriado(isoDate);
  let normalMs=0, e50Ms=0, e100Ms=0, notMs=0;
  for (const {entrada,saida} of pares) {
    if(!saida) continue;
    const tIn=new Date(entrada.timestamp).getTime();
    const tOut=new Date(saida.timestamp).getTime();
    const ms=tOut-tIn;
    if(ms<=0) continue;
    notMs+=nocturnoMs(tIn,tOut);
    if(d===0||feria) {
      e100Ms+=ms;
    } else if(d===6) {
      const lim=4*3600000; normalMs+=Math.min(ms,lim); e50Ms+=Math.max(0,ms-lim);
    } else {
      const lim=8*3600000; normalMs+=Math.min(ms,lim); e50Ms+=Math.max(0,ms-lim);
    }
  }
  return {normalMs,e50Ms,e100Ms,notMs};
}

/** Conta diárias de viagem: SAÍDA>100km → ENTRADA>100km (≥6h depois) = 1 diária */
function calcViagem(pontos) {
  const sorted=[...pontos].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  let dias=0;
  for(let i=0;i<sorted.length-1;i++) {
    const p=sorted[i], nx=sorted[i+1];
    if(p.tipo!=="SAIDA"||nx.tipo!=="ENTRADA") continue;
    if(!p.geo||!nx.geo) continue;
    const d1=haversineKm(BASE.lat,BASE.lng,p.geo.lat,p.geo.lng);
    const d2=haversineKm(BASE.lat,BASE.lng,nx.geo.lat,nx.geo.lng);
    const ms=new Date(nx.timestamp)-new Date(p.timestamp);
    if(d1>=DIST_KM&&d2>=DIST_KM&&ms>=6*3600000) dias++;
  }
  return dias;
}

// ── Card Mão de Obra ─────────────────────────────────────────────────────
function CardMaoDeObra({ obraId, equipeIds, funcionarios, onCustoChange }) {
  const [pontos,  setPontos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [aberto,  setAberto]  = useState(false);

  useEffect(()=>{
    if(!obraId) return;
    const q=query(collection(db,"pontos"),where("vinculoId","==",obraId),where("vinculoTipo","==","obra"));
    return onSnapshot(q,snap=>{setPontos(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false);});
  },[obraId]);

  const resultado = useMemo(()=>{
    const equipe=(funcionarios||[]).filter(f=>(equipeIds||[]).includes(f.id)&&Number(f.salario)>0);

    // agrupa por usuário
    const byUser={};
    for(const p of pontos){
      const uid=p.usuarioId; if(!uid) continue;
      const day=(p.timestamp||"").slice(0,10); if(!day) continue;
      if(!byUser[uid]) byUser[uid]={dias:{},todos:[]};
      if(!byUser[uid].dias[day]) byUser[uid].dias[day]=[];
      byUser[uid].dias[day].push(p);
      byUser[uid].todos.push(p);
    }

    let totNorm=0,totE50=0,totE100=0,totNot=0,totViagem=0,totCusto=0;
    const linhas=equipe.map(f=>{
      const sal=Number(f.salario), taxa=sal/HORA_MES;
      const isCLT=f.tipoContrato==="CLT"&&f.departamento==="campo";
      const ud=byUser[f.id]||{dias:{},todos:[]};

      let nMs=0,e50Ms=0,e100Ms=0,notMs=0;
      for(const [day,pts] of Object.entries(ud.dias)){
        const pares=pararPontos([...pts].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)));
        const r=calcDia(pares,day);
        nMs+=r.normalMs; e50Ms+=r.e50Ms; e100Ms+=r.e100Ms; notMs+=r.notMs;
      }

      const diasViagem=isCLT?calcViagem(ud.todos):0;
      const diaria=sal/DIAS_MES;

      const custo=taxa*(nMs/3600000)+taxa*1.5*(e50Ms/3600000)+taxa*2*(e100Ms/3600000)+taxa*0.2*(notMs/3600000)+diasViagem*diaria;

      totNorm+=nMs; totE50+=e50Ms; totE100+=e100Ms; totNot+=notMs; totViagem+=diasViagem; totCusto+=custo;
      return {f,nMs,e50Ms,e100Ms,notMs,diasViagem,custo,isCLT};
    });

    return {linhas,totNorm,totE50,totE100,totNot,totViagem,totCusto};
  },[pontos,funcionarios,equipeIds]);

  useEffect(()=>{ onCustoChange?.(resultado.totCusto); },[resultado.totCusto]); // eslint-disable-line

  return (
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
      <div style={{background:"#1A1A1A",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>👷</span>
          <span style={{color:"#F5C800",fontWeight:700,fontSize:13}}>Custo de Mão de Obra</span>
        </div>
        <span style={{color:"#F5C800",fontWeight:700,fontSize:14}}>{loading?"…":fmt(resultado.totCusto)}</span>
      </div>
      <div style={{padding:"10px 14px",fontSize:12}}>
        {/* KPIs de horas */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:8}}>
          {[
            {label:"Normal",      v:fmtH(resultado.totNorm),  color:"#333"},
            {label:"Extra 50%",   v:fmtH(resultado.totE50),   color:"var(--afine-yellow-dk)"},
            {label:"Extra 100%",  v:fmtH(resultado.totE100),  color:"#E65100"},
            {label:"Noturno",     v:fmtH(resultado.totNot),   color:"#5C35C9"},
            {label:"Diárias viagem",v:`${resultado.totViagem}d`,color:"#185FA5"},
          ].map(k=>(
            <div key={k.label} style={{background:"var(--cinza-lt)",borderRadius:6,padding:"5px 6px",textAlign:"center"}}>
              <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",color:"#7A7A7A",lineHeight:1.2}}>{k.label}</div>
              <div style={{fontWeight:700,fontSize:12,color:k.color,marginTop:2}}>{k.v}</div>
            </div>
          ))}
        </div>
        {/* Legenda */}
        <div style={{fontSize:10,color:"#7A7A7A",marginBottom:8,lineHeight:1.5}}>
          Seg–Sex: 8h normal · Sáb: 08h–12h normal, após 50% · Dom/Feriado: 100%<br/>
          Noturno 20% (22h–05h) · Diária viagem: +1 dia/noite fora de SP &gt;100 km (CLT campo)
        </div>
        {resultado.linhas.length===0 ? (
          <div style={{color:"#7A7A7A",fontStyle:"italic",fontSize:11}}>Nenhum colaborador com salário cadastrado ou sem ponto na obra.</div>
        ):(
          <>
            <button onClick={()=>setAberto(a=>!a)} style={{background:"none",border:"none",color:"var(--afine-yellow-dk)",cursor:"pointer",fontSize:11,padding:0,fontWeight:600}}>
              {aberto?"▲ Ocultar detalhe":"▼ Ver por colaborador"}
            </button>
            {aberto&&(
              <div style={{overflowX:"auto",marginTop:8}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:520}}>
                  <thead>
                    <tr style={{background:"var(--cinza-lt)"}}>
                      <th style={{textAlign:"left",padding:"4px 6px"}}>Colaborador</th>
                      <th style={{padding:"4px"}}>Contrato</th>
                      <th style={{padding:"4px"}}>Normal</th>
                      <th style={{padding:"4px"}}>50%</th>
                      <th style={{padding:"4px"}}>100%</th>
                      <th style={{padding:"4px"}}>Noturno</th>
                      <th style={{padding:"4px"}}>Viagem</th>
                      <th style={{textAlign:"right",padding:"4px 6px"}}>Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.linhas.map(({f,nMs,e50Ms,e100Ms,notMs,diasViagem,custo,isCLT})=>(
                      <tr key={f.id} style={{borderBottom:"1px solid var(--border)"}}>
                        <td style={{padding:"4px 6px"}}>{f.nome}</td>
                        <td style={{textAlign:"center",padding:"4px"}}><span style={{fontSize:10,background:isCLT?"#E8F5E9":"#E3F2FD",color:isCLT?"var(--verde)":"#185FA5",borderRadius:4,padding:"1px 5px",fontWeight:600}}>{f.tipoContrato||"–"}</span></td>
                        <td style={{textAlign:"center",padding:"4px"}}>{fmtH(nMs)}</td>
                        <td style={{textAlign:"center",padding:"4px",color:"var(--afine-yellow-dk)"}}>{fmtH(e50Ms)}</td>
                        <td style={{textAlign:"center",padding:"4px",color:"#E65100"}}>{fmtH(e100Ms)}</td>
                        <td style={{textAlign:"center",padding:"4px",color:"#5C35C9"}}>{fmtH(notMs)}</td>
                        <td style={{textAlign:"center",padding:"4px",color:"#185FA5"}}>{diasViagem>0?`${diasViagem}d`:"–"}</td>
                        <td style={{textAlign:"right",padding:"4px 6px",fontWeight:700}}>{fmt(custo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Card Terceiro ─────────────────────────────────────────────────────────
function CardTerceiro({ obraId }) {
  const [custos, setCustos] = useState([]);
  useEffect(()=>{
    if(!obraId) return;
    const q=query(collection(db,"custos_demanda"),where("demandaId","==",obraId),where("tipo","==","Terceiro"));
    return onSnapshot(q,snap=>setCustos(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[obraId]);
  const ativos=custos.filter(c=>c.status!=="cancelado");
  const total=ativos.reduce((s,c)=>s+(Number(c.valor)||0),0);
  return (
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
      <div style={{background:"#185FA5",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>🤝</span>
          <span style={{color:"#fff",fontWeight:700,fontSize:13}}>Terceiro</span>
        </div>
        <span style={{color:"#fff",fontWeight:700,fontSize:14}}>{fmt(total)}</span>
      </div>
      <div style={{padding:"10px 14px",fontSize:12}}>
        <div style={{color:"#7A7A7A",marginBottom:6,fontSize:11}}>Valor da diária apenas — sem hora extra. ({ativos.length} lançamento{ativos.length!==1?"s":""})</div>
        {ativos.length>0?(
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:"var(--cinza-lt)"}}>
              <th style={{textAlign:"left",padding:"4px 6px"}}>Descrição</th>
              <th style={{padding:"4px 6px"}}>Data</th>
              <th style={{textAlign:"right",padding:"4px 6px"}}>Valor</th>
            </tr></thead>
            <tbody>
              {[...ativos].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(c=>(
                <tr key={c.id} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"4px 6px"}}>{c.descricao||"—"}</td>
                  <td style={{textAlign:"center",padding:"4px 6px"}}>{c.data?.split("-").reverse().join("/")||"—"}</td>
                  <td style={{textAlign:"right",padding:"4px 6px",fontWeight:700}}>{fmt(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ):<div style={{color:"#7A7A7A",fontStyle:"italic"}}>Nenhum custo de Terceiro lançado.</div>}
      </div>
    </div>
  );
}

// ── Card Imposto ──────────────────────────────────────────────────────────
function CardImposto({ orcamento, impostoPercent, onChange }) {
  const orc=Number(orcamento)||0;
  const pct=Number(impostoPercent)||0;
  const valor=orc*pct/100;
  const liquido=orc-valor;
  return (
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
      <div style={{background:"#C0392B",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>💸</span>
          <span style={{color:"#fff",fontWeight:700,fontSize:13}}>Imposto</span>
        </div>
        <span style={{color:"#fff",fontWeight:700,fontSize:14}}>{orc>0?`− ${fmt(valor)}`:"—"}</span>
      </div>
      <div style={{padding:"10px 14px",fontSize:12}}>
        <div style={{fontSize:11,color:"#7A7A7A",marginBottom:8}}>Descontado diretamente do valor orçado, antes de outros descontos.</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <label style={{fontWeight:600,fontSize:12,whiteSpace:"nowrap"}}>% sobre orçamento:</label>
          <input type="number" min="0" max="100" step="0.01" value={impostoPercent} onChange={e=>onChange(e.target.value)}
            style={{width:80,padding:"4px 8px",border:"1px solid var(--border)",borderRadius:6,fontSize:12,textAlign:"right"}}/>
          <span style={{fontSize:12,color:"#7A7A7A"}}>%</span>
        </div>
        {orc>0&&(
          <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            <div style={{background:"var(--cinza-lt)",borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
              <div style={{color:"#7A7A7A",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Orçamento bruto</div>
              <div style={{fontWeight:700,fontSize:12}}>{fmt(orc)}</div>
            </div>
            <div style={{background:"#FFEBEE",borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
              <div style={{color:"#7A7A7A",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Imposto ({pct}%)</div>
              <div style={{fontWeight:700,fontSize:12,color:"#C0392B"}}>− {fmt(valor)}</div>
            </div>
            <div style={{background:"#E8F5E9",borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
              <div style={{color:"#7A7A7A",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Líquido</div>
              <div style={{fontWeight:700,fontSize:12,color:"var(--verde)"}}>{fmt(liquido)}</div>
            </div>
          </div>
        )}
        {!orc&&<div style={{fontSize:11,color:"#7A7A7A",fontStyle:"italic",marginTop:8}}>Cadastre o valor do orçamento na aba Financeiro para ver o cálculo.</div>}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function CustosMaoDeObra({ obraId, equipeIds, funcionarios, orcamento, impostoPercent, onImpostoChange, onCustoMaoDeObraChange }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Composição de custos</div>
      <CardImposto orcamento={orcamento} impostoPercent={impostoPercent} onChange={onImpostoChange}/>
      <CardMaoDeObra obraId={obraId} equipeIds={equipeIds} funcionarios={funcionarios} onCustoChange={onCustoMaoDeObraChange}/>
      <CardTerceiro obraId={obraId}/>
      <div style={{height:1,background:"var(--border)",margin:"4px 0"}}/>
      <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Todos os lançamentos</div>
    </div>
  );
}
