// src/components/CustosMaoDeObra.js
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

// ── helpers ────────────────────────────────────────────────────────────────
const fmt   = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const fmtH  = ms => { const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000); return `${h}h${String(m).padStart(2,"0")}m`; };
const HORA_MENSAL = 220; // CLT: 44h/sem = 220h/mês

function dow(isoDate) { return new Date(isoDate + "T12:00:00").getDay(); } // 0=Dom,6=Sab

function pararPontos(pts) {
  const pares = []; let ep = null;
  for (const p of [...pts].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))) {
    if (p.tipo==="ENTRADA") { if (ep) pares.push({entrada:ep,saida:null}); ep=p; }
    else if (p.tipo==="SAIDA" && ep) { pares.push({entrada:ep,saida:p}); ep=null; }
  }
  if (ep) pares.push({entrada:ep,saida:null});
  return pares;
}

function calcHoras(pares, date) {
  let n=0, e50=0, e100=0;
  const d = dow(date);
  for (const {entrada,saida} of pares) {
    if (!saida) continue;
    const ms = new Date(saida.timestamp) - new Date(entrada.timestamp);
    if (ms<=0) continue;
    if (d===0) { e100+=ms; }
    else if (d===6) { const lim=4*3600000; n+=Math.min(ms,lim); e50+=Math.max(0,ms-lim); }
    else { const lim=8*3600000; n+=Math.min(ms,lim); e50+=Math.max(0,ms-lim); }
  }
  return {n,e50,e100};
}

