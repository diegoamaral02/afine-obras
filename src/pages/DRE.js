// src/pages/DRE.js — DRE gerencial + Curva ABC + Margem por obra
import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";

export default function DRE() {
  const [obras,  setObras]  = useState([]);
  const [lancs,  setLancs]  = useState([]);
  const [mats,   setMats]   = useState([]);
  const [movs,   setMovs]   = useState([]);
  const [loading,setLoading]= useState(true);
  const [obraFiltro, setObraFiltro] = useState("");
  const [aba, setAba] = useState("dre");

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"obras"),snap=>{setObras(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2=onSnapshot(collection(db,"financeiro"),snap=>setLancs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"materiais_estoque"),snap=>setMats(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4=onSnapshot(collection(db,"movimentacoes"),snap=>setMovs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();u4();};
  },[]);

  const fmt = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
  const pct  = (v,t) => t>0?`${Math.round(v/t*100)}%`:"–";

  // DRE por obra
  function dreObra(obraId) {
    const l = obraId ? lancs.filter(x=>x.obraId===obraId) : lancs;
    const receita = l.filter(x=>x.tipo==="RECEBER"&&x.status==="PAGO").reduce((s,x)=>s+(x.valor||0),0);
    const custoDir= l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
    const custInd = l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&!["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
    const margBruta = receita - custoDir;
    const margLiq   = margBruta - custInd;
    const recAbert  = l.filter(x=>x.tipo==="RECEBER"&&x.status==="ABERTO").reduce((s,x)=>s+(x.valor||0),0);
    const pagAbert  = l.filter(x=>x.tipo==="PAGAR"&&x.status==="ABERTO").reduce((s,x)=>s+(x.valor||0),0);
    return { receita, custoDir, custInd, margBruta, margLiq, recAbert, pagAbert };
  }

  // Curva ABC materiais
  const abcMats = movs
    .filter(m=>m.tipo==="saida")
    .reduce((acc,m)=>{
      if(!acc[m.materialNome]) acc[m.materialNome]=0;
      acc[m.materialNome]+=m.quantidade;
      return acc;
    },{});
  const abcSorted = Object.entries(abcMats)
    .map(([nome,qtd])=>{
      const mat=mats.find(x=>x.nome===nome)||{};
      return {nome,qtd,un:mat.un||"un"};
    })
    .sort((a,b)=>b.qtd-a.qtd);
  const totalQtd = abcSorted.reduce((s,x)=>s+x.qtd,0);
  let acum=0;
  const abcComCurva = abcSorted.map(item=>{
    acum+=item.qtd;
    const pctAcum=totalQtd>0?acum/totalQtd*100:0;
    return {...item,pctAcum,classe:pctAcum<=80?"A":pctAcum<=95?"B":"C"};
  });

  const dre = dreObra(obraFiltro);
  const dreObras = obras.map(o=>({...o,...dreObra(o.id)}));

  const dreCols = [
    {key:"nome",header:"Obra"},{key:"receita",header:"Receita",format:fmt},
    {key:"custoDir",header:"Custo Direto",format:fmt},{key:"margBruta",header:"Margem Bruta",format:fmt},
    {key:"margLiq",header:"Margem Líquida",format:fmt},
  ];

  return (
    <div>
      <div className="panel-header">
        <div><div className="panel-title">DRE Gerencial e Indicadores</div><div style={{fontSize:12,color:"#7A7A7A"}}>Rentabilidade por obra + Curva ABC</div></div>
        <BtnExcel onClick={()=>exportarExcel(dreObras,"DRE_Gerencial",dreCols)}/>
      </div>

      <div className="tabs">
        <button className={`tab ${aba==="dre"?"active":""}`} onClick={()=>setAba("dre")}>DRE por obra</button>
        <button className={`tab ${aba==="consolidado"?"active":""}`} onClick={()=>setAba("consolidado")}>Consolidado</button>
        <button className={`tab ${aba==="abc"?"active":""}`} onClick={()=>setAba("abc")}>Curva ABC</button>
      </div>

      {aba==="dre" && (
        <>
          <div style={{marginBottom:14}}>
            <select value={obraFiltro} onChange={e=>setObraFiltro(e.target.value)} style={{padding:"7px 12px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}}>
              <option value="">Todas as obras (consolidado)</option>
              {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>

          {/* DRE Card */}
          <div className="card">
            <div style={{fontWeight:600,fontSize:14,marginBottom:16,color:"#1A1A1A"}}>
              DRE — {obraFiltro ? obras.find(o=>o.id===obraFiltro)?.nome : "Consolidado"}
            </div>
            {[
              {label:"(+) Receita realizada",       v:dre.receita,   color:"var(--verde)",   bold:false},
              {label:"(−) Custo direto (mat+MO+sub)",v:dre.custoDir,  color:"var(--vermelho)",bold:false},
              {label:"= Margem bruta",               v:dre.margBruta, color:dre.margBruta>=0?"var(--verde)":"var(--vermelho)", bold:true, border:true},
              {label:"(−) Custo indireto (admin/imp)",v:dre.custInd,  color:"var(--vermelho)",bold:false},
              {label:"= Margem líquida (EBITDA aprox.)",v:dre.margLiq, color:dre.margLiq>=0?"var(--verde)":"var(--vermelho)", bold:true, border:true},
              {label:"(+) A receber (em aberto)",    v:dre.recAbert,  color:"#185FA5",        bold:false},
              {label:"(−) A pagar (em aberto)",      v:dre.pagAbert,  color:"var(--laranja)", bold:false},
            ].map((row,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",
                borderBottom:`1px solid ${row.border?"#1A1A1A":"var(--border)"}`,
                marginBottom:row.border?8:0}}>
                <span style={{fontSize:13,fontWeight:row.bold?700:400}}>{row.label}</span>
                <span style={{fontSize:row.bold?18:14,fontWeight:row.bold?700:600,color:row.color}}>{fmt(row.v)}</span>
              </div>
            ))}
            <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[
                {l:"Margem bruta %",v:pct(dre.margBruta,dre.receita)},
                {l:"Margem líquida %",v:pct(dre.margLiq,dre.receita)},
                {l:"Receita total",v:fmt(dre.receita)},
              ].map(k=>(
                <div key={k.l} style={{textAlign:"center",background:"var(--cinza-lt)",borderRadius:8,padding:10}}>
                  <div style={{fontSize:11,color:"#7A7A7A"}}>{k.l}</div>
                  <div style={{fontSize:15,fontWeight:700}}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {aba==="consolidado" && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Obra</th><th>Cliente</th><th>Receita</th><th>Custo direto</th><th>Margem bruta</th><th>Mg. bruta %</th><th>Margem líq.</th><th>Resultado</th></tr></thead>
            <tbody>
              {dreObras.map(o=>(
                <tr key={o.id}>
                  <td style={{fontWeight:600}}>{o.nome}</td>
                  <td style={{fontSize:12}}>{o.cliente}</td>
                  <td style={{color:"var(--verde)",fontWeight:600}}>{fmt(o.receita)}</td>
                  <td style={{color:"var(--vermelho)"}}>{fmt(o.custoDir)}</td>
                  <td style={{fontWeight:700,color:o.margBruta>=0?"var(--verde)":"var(--vermelho)"}}>{fmt(o.margBruta)}</td>
                  <td style={{fontWeight:600}}>{pct(o.margBruta,o.receita)}</td>
                  <td style={{fontWeight:700,color:o.margLiq>=0?"var(--verde)":"var(--vermelho)"}}>{fmt(o.margLiq)}</td>
                  <td><span className={`badge ${o.margLiq>=0?"badge-green":"badge-red"}`}>{o.margLiq>=0?"Lucro":"Prejuízo"}</span></td>
                </tr>
              ))}
              {/* Total */}
              <tr style={{background:"#1A1A1A",fontWeight:700}}>
                <td style={{color:"#F5C800"}} colSpan={2}>TOTAL GERAL</td>
                <td style={{color:"var(--verde-lt)"}}>{fmt(dreObras.reduce((s,o)=>s+(o.receita||0),0))}</td>
                <td style={{color:"#FCEBEB"}}>{fmt(dreObras.reduce((s,o)=>s+(o.custoDir||0),0))}</td>
                <td style={{color:"#F5C800"}} colSpan={2}>{fmt(dreObras.reduce((s,o)=>s+(o.margBruta||0),0))}</td>
                <td style={{color:"#F5C800"}} colSpan={2}>{fmt(dreObras.reduce((s,o)=>s+(o.margLiq||0),0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {aba==="abc" && (
        <>
          <div className="alert alert-info" style={{marginBottom:14,fontSize:12}}>
            <strong>Curva ABC:</strong> Classe A = 80% do consumo · Classe B = próximos 15% · Classe C = restante. Foque negociações nos itens Classe A.
          </div>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            {["A","B","C"].map(cls=>{
              const items=abcComCurva.filter(i=>i.classe===cls);
              const colors={A:"#B83232",B:"#BA7517",C:"#639922"};
              return <div key={cls} style={{flex:1,background:`${colors[cls]}15`,border:`1px solid ${colors[cls]}30`,borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:colors[cls]}}>Classe {cls}</div>
                <div style={{fontSize:13}}>{items.length} itens</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>{items.reduce((s,i)=>s+i.qtd,0)} unidades consumidas</div>
              </div>;
            })}
          </div>
          {abcComCurva.length===0 && <div className="empty-state"><div className="empty-icon">📊</div><p>Nenhuma movimentação de material registrada ainda</p></div>}
          {abcComCurva.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Classe</th><th>Material</th><th>Consumo total</th><th>Un.</th><th>% do total</th><th>% acumulado</th></tr></thead>
                <tbody>
                  {abcComCurva.map((item,i)=>{
                    const pctItem=totalQtd>0?item.qtd/totalQtd*100:0;
                    const cls={A:"badge-red",B:"badge-amber",C:"badge-green"}[item.classe];
                    return(
                      <tr key={i}>
                        <td><span className={`badge ${cls}`} style={{fontWeight:700}}>Classe {item.classe}</span></td>
                        <td style={{fontWeight:500}}>{item.nome}</td>
                        <td style={{fontWeight:700}}>{item.qtd}</td>
                        <td style={{fontSize:12}}>{item.un}</td>
                        <td style={{fontSize:12}}>{pctItem.toFixed(1)}%</td>
                        <td>
                          <div className="progress-bar" style={{marginBottom:2,width:80}}>
                            <div className="progress-fill" style={{width:`${Math.min(item.pctAcum,100)}%`,background:item.classe==="A"?"var(--vermelho)":item.classe==="B"?"var(--afine-yellow-dk)":"var(--verde)"}}/>
                          </div>
                          <span style={{fontSize:10}}>{item.pctAcum.toFixed(0)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
