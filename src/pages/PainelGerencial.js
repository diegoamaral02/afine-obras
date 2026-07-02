// src/pages/PainelGerencial.js — v2: paginado + memoizado + listeners limitados
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where, limit, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useFinanceiroKPIs } from "../hooks/useFinanceiroKPIs";

// ── Componentes de gráfico (SVG puro, sem deps) ──────────────────
function MiniBarChart({ dados, cor="#F5C800", altura=80 }) {
  const max = useMemo(()=>Math.max(...(dados||[]).map(d=>d.valor||0),1),[dados]);
  if(!dados||dados.length===0) return <EmptyChart altura={altura}/>;
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:altura,padding:"0 4px"}}>
      {dados.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{width:"100%",background:cor,borderRadius:"3px 3px 0 0",
            height:`${Math.max(4,(d.valor/max)*altura*0.85)}px`,opacity:.85+i*.01}}/>
          <span style={{fontSize:9,color:"#7A7A7A",whiteSpace:"nowrap"}}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ altura=80 }) {
  return <div style={{height:altura,display:"flex",alignItems:"center",justifyContent:"center",color:"#7A7A7A",fontSize:12,background:"var(--cinza-lt)",borderRadius:6}}>Sem dados ainda</div>;
}

function Gauge({ pct=0, cor="#F5C800", label="" }) {
  const r=36,cx=44,cy=44,circ=2*Math.PI*r;
  const dash=useMemo(()=>(pct/100)*circ,[pct,circ]);
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

function KPICard({ label, valor, sub, cor="#1A1A1A", icon, trend }) {
  const trendPos = trend > 0;
  return (
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:12,right:14,fontSize:22,opacity:.1}}>{icon}</div>
      <div style={{fontSize:10,color:"#7A7A7A",marginBottom:4,fontWeight:500,textTransform:"uppercase",letterSpacing:".04em"}}>{label}</div>
      <div style={{fontSize:20,fontWeight:700,color:cor,marginBottom:4,lineHeight:1}}>{valor}</div>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        {trend!=null&&<span style={{fontSize:11,fontWeight:600,color:trendPos?"var(--verde)":"var(--vermelho)"}}>{trendPos?"↑":"↓"}{Math.abs(trend)}%</span>}
        {sub&&<span style={{fontSize:11,color:"#7A7A7A"}}>{sub}</span>}
      </div>
    </div>
  );
}

