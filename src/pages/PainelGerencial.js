// src/pages/PainelGerencial.js — Dashboard executivo / Controle Total
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";

// Mini gráfico de barras embutido (sem lib externa)
function MiniBarChart({ dados, cor="#F5C800", altura=80 }) {
  if(!dados||dados.length===0) return <div style={{height:altura,display:"flex",alignItems:"center",justifyContent:"center",color:"#7A7A7A",fontSize:12}}>Sem dados</div>;
  const max = Math.max(...dados.map(d=>d.valor||0),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:altura,padding:"0 4px"}}>
      {dados.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{width:"100%",background:cor,borderRadius:"3px 3px 0 0",transition:"height .4s",height:`${Math.max(4,(d.valor/max)*altura*0.85)}px`,opacity:.85+i*.02}}/>
          <span style={{fontSize:9,color:"#7A7A7A",whiteSpace:"nowrap"}}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// Gráfico de linha simples SVG
function MiniLineChart({ dados, cor="#2D6A1F", altura=80 }) {
  if(!dados||dados.length<2) return <div style={{height:altura,display:"flex",alignItems:"center",justifyContent:"center",color:"#7A7A7A",fontSize:12}}>Sem dados suficientes</div>;
  const vals = dados.map(d=>d.valor||0);
  const max  = Math.max(...vals,1);
  const min  = Math.min(...vals,0);
  const range= max-min||1;
  const W=300, H=altura;
  const pts = vals.map((v,i)=>({
    x: (i/(vals.length-1))*W,
    y: H - ((v-min)/range)*(H-16)-8,
  }));
  const d = pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:altura}}>
      <defs>
        <linearGradient id={`grad-${cor.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity=".3"/>
          <stop offset="100%" stopColor={cor} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={d+" L"+pts[pts.length-1].x+","+H+" L0,"+H+" Z"} fill={`url(#grad-${cor.replace("#","")})`}/>
      <path d={d} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={cor}/>
      ))}
    </svg>
  );
}

// Gauge circular de porcentagem
function Gauge({ pct=0, cor="#F5C800", label="" }) {
  const r=36, cx=44, cy=44;
  const circ = 2*Math.PI*r;
  const dash  = (pct/100)*circ;
  return (
    <div style={{textAlign:"center"}}>
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E0DED8" strokeWidth={8}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={cor} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{transformOrigin:"44px 44px",transform:"rotate(-90deg)",transition:"stroke-dasharray .6s ease"}}/>
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight={700} fill="#1A1A1A">{pct}%</text>
      </svg>
      <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>{label}</div>
    </div>
  );
}

// Card de KPI com tendência
function KPICard({ label, valor, sub, trend, cor="#1A1A1A", bg, icon }) {
  const trendPos = trend>0;
  return (
    <div style={{background:bg||"#fff",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:12,right:14,fontSize:22,opacity:.12}}>{icon}</div>
      <div style={{fontSize:11,color:"#7A7A7A",marginBottom:4,fontWeight:500,textTransform:"uppercase",letterSpacing:".04em"}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:cor,marginBottom:4}}>{valor}</div>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        {trend!=null && <span style={{fontSize:11,fontWeight:600,color:trendPos?"var(--verde)":"var(--vermelho)"}}>{trendPos?"↑":"↓"} {Math.abs(trend)}%</span>}
        {sub && <span style={{fontSize:11,color:"#7A7A7A"}}>{sub}</span>}
      </div>
    </div>
  );
}

