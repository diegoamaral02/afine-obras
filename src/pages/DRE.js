// src/pages/DRE.js — v2: "Resultados" com 6 sub-abas completas e indicadores corretos
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, limit } from "firebase/firestore";
import { db } from "../firebase";
import FiltroAvancado, { dentroPeriodo } from "../components/FiltroAvancado";

const fmt  = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const fmtK = v => { const n=Number(v||0); return n>=1000?`R$ ${(n/1000).toFixed(1)}k`:`R$ ${n.toFixed(0)}`; };
const pct  = (v,t) => t>0?`${Math.round(v/t*100)}%`:"–";
const pctN = (v,t) => t>0?Math.round(v/t*100):0;

// ── Gauge circular SVG ────────────────────────────────────────────────────────
function Gauge({ valor=0, max=100, cor="#F5C800", label="", tamanho=80 }) {
  const r=tamanho/2-6, cx=tamanho/2, cy=tamanho/2;
  const circ=2*Math.PI*r;
  const p=Math.min(Math.max(valor/max,0),1);
  const dash=p*circ;
  return (
    <div style={{textAlign:"center"}}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E0DED8" strokeWidth={7}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={cor} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{transformOrigin:`${cx}px ${cy}px`,transform:"rotate(-90deg)",transition:"stroke-dasharray .6s"}}/>
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fontSize={tamanho*0.2} fontWeight={700} fill="#1A1A1A">
          {valor}%
        </text>
      </svg>
      {label&&<div style={{fontSize:10,color:"#7A7A7A",marginTop:2,lineHeight:1.2}}>{label}</div>}
    </div>
  );
}