// Skeleton loader para KPIs
function KPISkeleton() {
  return (
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px"}}>
      {[60,100,40].map((w,i)=>(
        <div key={i} style={{height:i===1?24:12,background:"var(--cinza-lt)",borderRadius:4,marginBottom:8,width:`${w}%`,
          animation:"pulse 1.5s ease-in-out infinite"}}/>
      ))}
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

  useEffect(() => {
    // MELHORIA: todos os listeners com limit() para não baixar dados infinitos
    const hoje = new Date().toISOString().split("T")[0];
    const u1 = onSnapshot(query(collection(db,"obras"),limit(100)), snap=>{
      setObras(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    const u2 = onSnapshot(query(collection(db,"financeiro"),limit(500)), snap=>
      setLancs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3 = onSnapshot(query(collection(db,"manutencoes"),where("status","in",["ABERTA","EM ANDAMENTO"]),limit(100)), snap=>
      setManuts(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4 = onSnapshot(query(collection(db,"compras"),limit(200)), snap=>
      setCompras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u5 = onSnapshot(query(collection(db,"oportunidades"),limit(200)), snap=>
      setOps(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();u4();u5();};
  },[]);

  const hoje = new Date().toISOString().split("T")[0];
  const fmt  = v=>`R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0})}`;

  // MELHORIA: todos os cálculos memoizados
  const kpis = useFinanceiroKPIs(lancs);

  const obrasStats = useMemo(()=>({
    ativas:    obras.filter(o=>o.status==="EM ANDAMENTO"),
    concluidas:obras.filter(o=>o.status==="CONCLUÍDA"),
    atrasadas: obras.filter(o=>o.status==="EM ANDAMENTO"&&o.termino&&o.termino<hoje&&(o.progresso||0)<100),
    progMedio: obras.filter(o=>o.status==="EM ANDAMENTO").length>0
      ? Math.round(obras.filter(o=>o.status==="EM ANDAMENTO").reduce((s,o)=>s+(o.progresso||0),0)/obras.filter(o=>o.status==="EM ANDAMENTO").length)
      : 0,
  }),[obras, hoje]);

  const manutsAtrasadas = useMemo(()=>
    manuts.filter(m=>["ABERTA","EM ANDAMENTO"].includes(m.status)&&m.dataPrevista&&m.dataPrevista<hoje)
  ,[manuts, hoje]);

  const comprasStats = useMemo(()=>({
    abertas:     compras.filter(c=>["SOLICITAÇÃO","COTAÇÃO"].includes(c.status)).length,
    comprometido:compras.filter(c=>["APROVADA","ORDEM DE COMPRA"].includes(c.status)).reduce((s,c)=>s+(c.valorAprovado||0),0),
    porEtapa:    ["SOLICITAÇÃO","COTAÇÃO","APROVADA","ORDEM DE COMPRA","RECEBIDO","NF VINCULADA"]
      .map(e=>({label:e.slice(0,5),valor:compras.filter(c=>c.status===e).length})),
  }),[compras]);

  const comercialStats = useMemo(()=>({
    pipeline: ops.filter(o=>o.coluna!=="PERDIDO").reduce((s,o)=>s+(o.valor||0),0),
    txConv:   ops.length>0?Math.round(ops.filter(o=>o.coluna==="CONTRATO").length/ops.length*100):0,
    contratos:ops.filter(o=>o.coluna==="CONTRATO").length,
  }),[ops]);

  if (loading) return (
    <div>
      <div style={{marginBottom:20}}>
        <div style={{height:24,background:"var(--cinza-lt)",borderRadius:6,width:200,marginBottom:8}}/>
        <div style={{height:14,background:"var(--cinza-lt)",borderRadius:6,width:300}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
        {Array(8).fill(0).map((_,i)=><KPISkeleton key={i}/>)}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div className="panel-title" style={{fontSize:20}}>Painel Gerencial</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</div>
        </div>
        <span style={{fontSize:11,background:"var(--verde-lt)",color:"var(--verde)",padding:"4px 10px",borderRadius:20,fontWeight:600}}>● Online</span>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:20}}>
        <KPICard label="A receber"       valor={fmt(kpis.totalRec)}         icon="💰" cor="var(--verde)"             sub="em aberto"/>
        <KPICard label="A pagar"         valor={fmt(kpis.totalPag)}         icon="📤" cor="var(--vermelho)"          sub="em aberto"/>
        <KPICard label="Saldo projetado" valor={fmt(kpis.saldo)}            icon="🏦" cor={kpis.saldo>=0?"var(--verde)":"var(--vermelho)"}/>
        <KPICard label="Vencidos"        valor={`${kpis.vencidosCount} lanç`} icon="⚠️" cor={kpis.vencidosCount>0?"var(--vermelho)":"var(--verde)"} sub={kpis.vencidosCount>0?"atenção":"ok"}/>
        <KPICard label="Obras ativas"    valor={obrasStats.ativas.length}   icon="🏗️" sub={`${obrasStats.atrasadas.length} atrasada(s)`} cor={obrasStats.atrasadas.length>0?"var(--vermelho)":"#1A1A1A"}/>
        <KPICard label="Prog. médio"     valor={`${obrasStats.progMedio}%`} icon="📊" cor="var(--afine-yellow-dk)"/>
        <KPICard label="Pipeline"        valor={fmt(comercialStats.pipeline)} icon="📈" cor="var(--afine-yellow-dk)"/>
        <KPICard label="Conversão"       valor={`${comercialStats.txConv}%`} icon="🎯" sub={`${comercialStats.contratos} contratos`}/>
      </div>

      {kpis.vencidosCount>0&&(
        <div className="alert alert-danger" style={{marginBottom:16}}>
          ⚠️ <strong>{kpis.vencidosCount} lançamento(s) vencido(s)</strong> — acesse Financeiro para regularizar.
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* Produção */}
        <div className="card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div><div style={{fontWeight:600,fontSize:14}}>🏗️ Avanço físico por obra</div><div style={{fontSize:11,color:"#7A7A7A"}}>{obrasStats.ativas.length} em andamento</div></div>
            <Gauge pct={obrasStats.progMedio} cor="#F5C800" label="Média"/>
          </div>
          {obrasStats.ativas.length===0
            ? <EmptyChart altura={80}/>
            : obrasStats.ativas.slice(0,5).map(o=>{
                const atrasada=o.termino&&o.termino<hoje&&(o.progresso||0)<100;
                return (
                  <div key={o.id} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
                      <span style={{fontWeight:500,color:atrasada?"var(--vermelho)":"#1A1A1A"}}>{o.nome?.slice(0,22)}{atrasada?" ⚠️":""}</span>
                      <span style={{fontWeight:700}}>{o.progresso||0}%</span>
                    </div>
                    <div className="progress-bar" style={{height:5}}>
                      <div className="progress-fill" style={{width:`${o.progresso||0}%`,background:o.progresso>=100?"var(--verde)":atrasada?"var(--vermelho)":"var(--afine-yellow-dk)"}}/>
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* Fluxo de caixa */}
        <div className="card">
          <div style={{marginBottom:14}}>
            <div style={{fontWeight:600,fontSize:14}}>💰 Fluxo de caixa projetado</div>
            <div style={{fontSize:11,color:"#7A7A7A"}}>Próximos 6 meses</div>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100}}>
            {kpis.fluxo6m.map((m,i)=>{
              const maxVal=Math.max(...kpis.fluxo6m.map(x=>Math.abs(x.valor)),1);
              const h=Math.abs(m.valor)/maxVal*80;
              const pos=m.valor>=0;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:100}}>
                  {pos&&<div style={{width:"100%",height:h,background:"var(--verde)",borderRadius:"4px 4px 0 0",opacity:.85}}/>}
                  <div style={{width:"100%",height:1,background:"#E0DED8"}}/>
                  {!pos&&<div style={{width:"100%",height:h,background:"var(--vermelho)",borderRadius:"0 0 4px 4px",opacity:.85}}/>}
                  <div style={{fontSize:9,color:"#7A7A7A",marginTop:3}}>{m.label}</div>
                  <div style={{fontSize:8,fontWeight:700,color:pos?"var(--verde)":"var(--vermelho)"}}>{pos?"+":""}{Math.round(m.valor/1000)}k</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compras */}
        <div className="card">
          <div style={{marginBottom:14}}>
            <div style={{fontWeight:600,fontSize:14}}>🛒 Compras por estágio</div>
            <div style={{fontSize:11,color:"#7A7A7A"}}>{comprasStats.abertas} aguardando · {fmt(comprasStats.comprometido)} comprometido</div>
          </div>
          <MiniBarChart dados={comprasStats.porEtapa} cor="#C9A200" altura={90}/>
        </div>

        {/* Saúde financeira */}
        <div className="card">
          <div style={{marginBottom:14}}><div style={{fontWeight:600,fontSize:14}}>📊 Saúde financeira</div></div>
          <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:12}}>
            <Gauge pct={kpis.totalRec>0?Math.min(100,Math.round(kpis.totalRec/(kpis.totalRec+kpis.totalPag)*100)):50} cor="var(--verde)" label="Receber"/>
            <Gauge pct={kpis.totalPag>0?Math.min(100,Math.round(kpis.totalPag/(kpis.totalRec+kpis.totalPag)*100)):50} cor="var(--vermelho)" label="Pagar"/>
            <Gauge pct={comercialStats.txConv} cor="var(--afine-yellow-dk)" label="Conversão"/>
          </div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>
            Manutenções abertas: <strong style={{color:"var(--vermelho)"}}>{manuts.length}</strong>
            &nbsp;·&nbsp;Pipeline: <strong style={{color:"var(--afine-yellow-dk)"}}>{fmt(comercialStats.pipeline)}</strong>
          </div>
        </div>
      </div>

      {/* Alertas — Obras atrasadas */}
      {obrasStats.atrasadas.length>0&&(
        <div className="card" style={{borderLeft:"4px solid var(--vermelho)"}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:10}}>🚨 Obras com desvio de prazo</div>
          {obrasStats.atrasadas.map(o=>(
            <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
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

      {/* Alertas — Manutenções atrasadas */}
      {manutsAtrasadas.length>0&&(
        <div className="card" style={{borderLeft:"4px solid var(--vermelho)"}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:10}}>🔧 Manutenções com desvio de prazo</div>
          {manutsAtrasadas.map(m=>(
            <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
              <div>
                <div style={{fontWeight:500,fontSize:13}}>{m.titulo||m.nome||"–"}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>
                  {m.cliente} · {m.agencia&&`${m.agencia} · `}{m.cidade||""}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:"var(--vermelho)",fontWeight:600}}>Previsto: {fmtDate(m.dataPrevista)}</div>
                <span className="badge badge-red">ATRASADA</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
