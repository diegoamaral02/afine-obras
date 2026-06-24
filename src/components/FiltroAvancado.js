// src/components/FiltroAvancado.js — painel de filtros combináveis, reutilizável
// entre Obras, Manutenção, Compras, Financeiro e Despesas.
//
// Cada página define seus próprios "campos" (período, selects, status multi-
// escolha) e como aplicá-los à sua lista de dados; este componente só cuida
// da UI (botão "Filtros" com contador de filtros ativos + painel expansível)
// e do estado dos valores selecionados.
import React, { useState } from "react";

// Conta quantos filtros estão realmente ativos (para o badge do botão)
export function contarFiltrosAtivos(filtros) {
  return Object.values(filtros).filter(v => {
    if (v == null || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.values(v).some(x => x);
    return true;
  }).length;
}

export default function FiltroAvancado({ campos, valores, onChange, onLimpar }) {
  const [aberto, setAberto] = useState(false);
  const ativos = contarFiltrosAtivos(valores);

  function set(key, v) {
    onChange({ ...valores, [key]: v });
  }
  function toggleMulti(key, valor) {
    const atual = valores[key] || [];
    set(key, atual.includes(valor) ? atual.filter(v=>v!==valor) : [...atual, valor]);
  }

  return (
    <div style={{position:"relative",marginBottom:12}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button className="btn btn-sm" onClick={()=>setAberto(v=>!v)}
          style={{background:ativos>0?"#1A1A1A":"",color:ativos>0?"var(--afine-yellow)":"",display:"flex",alignItems:"center",gap:6}}>
          🔧 Filtros {ativos>0 && <span className="badge badge-amber" style={{fontSize:10}}>{ativos}</span>}
          <span style={{fontSize:10}}>{aberto?"▲":"▼"}</span>
        </button>
        {ativos>0 && (
          <button className="btn btn-sm" onClick={()=>{onLimpar();setAberto(false);}} style={{color:"var(--vermelho)"}}>
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {aberto && (
        <div style={{
          marginTop:8, background:"#fff", border:"1px solid var(--border)", borderRadius:10,
          padding:16, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14,
        }}>
          {campos.map(campo => {
            // ── Período (intervalo de datas) ──────────────────────────
            if (campo.tipo === "periodo") {
              const v = valores[campo.key] || { de:"", ate:"" };
              return (
                <div key={campo.key} style={{gridColumn:"span 2"}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".04em",display:"block",marginBottom:6}}>{campo.label}</label>
                  <div style={{display:"flex",gap:8}}>
                    <input type="date" value={v.de} onChange={e=>set(campo.key,{...v,de:e.target.value})} style={{flex:1}}/>
                    <span style={{alignSelf:"center",color:"#7A7A7A",fontSize:12}}>até</span>
                    <input type="date" value={v.ate} onChange={e=>set(campo.key,{...v,ate:e.target.value})} style={{flex:1}}/>
                  </div>
                </div>
              );
            }
            // ── Select simples (cliente, responsável, fornecedor, etc.) ──
            if (campo.tipo === "select") {
              return (
                <div key={campo.key}>
                  <label style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".04em",display:"block",marginBottom:6}}>{campo.label}</label>
                  <select value={valores[campo.key]||""} onChange={e=>set(campo.key,e.target.value)}>
                    <option value="">Todos</option>
                    {campo.opcoes.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              );
            }
            // ── Multi-seleção (status, etapas, etc.) via checkboxes ──────
            if (campo.tipo === "multi") {
              const sel = valores[campo.key] || [];
              return (
                <div key={campo.key} style={{gridColumn: campo.largo ? "span 2" : "span 1"}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".04em",display:"block",marginBottom:6}}>{campo.label}</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {campo.opcoes.map(o=>{
                      const ativo = sel.includes(o.value);
                      return (
                        <button key={o.value} type="button" onClick={()=>toggleMulti(campo.key,o.value)}
                          style={{
                            fontSize:11, padding:"5px 10px", borderRadius:14, cursor:"pointer",
                            border:`1px solid ${ativo?"var(--afine-yellow-dk)":"var(--border)"}`,
                            background:ativo?"var(--afine-yellow-lt)":"var(--cinza-lt)",
                            fontWeight:ativo?700:400,
                          }}>
                          {ativo?"✓ ":""}{o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            // ── Booleano (ex: "só com reembolso") ────────────────────────
            if (campo.tipo === "bool") {
              return (
                <div key={campo.key}>
                  <label style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".04em",display:"block",marginBottom:6}}>{campo.label}</label>
                  <select value={valores[campo.key]??""} onChange={e=>set(campo.key, e.target.value===""?"":e.target.value==="true")}>
                    <option value="">Todos</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

// ── Helpers de aplicação de filtro (usados pelas páginas) ─────────────────
export function dentroPeriodo(dataISO, periodo) {
  if (!periodo || (!periodo.de && !periodo.ate)) return true;
  if (!dataISO) return false;
  if (periodo.de && dataISO < periodo.de) return false;
  if (periodo.ate && dataISO > periodo.ate) return false;
  return true;
}