// ── Mini barra horizontal ─────────────────────────────────────────────────────
function MiniBar({ valor, total, cor="#F5C800", height=6 }) {
  const p=total>0?Math.min(valor/total*100,100):0;
  return (
    <div style={{background:"#E0DED8",borderRadius:3,height,overflow:"hidden"}}>
      <div style={{width:`${p}%`,height:"100%",background:cor,borderRadius:3,transition:"width .4s"}}/>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPI({ label, valor, cor="#1A1A1A", sub, icon, destaque }) {
  return (
    <div style={{background:destaque?"#1A1A1A":"#fff",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",position:"relative",overflow:"hidden"}}>
      {icon&&<div style={{position:"absolute",top:10,right:12,fontSize:20,opacity:.1}}>{icon}</div>}
      <div style={{fontSize:10,color:destaque?"rgba(255,255,255,.5)":"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:3}}>{label}</div>
      <div style={{fontSize:18,fontWeight:700,color:destaque?"#F5C800":cor,lineHeight:1}}>{valor}</div>
      {sub&&<div style={{fontSize:11,color:destaque?"rgba(255,255,255,.4)":"#7A7A7A",marginTop:4}}>{sub}</div>}
    </div>
  );
}

// ── Sub-aba: Resultado por Projeto ────────────────────────────────────────────
// ── Visão Mensal — DRE consolidado da empresa toda, mês a mês ─────────────
// Junta lançamentos do Financeiro + Compras recebidas/faturadas + Despesas
// (mesma lógica de custo real já usada em Resultado por Projeto), mas
// agregado globalmente (todas as obras) e quebrado por mês.
function AbaVisaoMensal({ lancs, compras, despesas }) {
  const [qtdMeses, setQtdMeses] = useState(12);
  const [filtros, setFiltros] = useState({ periodoCustom:{de:"",ate:""} });

  const dadosMensais = useMemo(() => {
    const hj = new Date();
    const meses = Array.from({length: qtdMeses}, (_, i) => {
      const d = new Date(hj.getFullYear(), hj.getMonth() - (qtdMeses-1) + i, 1);
      return d.toISOString().slice(0,7);
    }).filter(m => {
      if (!filtros.periodoCustom.de && !filtros.periodoCustom.ate) return true;
      if (filtros.periodoCustom.de && m < filtros.periodoCustom.de.slice(0,7)) return false;
      if (filtros.periodoCustom.ate && m > filtros.periodoCustom.ate.slice(0,7)) return false;
      return true;
    });

    return meses.map(m => {
      const lMes = lancs.filter(x => (x.vencimento||"").startsWith(m) || (x.pagamento||"").startsWith(m));
      const receita = lMes.filter(x=>x.tipo==="RECEBER"&&(x.status==="PAGO"||x.status==="RECEBIDO")&&(x.pagamento||x.vencimento||"").startsWith(m))
        .reduce((s,x)=>s+(x.valor||0),0);
      const custoLanc = lMes.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)&&(x.pagamento||x.vencimento||"").startsWith(m))
        .reduce((s,x)=>s+(x.valor||0),0);
      const custosAdmin = lMes.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&!["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)&&(x.pagamento||x.vencimento||"").startsWith(m))
        .reduce((s,x)=>s+(x.valor||0),0);
      const custoCompras = compras.filter(c=>["RECEBIDO","AGUARD. NF","NF VINCULADA"].includes(c.status)&&(c.dataRecebimento||"").startsWith(m))
        .reduce((s,c)=>s+(c.valorAprovado||c.valorCotado||0),0);
      const custoDespesas = despesas.filter(d=>(d.data||"").startsWith(m)).reduce((s,d)=>s+(d.valor||0),0);
      const custoDireto = custoLanc + custoCompras + custoDespesas;
      const lucroBruto = receita - custoDireto;
      const lucroLiq   = lucroBruto - custosAdmin;
      const [ano,mesNum] = m.split("-");
      const label = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][Number(mesNum)-1] + "/" + ano.slice(2);
      return { m, label, receita, custoLanc, custoCompras, custoDespesas, custoDireto, custosAdmin, lucroBruto, lucroLiq,
        margBrutaPct: pctN(lucroBruto, receita), margLiqPct: pctN(lucroLiq, receita) };
    });
  }, [lancs, compras, despesas, qtdMeses]);

  const totais = useMemo(() => dadosMensais.reduce((acc, m) => ({
    receita: acc.receita + m.receita, custoDireto: acc.custoDireto + m.custoDireto,
    custosAdmin: acc.custosAdmin + m.custosAdmin, lucroBruto: acc.lucroBruto + m.lucroBruto, lucroLiq: acc.lucroLiq + m.lucroLiq,
  }), {receita:0,custoDireto:0,custosAdmin:0,lucroBruto:0,lucroLiq:0}), [dadosMensais]);

  const maxVal = Math.max(...dadosMensais.map(m=>Math.max(m.receita,m.custoDireto+m.custosAdmin)), 1);
  const H = 110;

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Visão Mensal — DRE consolidado</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>Toda a empresa, mês a mês — receita, custo direto (lançamentos + compras + despesas), custos administrativos e lucro</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={qtdMeses} onChange={e=>setQtdMeses(Number(e.target.value))} style={{width:140}}>
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
            <option value={24}>Últimos 24 meses</option>
          </select>
        </div>
      </div>

      <FiltroAvancado
        campos={[{ tipo:"periodo", key:"periodoCustom", label:"Período personalizado (sobrepõe a seleção acima)" }]}
        valores={filtros} onChange={setFiltros}
        onLimpar={()=>setFiltros({ periodoCustom:{de:"",ate:""} })}
      />

      {/* KPIs consolidados do período */}
      <div className="metrics-grid">
        <KPI label="Receita total"      valor={fmt(totais.receita)}    cor="var(--verde)" icon="💰"/>
        <KPI label="Custo direto total" valor={fmt(totais.custoDireto)} cor="var(--vermelho)" icon="📦"/>
        <KPI label="Custos admin. total" valor={fmt(totais.custosAdmin)} cor="#BA7517" icon="🏢"/>
        <KPI label="Lucro líquido total" valor={fmt(totais.lucroLiq)} cor={totais.lucroLiq>=0?"var(--verde)":"var(--vermelho)"} icon={totais.lucroLiq>=0?"📈":"📉"} destaque/>
      </div>

      {/* Gráfico de barras: receita vs custo vs lucro, mês a mês */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>📊 Receita × Custo × Lucro líquido</div>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6}}>
          {dadosMensais.map(m=>(
            <div key={m.m} style={{flex:"0 0 56px",display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{display:"flex",gap:2,alignItems:"flex-end",height:H,marginBottom:4}}>
                <div title={`Receita: ${fmt(m.receita)}`} style={{width:14,background:"var(--verde)",borderRadius:"3px 3px 0 0",height:`${Math.max(2,m.receita/maxVal*H)}px`}}/>
                <div title={`Custo direto: ${fmt(m.custoDireto)}`} style={{width:14,background:"var(--vermelho)",borderRadius:"3px 3px 0 0",height:`${Math.max(2,m.custoDireto/maxVal*H)}px`}}/>
                <div title={`Custos admin.: ${fmt(m.custosAdmin)}`} style={{width:14,background:"#D9A03B",borderRadius:"3px 3px 0 0",height:`${Math.max(2,m.custosAdmin/maxVal*H)}px`}}/>
              </div>
              <div style={{fontSize:9,color:"#7A7A7A",textAlign:"center"}}>{m.label}</div>
              <div style={{fontSize:8,fontWeight:700,color:m.lucroLiq>=0?"var(--verde)":"var(--vermelho)",marginTop:2}}>
                {m.lucroLiq>=0?"+":""}{fmtK(m.lucroLiq)}
              </div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap",fontSize:11}}>
          {[["var(--verde)","Receita"],["var(--vermelho)","Custo direto"],["#D9A03B","Custos administrativos"]].map(([cor,label])=>(
            <span key={label} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:cor,borderRadius:2,display:"inline-block"}}/>{label}</span>
          ))}
        </div>
      </div>

      {/* Tabela detalhada por mês */}
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Mês</th><th>Receita</th><th>Custo (lanç.)</th><th>Custo (compras)</th><th>Custo (despesas)</th>
            <th>Custo direto</th><th>Custos admin.</th><th>Lucro bruto</th><th>Lucro líquido</th><th>Margem líq.</th>
          </tr></thead>
          <tbody>
            {dadosMensais.map(m=>(
              <tr key={m.m}>
                <td style={{fontWeight:600}}>{m.label}</td>
                <td style={{color:"var(--verde)"}}>{fmt(m.receita)}</td>
                <td style={{fontSize:12,color:"#7A7A7A"}}>{fmt(m.custoLanc)}</td>
                <td style={{fontSize:12,color:"#7A7A7A"}}>{fmt(m.custoCompras)}</td>
                <td style={{fontSize:12,color:"#7A7A7A"}}>{fmt(m.custoDespesas)}</td>
                <td style={{color:"var(--vermelho)"}}>{fmt(m.custoDireto)}</td>
                <td style={{color:"#BA7517"}}>{fmt(m.custosAdmin)}</td>
                <td>{fmt(m.lucroBruto)}</td>
                <td style={{fontWeight:700,color:m.lucroLiq>=0?"var(--verde)":"var(--vermelho)"}}>{fmt(m.lucroLiq)}</td>
                <td style={{fontWeight:600}}>{m.margLiqPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AbaResultadoProjeto({ lancs, obras, compras, despesas, manuts=[] }) {
  const [itemFiltro, setItemFiltro] = useState("");
  const [filtros, setFiltros] = useState({ periodo:{de:"",ate:""}, clienteNome:"", status:[], tipo:"" });

  const clientesLista = useMemo(()=>[...new Set([...obras,...manuts].map(o=>o.cliente).filter(Boolean))].sort(),[obras,manuts]);
  const statusObraLista = ["EM ANDAMENTO","CONCLUÍDA","PLANEJAMENTO","PARALISADA"];
  const statusManutLista = ["ABERTA","EM ANDAMENTO","CONCLUÍDA","CANCELADA"];

  // Unifica obras e manutenções em uma lista com campos comuns
  const todasDemandas = useMemo(()=>[
    ...obras.map(o=>({...o, _tipo:"obra",  _id:o.id})),
    ...manuts.map(m=>({...m, _tipo:"manutencao", _id:m.id, nome:m.titulo||m.nome||"", inicio:m.dataAbertura||""})),
  ],[obras,manuts]);

  const demandasFiltradas = useMemo(()=>{
    return todasDemandas.filter(d=>{
      const mCliente = !filtros.clienteNome || d.cliente===filtros.clienteNome;
      const mStatus  = filtros.status.length===0 || filtros.status.includes(d.status);
      const mPeriodo = dentroPeriodo(d.inicio, filtros.periodo);
      const mTipo    = !filtros.tipo || d._tipo===filtros.tipo;
      return mCliente && mStatus && mPeriodo && mTipo;
    });
  },[todasDemandas, filtros]);

  const demandaSelecionada = demandasFiltradas.find(dm=>dm._id===itemFiltro) || null;

  const d = useMemo(()=>{
    // Sem seleção: consolida todas as demandas do filtro
    if (!itemFiltro) {
      const idsObras   = demandasFiltradas.filter(x=>x._tipo==="obra").map(x=>x._id);
      const idsManuts  = demandasFiltradas.filter(x=>x._tipo==="manutencao").map(x=>x._id);
      const l = lancs.filter(x=>idsObras.includes(x.obraId)||idsManuts.includes(x.manutencaoId));
      const c = compras.filter(x=>idsObras.includes(x.demandaId)||idsManuts.includes(x.demandaId));
      const dep = despesas.filter(x=>idsObras.includes(x.obraId)||idsManuts.includes(x.manutencaoId));
      const receita       = l.filter(x=>x.tipo==="RECEBER"&&(x.status==="PAGO"||x.status==="RECEBIDO")).reduce((s,x)=>s+(x.valor||0),0);
      const custoLanc     = l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
      const custoCompras  = c.filter(x=>["RECEBIDO","AGUARD. NF","NF VINCULADA"].includes(x.status)).reduce((s,x)=>s+(x.valorAprovado||x.valorCotado||0),0);
      const custoDespesas = dep.reduce((s,x)=>s+(x.valor||0),0);
      const custoMatMO    = custoLanc + custoCompras + custoDespesas;
      const custosAdmin   = l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&!["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
      const comprometido  = c.filter(x=>["APROVADA","ORDEM DE COMPRA"].includes(x.status)).reduce((s,x)=>s+(x.valorAprovado||0),0);
      const aReceber      = l.filter(x=>x.tipo==="RECEBER"&&x.status==="ABERTO").reduce((s,x)=>s+(x.valor||0),0);
      const aPagar        = l.filter(x=>x.tipo==="PAGAR"&&x.status==="ABERTO").reduce((s,x)=>s+(x.valor||0),0);
      const margBruta = receita - custoMatMO;
      const margLiq   = margBruta - custosAdmin;
      return { receita, custoMatMO, custoLanc, custoCompras, custoDespesas, custosAdmin, margBruta, margLiq, comprometido, aReceber, aPagar, margBrutaPct:pctN(margBruta,receita), margLiqPct:pctN(margLiq,receita) };
    }
    // Com seleção: calcula só para a demanda escolhida
    const tipo = demandaSelecionada?._tipo || "obra";
    const l   = lancs.filter(x=>tipo==="obra"?x.obraId===itemFiltro:x.manutencaoId===itemFiltro);
    const c   = compras.filter(x=>x.demandaId===itemFiltro);
    const dep = despesas.filter(x=>tipo==="obra"?x.obraId===itemFiltro:x.manutencaoId===itemFiltro);
    const receita       = l.filter(x=>x.tipo==="RECEBER"&&(x.status==="PAGO"||x.status==="RECEBIDO")).reduce((s,x)=>s+(x.valor||0),0);
    const custoLanc     = l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
    const custoCompras  = c.filter(x=>["RECEBIDO","AGUARD. NF","NF VINCULADA"].includes(x.status)).reduce((s,x)=>s+(x.valorAprovado||x.valorCotado||0),0);
    const custoDespesas = dep.reduce((s,x)=>s+(x.valor||0),0);
    const custoMatMO    = custoLanc + custoCompras + custoDespesas;
    const custosAdmin   = l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&!["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
    const comprometido  = c.filter(x=>["APROVADA","ORDEM DE COMPRA"].includes(x.status)).reduce((s,x)=>s+(x.valorAprovado||0),0);
    const aReceber      = l.filter(x=>x.tipo==="RECEBER"&&x.status==="ABERTO").reduce((s,x)=>s+(x.valor||0),0);
    const aPagar        = l.filter(x=>x.tipo==="PAGAR"&&x.status==="ABERTO").reduce((s,x)=>s+(x.valor||0),0);
    const margBruta = receita - custoMatMO;
    const margLiq   = margBruta - custosAdmin;
    return { receita, custoMatMO, custoLanc, custoCompras, custoDespesas, custosAdmin, margBruta, margLiq, comprometido, aReceber, aPagar, margBrutaPct:pctN(margBruta,receita), margLiqPct:pctN(margLiq,receita) };
  },[lancs,compras,despesas,itemFiltro,demandaSelecionada,demandasFiltradas]);

  const lucro = (d?.margLiq||0) >= 0;

  return (
    <div>
      <FiltroAvancado
        campos={[
          { tipo:"periodo", key:"periodo",     label:"Período de início" },
          { tipo:"select",  key:"clienteNome", label:"Cliente", opcoes: clientesLista.map(c=>({value:c,label:c})) },
          { tipo:"select",  key:"tipo",        label:"Tipo", opcoes: [{value:"obra",label:"🏗️ Obras"},{value:"manutencao",label:"🔧 Manutenções"}] },
          { tipo:"multi",   key:"status",      label:"Status", largo:true, opcoes: [...new Set([...statusObraLista,...statusManutLista])].map(s=>({value:s,label:s})) },
        ]}
        valores={filtros} onChange={setFiltros}
        onLimpar={()=>{ setFiltros({ periodo:{de:"",ate:""}, clienteNome:"", status:[], tipo:"" }); setItemFiltro(""); }}
      />
      {/* Seletor */}
      <div style={{marginBottom:16}}>
        <select value={itemFiltro} onChange={e=>setItemFiltro(e.target.value)}
          style={{width:"100%",padding:"9px 14px",borderRadius:8,border:"1px solid var(--border)",fontSize:14,fontWeight:500}}>
          <option value="">📊 Resultado consolidado — {demandasFiltradas.length} demanda(s) no filtro</option>
          {demandasFiltradas.map(dm=><option key={dm._id} value={dm._id}>{dm._tipo==="manutencao"?"🔧 ":"🏗️ "}{dm.nome} {dm.cliente?`— ${dm.cliente}`:""}</option>)}
        </select>
      </div>

      {/* Header da demanda */}
      {demandaSelecionada && (
        <div style={{background:"#1A1A1A",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#F5C800"}}>{demandaSelecionada.nome}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>{demandaSelecionada.cliente} · {demandaSelecionada.status} · {demandaSelecionada._tipo==="manutencao"?"Manutenção":"Obra"}</div>
          </div>
          <span className={`badge ${lucro?"badge-green":"badge-red"}`} style={{fontSize:12}}>{lucro?"✓ Lucrativo":"⚠ Prejuízo"}</span>
        </div>
      )}

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:20}}>
        <KPI label="Receita realizada"    valor={fmt(d.receita)}      cor="var(--verde)"   icon="💰"/>
        <KPI label="Custo direto"          valor={fmt(d.custoMatMO)}   cor="var(--vermelho)"icon="📤"/>
        <KPI label="Margem bruta"          valor={fmt(d.margBruta)}    cor={d.margBruta>=0?"var(--verde)":"var(--vermelho)"} icon="📊" destaque/>
        <KPI label="Custo indireto"        valor={fmt(d.custosAdmin)}  cor="var(--vermelho)"icon="📋"/>
        <KPI label="Margem líquida"        valor={fmt(d.margLiq)}      cor={lucro?"var(--verde)":"var(--vermelho)"} icon="🎯"/>
        <KPI label="Comprometido (OC)"     valor={fmt(d.comprometido)} cor="var(--afine-yellow-dk)" icon="🔒"/>
      </div>
      {(d.custoCompras>0||d.custoDespesas>0) && (
        <div style={{fontSize:11,color:"#7A7A7A",marginTop:-12,marginBottom:16,display:"flex",gap:10,flexWrap:"wrap"}}>
          <span>Composição do custo direto:</span>
          <span>📋 Lançamentos {fmt(d.custoLanc)}</span>
          {d.custoCompras>0 && <span>🛒 Compras {fmt(d.custoCompras)}</span>}
          {d.custoDespesas>0 && <span>🧾 Despesas {fmt(d.custoDespesas)}</span>}
        </div>
      )}

      {/* DRE visual */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"#1A1A1A",marginBottom:16}}>
          Demonstrativo de Resultado — {obraFiltro?obraAtual?.nome:"Consolidado"}
        </div>
        {[
          {label:"(+) Receita realizada",             v:d.receita,       cor:"var(--verde)",   bold:false, tipo:"rec"},
          {label:"(−) Custo direto (Mat + MO + Sub)", v:d.custoMatMO,    cor:"var(--vermelho)",bold:false, tipo:"pag"},
          {label:"= Margem bruta",                     v:d.margBruta,     cor:d.margBruta>=0?"var(--verde)":"var(--vermelho)", bold:true, separador:true},
          {label:"(−) Custo indireto (Admin + Imp.)", v:d.custosAdmin,   cor:"var(--vermelho)",bold:false, tipo:"pag"},
          {label:"= Margem líquida (EBITDA aprox.)",  v:d.margLiq,       cor:lucro?"var(--verde)":"var(--vermelho)", bold:true, separador:true},
          {label:"(+) A receber em aberto",            v:d.aReceber,      cor:"#185FA5",        bold:false},
          {label:"(−) A pagar em aberto",              v:d.aPagar,        cor:"#BA7517",        bold:false},
        ].map((row,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:`${row.bold?"12px":"9px"} 0`,
            borderBottom:`1px solid ${row.separador?"#1A1A1A":"var(--border)"}`,
            marginBottom:row.separador?6:0,
            background:row.bold?"transparent":"transparent"}}>
            <span style={{fontSize:row.bold?14:13,fontWeight:row.bold?700:400,color:row.bold?"#1A1A1A":"#4A4A4A"}}>{row.label}</span>
            <span style={{fontSize:row.bold?20:14,fontWeight:700,color:row.cor}}>{fmt(row.v)}</span>
          </div>
        ))}

        {/* Indicadores % */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginTop:16}}>
          {[
            {l:"Margem bruta",      v:d.margBrutaPct, cor:d.margBrutaPct>0?"var(--verde)":"var(--vermelho)"},
            {l:"Margem líquida",    v:d.margLiqPct,   cor:lucro?"var(--verde)":"var(--vermelho)"},
            {l:"Custo s/ receita",  v:d.receita>0?pctN(d.custoMatMO+d.custosAdmin,d.receita):0, cor:"var(--vermelho)"},
            {l:"Receita total",     v:null,            valor:fmt(d.receita)},
          ].map(k=>(
            <div key={k.l} style={{textAlign:"center",background:"var(--cinza-lt)",borderRadius:8,padding:"10px 6px"}}>
              <div style={{fontSize:10,color:"#7A7A7A",marginBottom:4}}>{k.l}</div>
              {k.v!=null
                ? <><div style={{fontSize:16,fontWeight:700,color:k.cor}}>{k.v}%</div><MiniBar valor={Math.abs(k.v)} total={100} cor={k.cor} height={4}/></>
                : <div style={{fontSize:14,fontWeight:700}}>{k.valor}</div>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-aba: Comparativo de Obras ─────────────────────────────────────────────
function AbaComparativo({ lancs, obras, compras, despesas }) {
  const [filtros, setFiltros] = useState({ periodo:{de:"",ate:""}, clienteNome:"", status:[] });
  const clientesLista = useMemo(()=>[...new Set(obras.map(o=>o.cliente).filter(Boolean))].sort(),[obras]);
  const statusLista = ["EM ANDAMENTO","CONCLUÍDA","PLANEJAMENTO","PARALISADA"];

  const dreObras = useMemo(()=>{
    const obrasFilt = obras.filter(o=>{
      if (filtros.clienteNome && o.cliente!==filtros.clienteNome) return false;
      if ((filtros.status||[]).length>0 && !(filtros.status||[]).includes(o.status)) return false;
      if (!dentroPeriodo(o.inicio, filtros.periodo)) return false;
      return true;
    });
    return obrasFilt.map(o=>{
      const l = lancs.filter(x=>x.obraId===o.id);
      const c = compras.filter(x=>x.demandaId===o.id);
      const d = despesas.filter(x=>x.obraId===o.id);
      const rec = l.filter(x=>x.tipo==="RECEBER"&&(x.status==="PAGO"||x.status==="RECEBIDO")).reduce((s,x)=>s+(x.valor||0),0);
      const cusDLanc = l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
      // NOVO: inclui compras recebidas/faturadas + despesas vinculadas, mesma
      // correção aplicada em Resultado por Projeto e Custo por Obra.
      const cusDCompras = c.filter(x=>["RECEBIDO","AGUARD. NF","NF VINCULADA"].includes(x.status)).reduce((s,x)=>s+(x.valorAprovado||x.valorCotado||0),0);
      const cusDDespesas = d.reduce((s,x)=>s+(x.valor||0),0);
      const cusD = cusDLanc + cusDCompras + cusDDespesas;
      const cusI= l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&!["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
      const mb=rec-cusD, ml=mb-cusI;
      return { ...o, receita:rec, custoDir:cusD, custInd:cusI, margBruta:mb, margLiq:ml, mbPct:pctN(mb,rec), mlPct:pctN(ml,rec) };
    }).sort((a,b)=>b.margLiq-a.margLiq);
  },[lancs,obras,compras,despesas,filtros]);

  const totais = dreObras.reduce((s,o)=>({
    receita:s.receita+(o.receita||0),
    custoDir:s.custoDir+(o.custoDir||0),
    margBruta:s.margBruta+(o.margBruta||0),
    margLiq:s.margLiq+(o.margLiq||0),
  }),{receita:0,custoDir:0,margBruta:0,margLiq:0});

  const cols=[
    {key:"nome",header:"Obra"},{key:"cliente",header:"Cliente"},
    {key:"receita",header:"Receita",format:fmt},
    {key:"custoDir",header:"Custo direto",format:fmt},
    {key:"margBruta",header:"Mg. bruta",format:fmt},
    {key:"mbPct",header:"Mg. bruta %",format:v=>`${v}%`},
    {key:"margLiq",header:"Mg. líquida",format:fmt},
    {key:"mlPct",header:"Mg. líq. %",format:v=>`${v}%`},
  ];

  return (
    <div>
      <FiltroAvancado
        campos={[
          { tipo:"periodo", key:"periodo",     label:"Período de início da obra" },
          { tipo:"select",  key:"clienteNome", label:"Cliente", opcoes: clientesLista.map(c=>({value:c,label:c})) },
          { tipo:"multi",   key:"status",      label:"Status", largo:true, opcoes: statusLista.map(s=>({value:s,label:s})) },
        ]}
        valores={filtros} onChange={setFiltros}
        onLimpar={()=>setFiltros({ periodo:{de:"",ate:""}, clienteNome:"", status:[] })}
      />
      {/* Totalizadores */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,marginBottom:16}}>
        <KPI label={`Receita total (${dreObras.length} obras)`} valor={fmt(totais.receita)} cor="var(--verde)" icon="💰"/>
        <KPI label="Custo direto total"   valor={fmt(totais.custoDir)}  cor="var(--vermelho)" icon="📤"/>
        <KPI label="Margem bruta total"   valor={fmt(totais.margBruta)} cor={totais.margBruta>=0?"var(--verde)":"var(--vermelho)"} destaque/>
        <KPI label="Margem líquida total" valor={fmt(totais.margLiq)}   cor={totais.margLiq>=0?"var(--verde)":"var(--vermelho)"} icon="🎯"/>
      </div>

      {dreObras.length===0
        ? <div className="empty-state"><div className="empty-icon">📊</div><p>Nenhuma obra encontrada com os filtros aplicados.</p></div>
        : <>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
              <BtnExcel onClick={()=>exportarExcel(dreObras,"Comparativo_Obras",cols)}/>
            </div>
            {/* Cards visuais */}
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {dreObras.map(o=>{
                const lucro=o.margLiq>=0;
                const recMax=Math.max(...dreObras.map(x=>x.receita),1);
                return (
                  <div key={o.id} className="card" style={{padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{o.nome}</div>
                        <div style={{fontSize:11,color:"#7A7A7A"}}>{o.cliente}</div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <Gauge valor={Math.abs(o.mbPct)} max={100} cor={o.mbPct>0?"var(--verde)":"var(--vermelho)"} label="Mg. bruta" tamanho={60}/>
                        <Gauge valor={Math.abs(o.mlPct)} max={100} cor={lucro?"var(--verde)":"var(--vermelho)"} label="Mg. líquida" tamanho={60}/>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,fontSize:12}}>
                      <div><div style={{fontSize:10,color:"#7A7A7A"}}>Receita</div><div style={{fontWeight:600,color:"var(--verde)"}}>{fmtK(o.receita)}</div></div>
                      <div><div style={{fontSize:10,color:"#7A7A7A"}}>Custo dir.</div><div style={{fontWeight:600,color:"var(--vermelho)"}}>{fmtK(o.custoDir)}</div></div>
                      <div><div style={{fontSize:10,color:"#7A7A7A"}}>Mg. bruta</div><div style={{fontWeight:700,color:o.margBruta>=0?"var(--verde)":"var(--vermelho)"}}>{fmtK(o.margBruta)}</div></div>
                      <div><div style={{fontSize:10,color:"#7A7A7A"}}>Mg. líquida</div><div style={{fontWeight:700,color:lucro?"var(--verde)":"var(--vermelho)"}}>{fmtK(o.margLiq)}</div></div>
                    </div>
                    <div style={{marginTop:8}}>
                      <div style={{fontSize:10,color:"#7A7A7A",marginBottom:3}}>Receita vs maior obra</div>
                      <MiniBar valor={o.receita} total={recMax} cor="var(--afine-yellow-dk)"/>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
      }
    </div>
  );
}

// ── Sub-aba: Indicadores de desempenho ────────────────────────────────────────
function AbaIndicadores({ lancs, obras, compras, manuts }) {
  const hoje = new Date().toISOString().split("T")[0];
  const [filtros, setFiltros] = useState({ periodo:{de:"",ate:""} });

  const lancsF = useMemo(()=>lancs.filter(l=>dentroPeriodo(l.vencimento||l.pagamento, filtros.periodo)),[lancs,filtros]);
  const obrasF  = useMemo(()=>obras.filter(o=>dentroPeriodo(o.inicio, filtros.periodo)),[obras,filtros]);
  const manutF  = useMemo(()=>manuts.filter(m=>dentroPeriodo(m.dataAbertura, filtros.periodo)),[manuts,filtros]);
  const comprasF= useMemo(()=>compras.filter(c=>dentroPeriodo(c.solicitadoEm, filtros.periodo)),[compras,filtros]);

  const kpis = useMemo(()=>{
    const recTot    = lancsF.filter(l=>l.tipo==="RECEBER"&&(l.status==="PAGO"||l.status==="RECEBIDO")).reduce((s,l)=>s+(l.valor||0),0);
    const pagTot    = lancsF.filter(l=>l.tipo==="PAGAR"&&l.status==="PAGO").reduce((s,l)=>s+(l.valor||0),0);
    const saldo     = recTot - pagTot;
    const inadim    = lancsF.filter(l=>l.tipo==="RECEBER"&&l.status==="ABERTO"&&l.vencimento<hoje);
    const inadimVal = inadim.reduce((s,l)=>s+(l.valor||0),0);
    const aRecTot   = lancsF.filter(l=>l.tipo==="RECEBER"&&l.status==="ABERTO").reduce((s,l)=>s+(l.valor||0),0);
    const txInadim  = aRecTot>0?pctN(inadimVal,aRecTot):0;
    const obrasAtivas=obrasF.filter(o=>o.status==="EM ANDAMENTO");
    const progMedio  =obrasAtivas.length>0?Math.round(obrasAtivas.reduce((s,o)=>s+(o.progresso||0),0)/obrasAtivas.length):0;
    const manutAbertas=manutF.filter(m=>["ABERTA","EM ANDAMENTO"].includes(m.status)).length;
    const manutConcl=manutF.filter(m=>m.status==="CONCLUÍDA").length;
    const txConcl   =manutF.length>0?pctN(manutConcl,manutF.length):0;
    const compAbertos=comprasF.filter(c=>["SOLICITAÇÃO","COTAÇÃO"].includes(c.status)).length;
    return { recTot, pagTot, saldo, inadimVal, txInadim, obrasAtivas:obrasAtivas.length, progMedio, manutAbertas, txConcl, compAbertos };
  },[lancsF,obrasF,manutF,comprasF,hoje]);

  const indicadores = [
    { categoria:"💰 Financeiro", itens:[
      {label:"Receita total realizada",    valor:fmt(kpis.recTot),           cor:"var(--verde)",   desc:"Soma de todos os recebimentos confirmados"},
      {label:"Total pago a fornecedores",  valor:fmt(kpis.pagTot),           cor:"var(--vermelho)",desc:"Soma de todos os pagamentos efetuados"},
      {label:"Resultado acumulado",         valor:fmt(kpis.saldo),            cor:kpis.saldo>=0?"var(--verde)":"var(--vermelho)",desc:"Receita realizada − Pagamentos realizados"},
      {label:"Inadimplência (valor)",       valor:fmt(kpis.inadimVal),        cor:kpis.inadimVal>0?"var(--vermelho)":"var(--verde)",desc:"Valor vencido ainda em aberto"},
      {label:"Taxa de inadimplência",       valor:`${kpis.txInadim}%`,        cor:kpis.txInadim>10?"var(--vermelho)":"var(--verde)",desc:"% do a receber que está vencido"},
    ]},
    { categoria:"🏗️ Obras", itens:[
      {label:"Obras em andamento",          valor:kpis.obrasAtivas,           cor:"#185FA5",         desc:"Obras com status EM ANDAMENTO"},
      {label:"Progresso médio",             valor:`${kpis.progMedio}%`,       cor:"var(--afine-yellow-dk)",desc:"Média de % de conclusão das obras ativas"},
    ]},
    { categoria:"🔧 Manutenção", itens:[
      {label:"Chamados abertos",            valor:kpis.manutAbertas,          cor:"var(--vermelho)", desc:"Manutenções aguardando atendimento"},
      {label:"Taxa de conclusão",           valor:`${kpis.txConcl}%`,         cor:kpis.txConcl>70?"var(--verde)":"var(--afine-yellow-dk)",desc:"% das manutenções finalizadas"},
    ]},
    { categoria:"🛒 Compras", itens:[
      {label:"Pedidos em aberto",           valor:kpis.compAbertos,           cor:"var(--afine-yellow-dk)",desc:"Solicitações e cotações pendentes"},
    ]},
  ];

  return (
    <div>
      <FiltroAvancado
        campos={[{ tipo:"periodo", key:"periodo", label:"Período" }]}
        valores={filtros} onChange={setFiltros}
        onLimpar={()=>setFiltros({ periodo:{de:"",ate:""} })}
      />

      {indicadores.map(grupo=>(
        <div key={grupo.categoria} style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,padding:"8px 0",borderBottom:"2px solid var(--afine-yellow)",marginBottom:12}}>{grupo.categoria}</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {grupo.itens.map(item=>(
              <div key={item.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--cinza-lt)",borderRadius:8,gap:10}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{item.label}</div>
                  <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>{item.desc}</div>
                </div>
                <div style={{fontSize:18,fontWeight:700,color:item.cor,whiteSpace:"nowrap"}}>{item.valor}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-aba: Curva ABC ────────────────────────────────────────────────────────
function AbaCurvaABC({ movs, mats }) {
  const [filtro, setFiltro] = useState("todas");
  const abc = useMemo(()=>{
    const agg = movs.filter(m=>m.tipo==="saida").reduce((acc,m)=>{
      if(!acc[m.materialNome]) acc[m.materialNome]={qtd:0};
      acc[m.materialNome].qtd += m.quantidade||0;
      return acc;
    },{});
    const sorted = Object.entries(agg)
      .map(([nome,d])=>{ const mat=mats.find(x=>x.nome===nome)||{}; return {nome,qtd:d.qtd,un:mat.un||"un"}; })
      .sort((a,b)=>b.qtd-a.qtd);
    const total = sorted.reduce((s,x)=>s+x.qtd,0);
    let acum=0;
    return sorted.map(item=>{
      acum+=item.qtd;
      const pctA=total>0?acum/total*100:0;
      const pctI=total>0?item.qtd/total*100:0;
      return {...item,pctAcum:pctA,pctItem:pctI,classe:pctA<=80?"A":pctA<=95?"B":"C"};
    });
  },[movs,mats]);

  const lista = filtro==="todas" ? abc : abc.filter(x=>x.classe===filtro);
  const totQtd=abc.reduce((s,x)=>s+x.qtd,0);
  const CORES={A:"#B83232",B:"#BA7517",C:"#639922"};

  return (
    <div>
      <div className="alert alert-info" style={{marginBottom:14,fontSize:12,lineHeight:1.6}}>
        <strong>Curva ABC de materiais:</strong><br/>
        Classe <strong style={{color:CORES.A}}>A</strong> = 80% do consumo (poucos itens, alto impacto — foco de negociação)<br/>
        Classe <strong style={{color:CORES.B}}>B</strong> = próximos 15% · Classe <strong style={{color:CORES.C}}>C</strong> = restante (muitos itens, baixo impacto)
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {["todas",...Object.keys(CORES)].map(c=>{
          const count=c==="todas"?abc.length:abc.filter(x=>x.classe===c).length;
          const cor=c==="todas"?"#1A1A1A":CORES[c];
          return (
            <button key={c} onClick={()=>setFiltro(c)}
              style={{flex:1,padding:"10px 6px",border:`2px solid ${filtro===c?cor:"var(--border)"}`,borderRadius:8,
                background:filtro===c?cor:"transparent",color:filtro===c?"#fff":cor,cursor:"pointer",transition:".15s",textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:700}}>{c==="todas"?"Todos":`Classe ${c}`}</div>
              <div style={{fontSize:11,opacity:.8}}>{count} itens</div>
            </button>
          );
        })}
      </div>

      {abc.length===0
        ? <div className="empty-state"><div className="empty-icon">📦</div><p>Nenhuma movimentação de materiais registrada</p></div>
        : <div className="table-wrap">
            <table>
              <thead><tr><th>Classe</th><th>Material</th><th>Consumo</th><th>Un.</th><th>% do total</th><th>% acumulado</th></tr></thead>
              <tbody>
                {lista.map((item,i)=>(
                  <tr key={i}>
                    <td><span style={{fontSize:11,fontWeight:700,color:CORES[item.classe],background:`${CORES[item.classe]}15`,padding:"3px 8px",borderRadius:10}}>Classe {item.classe}</span></td>
                    <td style={{fontWeight:500}}>{item.nome}</td>
                    <td style={{fontWeight:700}}>{item.qtd}</td>
                    <td style={{fontSize:12}}>{item.un}</td>
                    <td style={{fontSize:12}}>{item.pctItem.toFixed(1)}%</td>
                    <td style={{minWidth:120}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{flex:1,height:6,background:"#E0DED8",borderRadius:3,overflow:"hidden"}}>
                          <div style={{width:`${Math.min(item.pctAcum,100)}%`,height:"100%",background:CORES[item.classe],borderRadius:3}}/>
                        </div>
                        <span style={{fontSize:10,color:"#7A7A7A",whiteSpace:"nowrap"}}>{item.pctAcum.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </div>
  );
}

// ── Sub-aba: Rentabilidade por Cliente ────────────────────────────────────────
function AbaCliente({ lancs, obras }) {
  const porCliente = useMemo(()=>{
    const clientes = [...new Set(obras.map(o=>o.cliente).filter(Boolean))];
    return clientes.map(cli=>{
      const obrasC = obras.filter(o=>o.cliente===cli);
      const ids    = obrasC.map(o=>o.id);
      const l      = lancs.filter(x=>ids.includes(x.obraId));
      const rec    = l.filter(x=>x.tipo==="RECEBER"&&(x.status==="PAGO"||x.status==="RECEBIDO")).reduce((s,x)=>s+(x.valor||0),0);
      const cus    = l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO").reduce((s,x)=>s+(x.valor||0),0);
      return { cliente:cli, obras:obrasC.length, receita:rec, custo:cus, resultado:rec-cus, pctMg:pctN(rec-cus,rec) };
    }).sort((a,b)=>b.receita-a.receita);
  },[lancs,obras]);

  if(porCliente.length===0) return <div className="empty-state"><div className="empty-icon">🏢</div><p>Nenhum cliente com lançamentos ainda</p></div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {porCliente.map(c=>{
        const lucro=c.resultado>=0;
        return (
          <div key={c.cliente} className="card" style={{borderLeft:`4px solid ${lucro?"var(--verde)":"var(--vermelho)"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{c.cliente}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>{c.obras} obra(s)</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:700,color:lucro?"var(--verde)":"var(--vermelho)"}}>{fmt(c.resultado)}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>margem {c.pctMg}%</div>
              </div>
            </div>
            <div style={{display:"flex",gap:12,fontSize:12}}>
              <span>Receita: <strong style={{color:"var(--verde)"}}>{fmtK(c.receita)}</strong></span>
              <span>Custo: <strong style={{color:"var(--vermelho)"}}>{fmtK(c.custo)}</strong></span>
            </div>
            <MiniBar valor={c.receita} total={Math.max(...porCliente.map(x=>x.receita),1)} cor="var(--afine-yellow-dk)" height={4}/>
          </div>
        );
      })}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function DRE() {
  const [obras,   setObras]   = useState([]);
  const [lancs,   setLancs]   = useState([]);
  const [mats,    setMats]    = useState([]);
  const [movs,    setMovs]    = useState([]);
  const [compras, setCompras] = useState([]);
  const [manuts,  setManuts]  = useState([]);
  const [despesas,setDespesas]= useState([]);
  const [loading, setLoading] = useState(true);
  const [aba,     setAba]     = useState("mensal");

  useEffect(()=>{
    const u1=onSnapshot(query(collection(db,"obras"),limit(200)),    snap=>{setObras(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2=onSnapshot(query(collection(db,"financeiro"),limit(500)),snap=>setLancs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"materiais_estoque"),           snap=>setMats(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4=onSnapshot(collection(db,"movimentacoes"),               snap=>setMovs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u5=onSnapshot(query(collection(db,"compras"),limit(300)),   snap=>setCompras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u6=onSnapshot(collection(db,"manutencoes"),                 snap=>setManuts(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u7=onSnapshot(collection(db,"despesas"),                    snap=>setDespesas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();u4();u5();u6();u7();};
  },[]);

  const ABAS = [
    {id:"mensal",       label:"📅 Visão Mensal"},
    {id:"resultado",    label:"📈 Resultado por projeto"},
    {id:"comparativo",  label:"⚖️ Comparativo de obras"},
    {id:"clientes",     label:"🏢 Por cliente"},
    {id:"indicadores",  label:"🎯 Indicadores de desempenho"},
    {id:"abc",          label:"📦 Curva ABC materiais"},
  ];

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Resultados</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>Rentabilidade, indicadores e análises gerenciais</div>
        </div>
      </div>

      {/* Sub-abas */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",flexWrap:"wrap"}}>
        {ABAS.map((a,i)=>(
          <button key={a.id} onClick={()=>setAba(a.id)}
            style={{flex:"1 1 auto",padding:"9px 10px",border:"none",cursor:"pointer",
              background:aba===a.id?"#1A1A1A":"var(--cinza-lt)",
              color:aba===a.id?"#F5C800":"#4A4A4A",
              borderRight:i<ABAS.length-1?"1px solid var(--border)":"none",
              transition:"all .15s",fontSize:11,fontWeight:aba===a.id?700:400,whiteSpace:"nowrap"}}>
            {a.label}
          </button>
        ))}
      </div>

      {loading&&<div className="spinner"/>}
      {!loading&&(
        <>
          {aba==="mensal"     &&<AbaVisaoMensal       lancs={lancs} compras={compras} despesas={despesas}/>}
          {aba==="resultado"  &&<AbaResultadoProjeto lancs={lancs} obras={obras} compras={compras} despesas={despesas} manuts={manuts}/>}
          {aba==="comparativo"&&<AbaComparativo      lancs={lancs} obras={obras} compras={compras} despesas={despesas}/>}
          {aba==="clientes"   &&<AbaCliente          lancs={lancs} obras={obras}/>}
          {aba==="indicadores"&&<AbaIndicadores      lancs={lancs} obras={obras} compras={compras} manuts={manuts}/>}
          {aba==="abc"        &&<AbaCurvaABC         movs={movs} mats={mats}/>}
        </>
      )}
    </div>
  );
}