// ── Card de Mão de Obra ────────────────────────────────────────────────────
function CardMaoDeObra({ obraId, equipeIds, funcionarios, onCustoChange }) {
  const [pontos, setPontos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!obraId) return;
    const q = query(collection(db,"pontos"), where("vinculoId","==",obraId), where("vinculoTipo","==","obra"));
    return onSnapshot(q, snap => { setPontos(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); });
  }, [obraId]);

  const resultado = useMemo(() => {
    const equipe = (funcionarios||[]).filter(f=>(equipeIds||[]).includes(f.id) && f.salario);

    // agrupa pontos por usuário → dia
    const byUser = {};
    for (const p of pontos) {
      const uid = p.usuarioId;
      if (!uid) continue;
      const day = (p.timestamp||"").slice(0,10);
      if (!day) continue;
      if (!byUser[uid]) byUser[uid]={};
      if (!byUser[uid][day]) byUser[uid][day]=[];
      byUser[uid][day].push(p);
    }

    let totalNms=0, totalE50ms=0, totalE100ms=0, totalCusto=0;
    const linhas = equipe.map(f => {
      const sal  = Number(f.salario)||0;
      const taxa = sal / HORA_MENSAL; // R$/hora
      const dias = byUser[f.id]||{};
      let nMs=0, e50Ms=0, e100Ms=0;
      for (const [day,pts] of Object.entries(dias)) {
        const {n,e50,e100} = calcHoras(pararPontos(pts), day);
        nMs+=n; e50Ms+=e50; e100Ms+=e100;
      }
      const custo = taxa*(nMs/3600000) + taxa*1.5*(e50Ms/3600000) + taxa*2*(e100Ms/3600000);
      totalNms+=nMs; totalE50ms+=e50Ms; totalE100ms+=e100Ms; totalCusto+=custo;
      return {f, nMs, e50Ms, e100Ms, custo, taxa};
    });

    return {linhas, totalNms, totalE50ms, totalE100ms, totalCusto};
  }, [pontos, funcionarios, equipeIds]);

  useEffect(() => { onCustoChange?.(resultado.totalCusto); }, [resultado.totalCusto]); // eslint-disable-line

  return (
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
      <div style={{background:"#1A1A1A",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>👷</span>
          <span style={{color:"#F5C800",fontWeight:700,fontSize:13}}>Custo de Mão de Obra</span>
        </div>
        <span style={{color:"#F5C800",fontWeight:700,fontSize:14}}>{loading?"…":fmt(resultado.totalCusto)}</span>
      </div>
      <div style={{padding:"10px 14px",fontSize:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
          <div style={{background:"var(--cinza-lt)",borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
            <div style={{color:"#7A7A7A",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Normal</div>
            <div style={{fontWeight:700,fontSize:13}}>{fmtH(resultado.totalNms)}</div>
          </div>
          <div style={{background:"#FFF8E1",borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
            <div style={{color:"#7A7A7A",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Extra 50%</div>
            <div style={{fontWeight:700,fontSize:13,color:"var(--afine-yellow-dk)"}}>{fmtH(resultado.totalE50ms)}</div>
          </div>
          <div style={{background:"#FFF3E0",borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
            <div style={{color:"#7A7A7A",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Domingo 100%</div>
            <div style={{fontWeight:700,fontSize:13,color:"#E65100"}}>{fmtH(resultado.totalE100ms)}</div>
          </div>
        </div>
        <div style={{fontSize:10,color:"#7A7A7A",marginBottom:6}}>
          Seg–Sex: 8h normais · Sáb: 08h–12h normal, após 50% · Dom: 100%
        </div>
        {resultado.linhas.length===0 ? (
          <div style={{color:"#7A7A7A",fontStyle:"italic",fontSize:11}}>Nenhum colaborador com salário cadastrado ou sem ponto registrado nesta obra.</div>
        ) : (
          <>
            <button onClick={()=>setAberto(a=>!a)} style={{background:"none",border:"none",color:"var(--afine-yellow-dk)",cursor:"pointer",fontSize:11,padding:0,fontWeight:600}}>
              {aberto?"▲ Ocultar detalhe":"▼ Ver por colaborador"}
            </button>
            {aberto && (
              <table style={{width:"100%",borderCollapse:"collapse",marginTop:8,fontSize:11}}>
                <thead>
                  <tr style={{background:"var(--cinza-lt)"}}>
                    <th style={{textAlign:"left",padding:"4px 6px"}}>Colaborador</th>
                    <th style={{padding:"4px 6px"}}>Normal</th>
                    <th style={{padding:"4px 6px"}}>Extra 50%</th>
                    <th style={{padding:"4px 6px"}}>Dom 100%</th>
                    <th style={{padding:"4px 6px",textAlign:"right"}}>Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.linhas.map(({f,nMs,e50Ms,e100Ms,custo})=>(
                    <tr key={f.id} style={{borderBottom:"1px solid var(--border)"}}>
                      <td style={{padding:"4px 6px"}}>{f.nome}</td>
                      <td style={{textAlign:"center",padding:"4px 6px"}}>{fmtH(nMs)}</td>
                      <td style={{textAlign:"center",padding:"4px 6px",color:"var(--afine-yellow-dk)"}}>{fmtH(e50Ms)}</td>
                      <td style={{textAlign:"center",padding:"4px 6px",color:"#E65100"}}>{fmtH(e100Ms)}</td>
                      <td style={{textAlign:"right",padding:"4px 6px",fontWeight:700}}>{fmt(custo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Card de Terceiro ───────────────────────────────────────────────────────
function CardTerceiro({ obraId }) {
  const [custos, setCustos] = useState([]);

  useEffect(() => {
    if (!obraId) return;
    const q = query(collection(db,"custos_demanda"), where("demandaId","==",obraId), where("tipo","==","Terceiro"));
    return onSnapshot(q, snap => setCustos(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, [obraId]);

  const total = custos.filter(c=>c.status!=="cancelado").reduce((s,c)=>s+(Number(c.valor)||0),0);
  const qtd   = custos.filter(c=>c.status!=="cancelado").length;

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
        <div style={{color:"#7A7A7A",marginBottom:4,fontSize:11}}>
          Considera apenas valor da diária — sem hora extra. ({qtd} lançamento{qtd!==1?"s":""})
        </div>
        {custos.filter(c=>c.status!=="cancelado").length>0 && (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:6}}>
            <thead>
              <tr style={{background:"var(--cinza-lt)"}}>
                <th style={{textAlign:"left",padding:"4px 6px"}}>Descrição</th>
                <th style={{padding:"4px 6px"}}>Data</th>
                <th style={{padding:"4px 6px",textAlign:"right"}}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {custos.filter(c=>c.status!=="cancelado").sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(c=>(
                <tr key={c.id} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"4px 6px"}}>{c.descricao||"—"}</td>
                  <td style={{textAlign:"center",padding:"4px 6px"}}>{c.data?.split("-").reverse().join("/")||"—"}</td>
                  <td style={{textAlign:"right",padding:"4px 6px",fontWeight:700}}>{fmt(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {custos.filter(c=>c.status!=="cancelado").length===0 && (
          <div style={{color:"#7A7A7A",fontStyle:"italic"}}>Nenhum custo de Terceiro lançado.</div>
        )}
      </div>
    </div>
  );
}

// ── Card de Imposto ────────────────────────────────────────────────────────
function CardImposto({ orcamento, impostoPercent, onChange }) {
  const orc    = Number(orcamento)||0;
  const pct    = Number(impostoPercent)||0;
  const valor  = orc * pct / 100;
  const liquido = orc - valor;

  return (
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
      <div style={{background:"var(--vermelho,#C0392B)",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>💸</span>
          <span style={{color:"#fff",fontWeight:700,fontSize:13}}>Imposto</span>
        </div>
        <span style={{color:"#fff",fontWeight:700,fontSize:14}}>{orc>0?`− ${fmt(valor)}`:"—"}</span>
      </div>
      <div style={{padding:"10px 14px",fontSize:12}}>
        <div style={{fontSize:11,color:"#7A7A7A",marginBottom:8}}>
          Descontado diretamente do valor orçado, antes de outros descontos.
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <label style={{fontWeight:600,fontSize:12,whiteSpace:"nowrap"}}>% Imposto sobre orçamento:</label>
          <input
            type="number" min="0" max="100" step="0.01"
            value={impostoPercent}
            onChange={e=>onChange(e.target.value)}
            style={{width:80,padding:"4px 8px",border:"1px solid var(--border)",borderRadius:6,fontSize:12,textAlign:"right"}}
          />
          <span style={{fontSize:12,color:"#7A7A7A"}}>%</span>
        </div>
        {orc>0 && (
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
        {!orc && (
          <div style={{fontSize:11,color:"#7A7A7A",fontStyle:"italic",marginTop:8}}>
            Cadastre o valor do orçamento na aba Financeiro para ver o cálculo.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function CustosMaoDeObra({ obraId, equipeIds, funcionarios, orcamento, impostoPercent, onImpostoChange, onCustoMaoDeObraChange }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>
        Composição de custos
      </div>
      <CardImposto orcamento={orcamento} impostoPercent={impostoPercent} onChange={onImpostoChange} />
      <CardMaoDeObra obraId={obraId} equipeIds={equipeIds} funcionarios={funcionarios} onCustoChange={onCustoMaoDeObraChange} />
      <CardTerceiro obraId={obraId} />
      <div style={{height:1,background:"var(--border)",margin:"4px 0"}} />
      <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>
        Todos os lançamentos
      </div>
    </div>
  );
}
