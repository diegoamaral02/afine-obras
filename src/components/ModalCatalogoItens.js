// src/components/ModalCatalogoItens.js — v3: seleção + gerenciamento inline
import React, { useState, useMemo, useRef } from "react";
import { useCatalogoItens } from "../hooks/useCatalogoItens";
import { useAuth } from "../contexts/AuthContext";

// Quem pode editar o catálogo: ADM, Gestão, Compras
function podeGerenciar(userProfile) {
  if (!userProfile) return false;
  if (userProfile.adm === true) return true;
  const dep = userProfile.departamento || userProfile.perfil || "";
  return ["adm","gestao","compras"].includes(dep);
}

// ── Unidades disponíveis ────────────────────────────────────────────────────
const UNIDADES = ["un","m","m²","m³","cx","sc","lata","galão","gl","rolo","barra","balde","chp","cj","fl","vaso","kg","pç"];

// ── Paleta de cores para novas categorias ───────────────────────────────────
const CORES_CAT = ["#F5A623","#4A90D9","#8B5E3C","#7B5EA7","#6D6D6D","#2ECC71","#C0392B","#E74C3C","#27AE60","#185FA5","#C9A200","#7B4F00"];

export default function ModalCatalogoItens({ onConfirmar, onFechar, itensJaAdicionados = [] }) {
  const { userProfile } = useAuth();
  const { categorias, loading, adicionarItem, editarItem, removerItem, adicionarCategoria } = useCatalogoItens();

  // Modo: "selecao" | "gerenciar"
  const [modo, setModo]                   = useState("selecao");
  const [categoriaAtiva, setCategoriaAtiva] = useState(null);
  const [selecionados, setSelecionados]    = useState({});
  const [busca, setBusca]                  = useState("");

  // Editor de item
  const [editandoId, setEditandoId]        = useState(null); // id do item sendo editado
  const [editForm, setEditForm]            = useState({});   // { descricao, unidade, fabricante }

  // Novo item
  const [novoItem, setNovoItem]            = useState({ descricao:"", unidade:"un", fabricante:"" });
  const [adicionandoEm, setAdicionandoEm]  = useState(null); // categoriaId

  // Nova categoria
  const [novaCategoria, setNovaCategoria]  = useState({ label:"", cor: CORES_CAT[0] });
  const [criandoCategoria, setCriandoCategoria] = useState(false);

  const canGerenciar = podeGerenciar(userProfile);

  // Categoria ativa default: primeira disponível
  const catAtiva = categoriaAtiva || categorias[0]?.id || null;

  const catObj = useMemo(() => categorias.find(c => c.id === catAtiva), [categorias, catAtiva]);

  const itensFiltrados = useMemo(() => {
    const base = catObj?.itens || [];
    if (!busca.trim()) return base;
    const q = busca.toLowerCase();
    return base.filter(i => i.descricao.toLowerCase().includes(q));
  }, [catObj, busca]);

  // ── Seleção ──────────────────────────────────────────────────────────────
  function toggleItem(item) {
    setSelecionados(prev => {
      const key = item.descricao;
      if (prev[key]) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: { qtd: 1, un: item.unidade } };
    });
  }
  function setQtd(key, val) {
    setSelecionados(prev => ({ ...prev, [key]: { ...prev[key], qtd: Math.max(0.01, Number(val)) } }));
  }
  function setUnSel(key, val) {
    setSelecionados(prev => ({ ...prev, [key]: { ...prev[key], un: val } }));
  }

  const total = Object.keys(selecionados).length;
  const jaSet = new Set(itensJaAdicionados.map(i => i.item));

  function confirmar() {
    onConfirmar(Object.entries(selecionados).map(([descricao, { qtd, un }]) => ({ item: descricao, qtd, unidade: un })));
  }

  // ── Edição de item ───────────────────────────────────────────────────────
  function iniciarEdicao(item) {
    setEditandoId(item.id);
    setEditForm({ descricao: item.descricao, unidade: item.unidade, fabricante: item.fabricante || "" });
  }
  async function salvarEdicao(id) {
    if (!editForm.descricao?.trim()) return;
    await editarItem(id, editForm);
    setEditandoId(null);
  }
  async function excluirItem(id) {
    if (!window.confirm("Remover este item do catálogo?")) return;
    await removerItem(id);
  }

  // ── Novo item ────────────────────────────────────────────────────────────
  async function salvarNovoItem() {
    if (!novoItem.descricao.trim() || !adicionandoEm) return;
    await adicionarItem(adicionandoEm, novoItem);
    setNovoItem({ descricao:"", unidade:"un", fabricante:"" });
    setAdicionandoEm(null);
  }

  // ── Nova categoria ───────────────────────────────────────────────────────
  async function salvarNovaCategoria() {
    if (!novaCategoria.label.trim()) return;
    const id = novaCategoria.label.trim().toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");
    await adicionarCategoria({ id, label: novaCategoria.label.trim(), cor: novaCategoria.cor });
    setNovaCategoria({ label:"", cor: CORES_CAT[0] });
    setCriandoCategoria(false);
    setCategoriaAtiva(id);
  }

  // ── Estilos compartilhados ───────────────────────────────────────────────
  const inputStyle = {
    padding:"6px 10px", border:"1px solid #E2DFD8", borderRadius:6,
    fontSize:12, outline:"none", background:"#fff", width:"100%", boxSizing:"border-box",
  };

  return (
    <div
      onClick={onFechar}
      style={{
        position:"fixed", inset:0, zIndex:300,
        background:"rgba(10,10,10,.65)", backdropFilter:"blur(4px)",
        display:"flex", alignItems:"center", justifyContent:"center", padding:16,
      }}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          width:"min(900px,96vw)", maxHeight:"90vh",
          background:"#fff", borderRadius:14,
          boxShadow:"0 24px 64px rgba(0,0,0,.28)",
          display:"flex", flexDirection:"column", overflow:"hidden",
        }}
      >

        {/* ── HEADER ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 20px", borderBottom:"2px solid #F5C400", background:"#1A1A1A",
        }}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <span style={{fontSize:19}}>📦</span>
            <div>
              <div style={{fontWeight:700, fontSize:15, color:"#F5C400", letterSpacing:"-.01em"}}>
                Catálogo de Itens por Serviço
              </div>
              <div style={{fontSize:11, color:"rgba(255,255,255,.4)", marginTop:1}}>
                {modo==="selecao" ? "Selecione os itens e ajuste as quantidades" : "Adicione, edite ou remova itens do catálogo"}
              </div>
            </div>
          </div>
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            {/* Toggle modo — só para quem pode gerenciar */}
            {canGerenciar && (
              <button
                onClick={()=>{ setModo(m => m==="selecao"?"gerenciar":"selecao"); setEditandoId(null); setAdicionandoEm(null); }}
                style={{
                  padding:"6px 14px", border:"1px solid rgba(255,255,255,.2)",
                  borderRadius:7, background: modo==="gerenciar" ? "#F5C400" : "rgba(255,255,255,.08)",
                  color: modo==="gerenciar" ? "#1A1A1A" : "rgba(255,255,255,.7)",
                  cursor:"pointer", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:6,
                }}
              >
                {modo==="gerenciar" ? "✓ Editar" : "✏️ Gerenciar catálogo"}
              </button>
            )}
            <button
              onClick={onFechar}
              style={{
                background:"rgba(255,255,255,.08)", border:"none", borderRadius:8,
                width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", color:"rgba(255,255,255,.6)", fontSize:18,
              }}
            >×</button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{display:"flex", flex:1, minHeight:0, overflow:"hidden"}}>

          {/* Sidebar categorias */}
          <div style={{
            width:215, minWidth:215, background:"#F8F7F4",
            borderRight:"1px solid #E2DFD8", overflowY:"auto", padding:"8px 0",
          }}>
            {loading && <div style={{padding:20, textAlign:"center", color:"#aaa", fontSize:12}}>Carregando...</div>}

            {categorias.map(cat => {
              const ativa = catAtiva === cat.id;
              const qtdSel = Object.keys(selecionados).filter(k => cat.itens.some(i => i.descricao===k)).length;
              return (
                <button
                  key={cat.id}
                  onClick={()=>{ setCategoriaAtiva(cat.id); setBusca(""); setEditandoId(null); setAdicionandoEm(null); }}
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    width:"100%", padding:"9px 12px 9px 12px",
                    border:"none", borderLeft:`3px solid ${ativa ? cat.cor : "transparent"}`,
                    background: ativa ? "#fff" : "transparent",
                    color: ativa ? "#1A1A1A" : "#555",
                    textAlign:"left", cursor:"pointer",
                    fontSize:12.5, fontWeight: ativa ? 700 : 400,
                    boxShadow: ativa ? "0 1px 4px rgba(0,0,0,.07)" : "none",
                    transition:"all .12s",
                  }}
                >
                  <span style={{lineHeight:1.35, flex:1}}>{cat.label}</span>
                  {modo==="selecao" && qtdSel > 0 && (
                    <span style={{
                      background:cat.cor, color:"#fff", borderRadius:20,
                      padding:"1px 7px", fontSize:10, fontWeight:700,
                      minWidth:18, textAlign:"center", flexShrink:0, marginLeft:4,
                    }}>{qtdSel}</span>
                  )}
                  {modo==="gerenciar" && (
                    <span style={{fontSize:11, color:"#bbb", flexShrink:0, marginLeft:4}}>
                      {cat.itens.length}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Botão nova categoria */}
            {modo==="gerenciar" && canGerenciar && (
              <div style={{padding:"8px 10px 4px"}}>
                {!criandoCategoria ? (
                  <button
                    onClick={()=>setCriandoCategoria(true)}
                    style={{
                      width:"100%", padding:"7px 10px",
                      border:"1px dashed #ccc", borderRadius:7,
                      background:"transparent", color:"#888",
                      cursor:"pointer", fontSize:12, textAlign:"center",
                    }}
                  >+ Nova categoria</button>
                ) : (
                  <div style={{display:"flex", flexDirection:"column", gap:6}}>
                    <input
                      placeholder="Nome da categoria"
                      value={novaCategoria.label}
                      onChange={e=>setNovaCategoria(p=>({...p, label:e.target.value}))}
                      style={{...inputStyle, fontSize:12}}
                      autoFocus
                    />
                    <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
                      {CORES_CAT.map(c => (
                        <div
                          key={c} onClick={()=>setNovaCategoria(p=>({...p,cor:c}))}
                          style={{
                            width:18, height:18, borderRadius:4, background:c, cursor:"pointer",
                            outline: novaCategoria.cor===c ? `2px solid #1A1A1A` : "none",
                            outlineOffset:1,
                          }}
                        />
                      ))}
                    </div>
                    <div style={{display:"flex", gap:4}}>
                      <button onClick={()=>{setCriandoCategoria(false);setNovaCategoria({label:"",cor:CORES_CAT[0]});}}
                        style={{flex:1, padding:"5px", border:"1px solid #E2DFD8", borderRadius:6, background:"#fff", cursor:"pointer", fontSize:11}}>
                        Cancelar
                      </button>
                      <button onClick={salvarNovaCategoria}
                        style={{flex:1, padding:"5px", border:"none", borderRadius:6, background:"#1A1A1A", color:"#F5C400", cursor:"pointer", fontSize:11, fontWeight:700}}>
                        Criar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lista de itens */}
          <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>

            {/* Busca */}
            <div style={{padding:"10px 14px 8px", borderBottom:"1px solid #E2DFD8", background:"#fff"}}>
              <div style={{
                display:"flex", alignItems:"center", gap:8,
                background:"#F3F2EF", borderRadius:8, padding:"7px 12px",
                border:"1px solid #E2DFD8",
              }}>
                <span style={{fontSize:13, color:"#aaa"}}>🔍</span>
                <input
                  type="text"
                  placeholder={`Filtrar em "${catObj?.label.replace(/.*—\s*/,"") || ""}"`}
                  value={busca}
                  onChange={e=>setBusca(e.target.value)}
                  style={{border:"none", background:"transparent", outline:"none", fontSize:13, flex:1, color:"#1A1A1A"}}
                />
                {busca && (
                  <button onClick={()=>setBusca("")}
                    style={{background:"none", border:"none", cursor:"pointer", color:"#aaa", fontSize:15, padding:0, lineHeight:1}}>×</button>
                )}
              </div>
            </div>

            {/* Itens */}
            <div style={{flex:1, overflowY:"auto", padding:"4px 0"}}>
              {loading && <div style={{padding:32, textAlign:"center", color:"#aaa", fontSize:13}}>Carregando catálogo...</div>}
              {!loading && itensFiltrados.length === 0 && (
                <div style={{padding:32, textAlign:"center", color:"#aaa", fontSize:13}}>
                  {busca ? "Nenhum item encontrado." : "Nenhum item nesta categoria."}
                </div>
              )}

              {itensFiltrados.map((item, idx) => {
                const key    = item.descricao;
                const sel    = selecionados[key];
                const jaTem  = jaSet.has(key);
                const editando = editandoId === item.id;

                return (
                  <div key={item.id} style={{
                    borderBottom: idx < itensFiltrados.length-1 ? "1px solid #F0EDE8" : "none",
                    background: editando ? "#FFFBEA" : sel ? "#FFFBEA" : "transparent",
                  }}>

                    {/* ── Modo EDIÇÃO ── */}
                    {editando && modo==="gerenciar" ? (
                      <div style={{padding:"10px 16px", display:"flex", flexDirection:"column", gap:7}}>
                        <input
                          value={editForm.descricao}
                          onChange={e=>setEditForm(p=>({...p, descricao:e.target.value}))}
                          placeholder="Descrição do item"
                          style={{...inputStyle, fontWeight:600}}
                          autoFocus
                        />
                        <div style={{display:"flex", gap:6}}>
                          <select
                            value={editForm.unidade}
                            onChange={e=>setEditForm(p=>({...p, unidade:e.target.value}))}
                            style={{...inputStyle, width:90}}
                          >
                            {UNIDADES.map(u=><option key={u}>{u}</option>)}
                          </select>
                          <input
                            value={editForm.fabricante}
                            onChange={e=>setEditForm(p=>({...p, fabricante:e.target.value}))}
                            placeholder="Fabricante / referência (opcional)"
                            style={{...inputStyle, flex:1}}
                          />
                        </div>
                        <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
                          <button onClick={()=>setEditandoId(null)}
                            style={{padding:"5px 14px", border:"1px solid #E2DFD8", borderRadius:6, background:"#fff", cursor:"pointer", fontSize:12}}>
                            Cancelar
                          </button>
                          <button onClick={()=>salvarEdicao(item.id)}
                            style={{padding:"5px 14px", border:"none", borderRadius:6, background:"#1A1A1A", color:"#F5C400", cursor:"pointer", fontSize:12, fontWeight:700}}>
                            ✓ Salvar
                          </button>
                        </div>
                      </div>

                    ) : (
                      /* ── Modo NORMAL / SELEÇÃO ── */
                      <div
                        onClick={()=> modo==="selecao" && toggleItem(item)}
                        style={{
                          display:"flex", alignItems:"center", gap:12,
                          padding:"11px 16px",
                          cursor: modo==="selecao" ? "pointer" : "default",
                          opacity: jaTem && !sel ? 0.45 : 1,
                          transition:"background .1s",
                        }}
                        onMouseEnter={e=>{ if(modo==="selecao"&&!sel) e.currentTarget.style.background="#F8F7F4"; }}
                        onMouseLeave={e=>{ if(modo==="selecao"&&!sel) e.currentTarget.style.background="transparent"; }}
                      >
                        {/* Checkbox (só no modo seleção) */}
                        {modo==="selecao" && (
                          <div style={{
                            width:18, height:18, borderRadius:5, flexShrink:0,
                            border: sel ? "none" : "2px solid #ccc",
                            background: sel ? "#1A1A1A" : "transparent",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            transition:"all .12s",
                          }}>
                            {sel && <span style={{color:"#F5C400", fontSize:12, fontWeight:800}}>✓</span>}
                          </div>
                        )}

                        {/* Ícone drag (gerenciar) */}
                        {modo==="gerenciar" && (
                          <span style={{color:"#ccc", fontSize:14, cursor:"grab", flexShrink:0}}>⠿</span>
                        )}

                        {/* Texto */}
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontSize:13, fontWeight: sel?600:400, color:"#1A1A1A", lineHeight:1.35}}>
                            {item.descricao}
                            {jaTem && !sel && (
                              <span style={{marginLeft:7, fontSize:10, color:"#999", background:"#eee", padding:"1px 6px", borderRadius:4}}>já na lista</span>
                            )}
                          </div>
                          {item.fabricante && item.fabricante!=="Genérico" && (
                            <div style={{fontSize:11, color:"#aaa", marginTop:1}}>{item.fabricante}</div>
                          )}
                        </div>

                        {/* Qtd + Un — modo seleção */}
                        {modo==="selecao" && sel && (
                          <div onClick={e=>e.stopPropagation()} style={{display:"flex", gap:6, alignItems:"center", flexShrink:0}}>
                            <input
                              type="number" min="0.01" step="1" value={sel.qtd}
                              onChange={e=>setQtd(key, e.target.value)}
                              style={{width:68, padding:"5px 8px", border:"1px solid #E2DFD8", borderRadius:6, fontSize:13, textAlign:"right", fontWeight:600, background:"#fff", outline:"none"}}
                            />
                            <input
                              type="text" value={sel.un}
                              onChange={e=>setUnSel(key, e.target.value)}
                              style={{width:46, padding:"5px 6px", border:"1px solid #E2DFD8", borderRadius:6, fontSize:12, textAlign:"center", background:"#fff", outline:"none", color:"#555"}}
                            />
                          </div>
                        )}

                        {/* Unidade padrão — não selecionado */}
                        {modo==="selecao" && !sel && (
                          <span style={{fontSize:11, color:"#ccc", flexShrink:0, minWidth:40, textAlign:"right"}}>{item.unidade}</span>
                        )}

                        {/* Ações — modo gerenciar */}
                        {modo==="gerenciar" && canGerenciar && (
                          <div style={{display:"flex", gap:4, flexShrink:0}}>
                            <button
                              onClick={()=>iniciarEdicao(item)}
                              title="Editar"
                              style={{
                                padding:"4px 10px", border:"1px solid #E2DFD8",
                                borderRadius:6, background:"#fff", cursor:"pointer",
                                fontSize:12, color:"#555",
                              }}
                            >✏️</button>
                            <button
                              onClick={()=>excluirItem(item.id)}
                              title="Remover"
                              style={{
                                padding:"4px 10px", border:"1px solid rgba(189,56,56,.2)",
                                borderRadius:6, background:"#fff", cursor:"pointer",
                                fontSize:12, color:"var(--vermelho,#BD3838)",
                              }}
                            >🗑️</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Formulário de novo item */}
              {modo==="gerenciar" && canGerenciar && (
                <div style={{padding:"10px 16px", borderTop:"1px dashed #E2DFD8", marginTop:4}}>
                  {adicionandoEm !== catAtiva ? (
                    <button
                      onClick={()=>setAdicionandoEm(catAtiva)}
                      style={{
                        width:"100%", padding:"8px",
                        border:"1px dashed #F5C400", borderRadius:8,
                        background:"#FFFBEA", color:"#1A1A1A",
                        cursor:"pointer", fontSize:13, fontWeight:600,
                      }}
                    >+ Adicionar item nesta categoria</button>
                  ) : (
                    <div style={{display:"flex", flexDirection:"column", gap:7,
                      background:"#F8F7F4", borderRadius:8, padding:12, border:"1px solid #E2DFD8"}}>
                      <div style={{fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:".06em"}}>
                        Novo item — {catObj?.label}
                      </div>
                      <input
                        value={novoItem.descricao}
                        onChange={e=>setNovoItem(p=>({...p, descricao:e.target.value}))}
                        placeholder="Descrição do item *"
                        style={{...inputStyle, fontWeight:500}}
                        autoFocus
                        onKeyDown={e=>e.key==="Enter" && salvarNovoItem()}
                      />
                      <div style={{display:"flex", gap:6}}>
                        <select
                          value={novoItem.unidade}
                          onChange={e=>setNovoItem(p=>({...p, unidade:e.target.value}))}
                          style={{...inputStyle, width:90}}
                        >
                          {UNIDADES.map(u=><option key={u}>{u}</option>)}
                        </select>
                        <input
                          value={novoItem.fabricante}
                          onChange={e=>setNovoItem(p=>({...p, fabricante:e.target.value}))}
                          placeholder="Fabricante / referência (opcional)"
                          style={{...inputStyle, flex:1}}
                        />
                      </div>
                      <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
                        <button
                          onClick={()=>{setAdicionandoEm(null);setNovoItem({descricao:"",unidade:"un",fabricante:""});}}
                          style={{padding:"6px 16px", border:"1px solid #E2DFD8", borderRadius:6, background:"#fff", cursor:"pointer", fontSize:12}}
                        >Cancelar</button>
                        <button
                          onClick={salvarNovoItem}
                          disabled={!novoItem.descricao.trim()}
                          style={{
                            padding:"6px 18px", border:"none", borderRadius:6,
                            background: novoItem.descricao.trim() ? "#1A1A1A" : "#E2DFD8",
                            color: novoItem.descricao.trim() ? "#F5C400" : "#aaa",
                            cursor: novoItem.descricao.trim() ? "pointer" : "not-allowed",
                            fontSize:12, fontWeight:700,
                          }}
                        >✓ Adicionar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"11px 20px", borderTop:"1px solid #E2DFD8", background:"#F8F7F4",
        }}>
          <div style={{fontSize:13, color: total > 0 ? "#1A1A1A" : "#aaa"}}>
            {modo==="gerenciar"
              ? <span style={{color:"#888", fontSize:12}}>✏️ Modo edição — alterações salvas automaticamente no Firestore</span>
              : total===0 ? "Nenhum item selecionado"
              : <span><strong style={{color:"#1A1A1A"}}>{total}</strong> item{total>1?"s":""} selecionado{total>1?"s":""}</span>
            }
          </div>
          <div style={{display:"flex", gap:8}}>
            <button
              onClick={onFechar}
              style={{padding:"9px 20px", border:"1px solid #E2DFD8", borderRadius:8, background:"#fff", color:"#555", cursor:"pointer", fontSize:13, fontWeight:500}}
            >
              {modo==="gerenciar" ? "Fechar" : "Cancelar"}
            </button>
            {modo==="selecao" && (
              <button
                onClick={confirmar}
                disabled={total===0}
                style={{
                  padding:"9px 24px", border:"none", borderRadius:8,
                  background: total>0 ? "#1A1A1A" : "#E2DFD8",
                  color: total>0 ? "#F5C400" : "#aaa",
                  cursor: total>0 ? "pointer" : "not-allowed",
                  fontWeight:700, fontSize:13,
                  boxShadow: total>0 ? "0 2px 8px rgba(0,0,0,.18)" : "none",
                  display:"flex", alignItems:"center", gap:7,
                }}
              >
                <span>✓</span>
                <span>Adicionar{total>0?` (${total})`:""}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