export default function PainelGerencial() {
  const [obras,   setObras]   = useState([]);
  const [lancs,   setLancs]   = useState([]);
  const [manuts,  setManuts]  = useState([]);
  const [compras, setCompras] = useState([]);
  const [ops,     setOps]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"obras"),snap=>{setObras(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2=onSnapshot(collection(db,"financeiro"),snap=>setLancs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"manutencoes"),snap=>setManuts(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4=onSnapshot(collection(db,"compras"),snap=>setCompras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u5=onSnapshot(collection(db,"oportunidades"),snap=>setOps(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();u4();u5();};
  },[]);

  const hoje = new Date().toISOString().split("T")[0];
  const fmt  = v=>`R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0})}`;

  // KPIs Financeiros
  const totalRec   = lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="ABERTO").reduce((s,l)=>s+(l.valor||0),0);
  const totalPag   = lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="ABERTO").reduce((s,l)=>s+(l.valor||0),0);
  const vencidos   = lancs.filter(l=>l.status==="ABERTO"&&l.vencimento<hoje).length;
  const saldo      = totalRec-totalPag;

  // Obras
  const obrasAtivas= obras.filter(o=>o.status==="EM ANDAMENTO");
  const progMedio  = obrasAtivas.length>0 ? Math.round(obrasAtivas.reduce((s,o)=>s+(o.progresso||0),0)/obrasAtivas.length) : 0;
  const atrasadas  = obrasAtivas.filter(o=>o.termino&&o.termino<hoje&&(o.progresso||0)<100);

  // Compras
  const compAbertas= compras.filter(c=>["SOLICITAÇÃO","COTAÇÃO"].includes(c.status));
  const compValor  = compAbertas.reduce((s,c)=>s+(c.valorCotado||0),0);

  // Comercial
  const pipeline   = ops.filter(o=>o.coluna!=="PERDIDO").reduce((s,o)=>s+(o.valor||0),0);
  const txConv     = ops.length>0?Math.round(ops.filter(o=>o.coluna==="CONTRATO").length/ops.length*100):0;

  // Fluxo de caixa projetado (próximos 6 meses)
  function fluxoMes(offset) {
    const d = new Date(); d.setMonth(d.getMonth()+offset);
    const m = d.toISOString().slice(0,7);
    const rec = lancs.filter(l=>l.tipo==="RECEBER"&&(l.vencimento||"").startsWith(m)).reduce((s,l)=>s+(l.valor||0),0);
    const pag = lancs.filter(l=>l.tipo==="PAGAR"&&(l.vencimento||"").startsWith(m)).reduce((s,l)=>s+(l.valor||0),0);
    const mes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.getMonth()];
    return { label:mes, valor:rec-pag, rec, pag };
  }
  const fluxo6m = Array.from({length:6},(_,i)=>fluxoMes(i));

  // Progresso obras (Curva S simplificada)
  const obrasGrafico = obrasAtivas.slice(0,6).map(o=>({label:o.nome?.slice(0,8)||"–",valor:o.progresso||0}));

  // Status compras por etapa
  const etapasCompras = ["SOLICITAÇÃO","COTAÇÃO","APROVADA","ORDEM DE COMPRA","RECEBIDO","NF VINCULADA"]
    .map(e=>({label:e.slice(0,6),valor:compras.filter(c=>c.status===e).length}));

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div className="panel-title" style={{fontSize:20}}>Painel Gerencial</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <span style={{fontSize:11,background:"var(--verde-lt)",color:"var(--verde)",padding:"4px 10px",borderRadius:20,fontWeight:600}}>● Sistema online</span>
        </div>
      </div>

      {/* KPIs linha 1 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
        <KPICard label="A receber" valor={fmt(totalRec)} icon="💰" cor="var(--verde)" sub="em aberto"/>
        <KPICard label="A pagar"   valor={fmt(totalPag)} icon="📤" cor="var(--vermelho)" sub="em aberto"/>
        <KPICard label="Saldo projetado" valor={fmt(saldo)} icon="🏦" cor={saldo>=0?"var(--verde)":"var(--vermelho)"}/>
        <KPICard label="Vencidos"  valor={`${vencidos} lanç.`} icon="⚠️" cor={vencidos>0?"var(--vermelho)":"var(--verde)"} sub={vencidos>0?"atenção":"ok"}/>
        <KPICard label="Obras ativas" valor={obrasAtivas.length} icon="🏗️" sub={`${atrasadas.length} atrasadas`} cor={atrasadas.length>0?"var(--vermelho)":"#1A1A1A"}/>
        <KPICard label="Progresso médio" valor={`${progMedio}%`} icon="📊" cor="var(--afine-yellow-dk)"/>
        <KPICard label="Pipeline comercial" valor={fmt(pipeline)} icon="📈" cor="var(--afine-yellow-dk)"/>
        <KPICard label="Conversão" valor={`${txConv}%`} icon="🎯" sub={`${ops.filter(o=>o.coluna==="CONTRATO").length} contratos`}/>
      </div>

      {/* Grid de gráficos */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>

        {/* Progresso de Obras */}
        <div className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontWeight:600,fontSize:14}}>🏗️ Produção — Avanço físico</div>
              <div style={{fontSize:11,color:"#7A7A7A"}}>Progresso por obra ativa</div>
            </div>
            <Gauge pct={progMedio} cor="#F5C800" label="Média"/>
          </div>
          {obrasAtivas.length===0 ? <div className="empty-state" style={{padding:"16px 0"}}><p>Nenhuma obra ativa</p></div> : (
            obrasAtivas.slice(0,5).map(o=>{
              const atrasada = o.termino&&o.termino<hoje&&(o.progresso||0)<100;
              return (
                <div key={o.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                    <span style={{fontWeight:500,color:atrasada?"var(--vermelho)":"#1A1A1A"}}>{o.nome} {atrasada&&"⚠️"}</span>
                    <span style={{fontWeight:700}}>{o.progresso||0}%</span>
                  </div>
                  <div className="progress-bar" style={{height:6}}>
                    <div className="progress-fill" style={{width:`${o.progresso||0}%`,
                      background:o.progresso>=100?"var(--verde)":atrasada?"var(--vermelho)":"var(--afine-yellow-dk)"}}/>
                  </div>
                  {atrasada&&<div style={{fontSize:10,color:"var(--vermelho)",marginTop:2}}>Término previsto: {new Date(o.termino).toLocaleDateString("pt-BR")}</div>}
                </div>
              );
            })
          )}
        </div>

        {/* Fluxo de caixa projetado */}
        <div className="card">
          <div style={{marginBottom:14}}>
            <div style={{fontWeight:600,fontSize:14}}>💰 Fluxo de caixa projetado</div>
            <div style={{fontSize:11,color:"#7A7A7A"}}>Próximos 6 meses (receber − pagar)</div>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100}}>
            {fluxo6m.map((m,i)=>{
              const max = Math.max(...fluxo6m.map(x=>Math.abs(x.valor)),1);
              const h   = Math.abs(m.valor)/max*80;
              const pos = m.valor>=0;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:100}}>
                  {pos?<div style={{width:"100%",height:h,background:"var(--verde)",borderRadius:"4px 4px 0 0",opacity:.85}}/>:null}
                  <div style={{width:"100%",height:1,background:"#E0DED8"}}/>
                  {!pos?<div style={{width:"100%",height:h,background:"var(--vermelho)",borderRadius:"0 0 4px 4px",opacity:.85}}/>:null}
                  <div style={{fontSize:9,color:"#7A7A7A",marginTop:3,textAlign:"center"}}>{m.label}</div>
                  <div style={{fontSize:8,fontWeight:700,color:pos?"var(--verde)":"var(--vermelho)"}}>
                    {pos?"+":""}{Math.round(m.valor/1000)}k
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,marginTop:10}}>
            <span style={{fontSize:11,display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"var(--verde)",borderRadius:2,display:"inline-block"}}/> Positivo</span>
            <span style={{fontSize:11,display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"var(--vermelho)",borderRadius:2,display:"inline-block"}}/> Negativo</span>
          </div>
        </div>

        {/* Compras por estágio */}
        <div className="card">
          <div style={{marginBottom:14}}>
            <div style={{fontWeight:600,fontSize:14}}>🛒 Compras — Fluxo de suprimentos</div>
            <div style={{fontSize:11,color:"#7A7A7A"}}>{compras.length} pedidos · {fmt(compValor)} em aberto</div>
          </div>
          <MiniBarChart dados={etapasCompras} cor="#C9A200" altura={100}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <div style={{background:"var(--afine-yellow-lt)",borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:10,color:"#8A6000"}}>Aguardando cotação</div>
              <div style={{fontSize:16,fontWeight:700,color:"var(--afine-yellow-dk)"}}>{compras.filter(c=>c.status==="SOLICITAÇÃO").length}</div>
            </div>
            <div style={{background:"var(--vermelho-lt)",borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:10,color:"var(--vermelho)"}}>Valor comprometido</div>
              <div style={{fontSize:14,fontWeight:700,color:"var(--vermelho)"}}>{fmt(compras.filter(c=>["APROVADA","ORDEM DE COMPRA"].includes(c.status)).reduce((s,c)=>s+(c.valorAprovado||0),0))}</div>
            </div>
          </div>
        </div>

        {/* Saúde financeira */}
        <div className="card">
          <div style={{marginBottom:14}}>
            <div style={{fontWeight:600,fontSize:14}}>📊 Saúde financeira</div>
            <div style={{fontSize:11,color:"#7A7A7A"}}>Visão consolidada atual</div>
          </div>
          <div style={{display:"flex",gap:20,justifyContent:"center",marginBottom:14}}>
            <Gauge pct={totalRec>0?Math.min(100,Math.round(totalRec/(totalRec+totalPag)*100)):50} cor="var(--verde)" label="Receber"/>
            <Gauge pct={totalPag>0?Math.min(100,Math.round(totalPag/(totalRec+totalPag)*100)):50} cor="var(--vermelho)" label="Pagar"/>
            <Gauge pct={txConv} cor="var(--afine-yellow-dk)" label="Conversão"/>
          </div>
          {vencidos>0&&(
            <div className="alert alert-danger" style={{fontSize:12}}>
              ⚠️ <strong>{vencidos} lançamento(s) vencido(s)</strong> — ação necessária.
            </div>
          )}
          <div style={{fontSize:12,color:"#7A7A7A",marginTop:8}}>
            Manutenções abertas: <strong style={{color:"var(--vermelho)"}}>{manuts.filter(m=>["ABERTA","EM ANDAMENTO"].includes(m.status)).length}</strong>
            &nbsp;·&nbsp;
            Pipeline: <strong style={{color:"var(--afine-yellow-dk)"}}>{fmt(pipeline)}</strong>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {atrasadas.length>0&&(
        <div className="card" style={{borderLeft:"4px solid var(--vermelho)"}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:10}}>🚨 Alertas — Obras em desvio</div>
          {atrasadas.map(o=>(
            <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
              <div>
                <div style={{fontWeight:500,fontSize:13}}>{o.nome}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>{o.cliente} · {o.progresso||0}% concluído</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:"var(--vermelho)",fontWeight:600}}>Término: {fmtDate(o.termino)}</div>
                <span className="badge badge-red">ATRASADA</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
