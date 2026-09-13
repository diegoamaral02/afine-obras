// src/pages/AnalistasContatos.js — Analistas por área, contatos e tipos de demanda
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../contexts/AuthContext";
import { isGestorOuAdm } from "../constants/departamentos";

// Dados iniciais são carregados via script local (seed-analistas.js, não versionado)
// para não expor informações de contato em repositório público.
// Ao primeiro acesso com coleção vazia, o admin cadastra os analistas pela interface.

const TEMPLATES_VAZIO = {
  geralEmail: "", geralAssunto: "", geralObs: "Todas as demandas, EXCETO Reforma",
  reformaEmail: "", reformaAssunto: "", reformaObs: "Reforma (Plano Diretor / Espaço Itaú)",
};

// Paleta de cores para áreas — novas áreas recebem cor do ciclo
const CORES_CICLO = ["#185FA5","#7B4F00","#2D6A1F","#B83232","#7A3B99","#B87D00","#1A7A6E","#8B3A62","#4A6741","#5A4A8B"];
function corParaArea(area, index) {
  // Itaú: mantém mapeamento histórico
  const fixo = { "TELECOM - TELEFONIA":"#185FA5","GIMEA - EQUIPAMENTOS":"#7B4F00","TRANSPORTE":"#2D6A1F","SEGURANÇA":"#B83232","MATERIAIS":"#7A3B99" };
  return fixo[area] || CORES_CICLO[index % CORES_CICLO.length];
}

const FORM_VAZIO = { area:"", nome:"", email:"", telefone:"", tiposDemanda:"", obs:"", clienteId:"", clienteNome:"" };

function CopiarBtn({ texto }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }
  return (
    <button onClick={copiar} title="Copiar" style={{background:"none",border:"none",cursor:"pointer",
      fontSize:11,color:copiado?"var(--verde)":"var(--cinza-med)",padding:"0 4px",lineHeight:1}}>
      {copiado ? "✓" : "📋"}
    </button>
  );
}

export default function AnalistasContatos() {
  const { userProfile } = useAuth();
  const { addToast } = useToast();
  const isGestor = isGestorOuAdm(userProfile);

  const [analistas, setAnalistas] = useState([]);
  const [loading, setLoading]     = useState(true);

  const [templates, setTemplates]     = useState(TEMPLATES_VAZIO);
  const [editTemplate, setEditTemplate] = useState(false);
  const [formTemplate, setFormTemplate] = useState(TEMPLATES_VAZIO);

  const [clientes,      setClientes]     = useState([]);
  const [filtroCliente, setFiltroCliente] = useState(""); // "" = todos
  const [modalOpen, setModalOpen]   = useState(false);
  const [editando,  setEditando]    = useState(null);
  const [form,      setForm]        = useState(FORM_VAZIO);
  const [saving,    setSaving]      = useState(false);
  const [busca,     setBusca]       = useState("");

  // Carrega analistas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "analistas_contatos"), snap => {
      setAnalistas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  // Carrega clientes para seleção no modal
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "clientes"), snap => {
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Carrega templates de material
  useEffect(() => {
    getDocs(collection(db, "configuracoes")).then(snap => {
      const d = snap.docs.find(d => d.id === "templates_material");
      if (d) setTemplates(prev => ({ ...prev, ...d.data() }));
    });
  }, []);

  // Clientes que têm pelo menos 1 analista cadastrado
  const clientesComAnalistas = useMemo(() => {
    const ids = new Set(analistas.map(a => a.clienteId).filter(Boolean));
    return clientes.filter(c => ids.has(c.id));
  }, [analistas, clientes]);

  const filtrados = useMemo(() => {
    let lista = analistas;
    // Filtro por cliente: "" = todos; "sem-cliente" = sem vínculo; id = específico
    if (filtroCliente === "sem-cliente") {
      lista = lista.filter(a => !a.clienteId);
    } else if (filtroCliente) {
      lista = lista.filter(a => a.clienteId === filtroCliente);
    }
    const q = busca.toLowerCase();
    if (!q) return lista;
    return lista.filter(a =>
      (a.nome||"").toLowerCase().includes(q) ||
      (a.email||"").toLowerCase().includes(q) ||
      (a.tiposDemanda||"").toLowerCase().includes(q) ||
      (a.area||"").toLowerCase().includes(q)
    );
  }, [analistas, busca, filtroCliente]);

  // Áreas ordenadas por ordem de aparição nos analistas filtrados
  const areasOrdenadas = useMemo(() => {
    const vistas = [];
    filtrados.forEach(a => { if (a.area && !vistas.includes(a.area)) vistas.push(a.area); });
    return vistas;
  }, [filtrados]);

  const porArea = useMemo(() => {
    const mapa = {};
    filtrados.forEach(a => {
      const k = a.area || "SEM ÁREA";
      if (!mapa[k]) mapa[k] = [];
      mapa[k].push(a);
    });
    return mapa;
  }, [filtrados]);

  // Áreas disponíveis no modal para o cliente selecionado no form
  const areasDoCliente = useMemo(() => {
    if (!form.clienteId) return [...new Set(analistas.map(a=>a.area).filter(Boolean))].sort();
    return [...new Set(analistas.filter(a=>a.clienteId===form.clienteId).map(a=>a.area).filter(Boolean))].sort();
  }, [analistas, form.clienteId]);

  function abrirNovo() {
    setEditando(null);
    setCriandoNovaArea(false);
    setNovaArea("");
    const c = filtroCliente && filtroCliente !== "sem-cliente"
      ? clientes.find(x => x.id === filtroCliente)
      : null;
    setForm({
      ...FORM_VAZIO,
      clienteId:   c ? c.id : "",
      clienteNome: c ? (c.razaoSocial||c.nomeFantasia||c.nome||"") : "",
    });
    setModalOpen(true);
  }

  function abrirEditar(a) {
    setEditando(a);
    setCriandoNovaArea(false);
    setNovaArea("");
    setForm({ area:a.area||"", nome:a.nome||"", email:a.email||"", telefone:a.telefone||"", tiposDemanda:a.tiposDemanda||"", obs:a.obs||"", clienteId:a.clienteId||"", clienteNome:a.clienteNome||"" });
    setModalOpen(true);
  }

  const [novaArea,        setNovaArea]        = useState("");
  const [criandoNovaArea, setCriandoNovaArea] = useState(false);

  function selecionarClienteModal(id) {
    if (!id) { set("clienteId",""); set("clienteNome",""); set("area",""); setCriandoNovaArea(false); setNovaArea(""); return; }
    const c = clientes.find(x=>x.id===id);
    set("clienteId", id);
    set("clienteNome", c?.razaoSocial||c?.nomeFantasia||c?.nome||"");
    set("area","");
    setCriandoNovaArea(false);
    setNovaArea("");
  }

  async function salvar() {
    if (!form.area || !form.nome) { addToast("Área e nome são obrigatórios.","error"); return; }
    setSaving(true);
    try {
      if (editando) {
        await updateDoc(doc(db, "analistas_contatos", editando.id), { ...form, atualizadoEm: new Date().toISOString() });
        addToast("Analista atualizado!");
      } else {
        await addDoc(collection(db, "analistas_contatos"), { ...form, criadoEm: new Date().toISOString() });
        addToast("Analista adicionado!");
      }
      setModalOpen(false);
    } catch(e) { addToast("Erro: "+e.message, "error"); }
    setSaving(false);
  }

  async function excluir(id) {
    if (!window.confirm("Remover este analista?")) return;
    await deleteDoc(doc(db, "analistas_contatos", id));
    addToast("Removido.");
  }

  async function salvarTemplates() {
    try {
      await setDoc(doc(db, "configuracoes", "templates_material"), formTemplate);
      setTemplates(formTemplate);
      setEditTemplate(false);
      addToast("Templates salvos!");
    } catch(e) { addToast("Erro: "+e.message, "error"); }
  }

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const setTpl = (f, v) => setFormTemplate(p => ({ ...p, [f]: v }));

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Analistas & Contatos</div>
          <div style={{ fontSize: 12, color: "var(--cinza-med)" }}>
            {filtroCliente && filtroCliente !== "sem-cliente"
              ? `${clientes.find(c=>c.id===filtroCliente)?.razaoSocial||clientes.find(c=>c.id===filtroCliente)?.nomeFantasia||clientes.find(c=>c.id===filtroCliente)?.nome||"Cliente"} — contatos por área`
              : "Contatos por área — vinculados ao tipo de demanda em Gerenciamento"}
          </div>
        </div>
        {isGestor && (
          <button className="btn btn-primary" onClick={abrirNovo}>+ Novo analista</button>
        )}
      </div>

      {/* Abas de cliente */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
        {[
          { id:"", label:"Todos", count: analistas.length },
          ...clientesComAnalistas.map(c => ({
            id: c.id,
            label: c.razaoSocial||c.nomeFantasia||c.nome,
            count: analistas.filter(a=>a.clienteId===c.id).length,
          })),
          ...(analistas.some(a=>!a.clienteId) ? [{ id:"sem-cliente", label:"Sem cliente", count: analistas.filter(a=>!a.clienteId).length }] : []),
        ].map(tab => (
          <button key={tab.id} onClick={()=>setFiltroCliente(tab.id)}
            style={{
              padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
              border: filtroCliente===tab.id ? "2px solid var(--azul)" : "1px solid var(--border)",
              background: filtroCliente===tab.id ? "var(--azul)" : "var(--bg-card)",
              color: filtroCliente===tab.id ? "#fff" : "var(--texto)",
              transition:"all .15s",
            }}>
            {tab.label} <span style={{ opacity:.7, fontWeight:400 }}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Busca */}
      <div style={{ marginBottom: 20 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="🔍 Buscar por nome, e-mail, área ou tipo de demanda..."
          style={{ width: "100%", padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, boxSizing: "border-box" }}
        />
      </div>

      {loading && <div className="spinner" />}

      {/* Analistas por área — áreas dinâmicas conforme cliente selecionado */}
      {!loading && areasOrdenadas.length === 0 && (
        <div style={{ color:"var(--cinza-med)", fontSize:13, padding:"24px 0", textAlign:"center" }}>
          Nenhum analista encontrado. Clique em "+ Novo analista" para começar.
        </div>
      )}
      {!loading && areasOrdenadas.map((area, idx) => {
        const lista = porArea[area] || [];
        if (lista.length === 0) return null;
        const cor = corParaArea(area, idx);
        return (
          <div key={area} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 4, height: 20, background: cor, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: ".06em", color: cor }}>
                {area}
              </span>
              <span style={{ fontSize: 11, color: "var(--cinza-med)" }}>({lista.length})</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Telefone</th>
                    <th>Tipos de demanda atendidos</th>
                    {isGestor && <th style={{ width: 80 }}></th>}
                  </tr>
                </thead>
                  <tbody>
                    {lista.map(a => (
                      <tr key={a.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nome}</div>
                          {a.clienteNome && <div style={{ fontSize: 11, color: "var(--cinza-med)", marginTop: 2 }}>{a.clienteNome}</div>}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                            <span style={{ color: "var(--cinza-med)" }}>{a.email || "—"}</span>
                            {a.email && <CopiarBtn texto={a.email} />}
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span>{a.telefone || "—"}</span>
                            {a.telefone && <CopiarBtn texto={a.telefone} />}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {(a.tiposDemanda || "").split(";").map(t => t.trim()).filter(Boolean).map((t, i) => (
                              <span key={i} style={{ background: `${cor}18`, color: cor, border: `1px solid ${cor}33`,
                                borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 500 }}>
                                {t}
                              </span>
                            ))}
                          </div>
                          {a.obs && <div style={{ fontSize: 11, color: "var(--cinza-med)", marginTop: 3 }}>{a.obs}</div>}
                        </td>
                        {isGestor && (
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="btn btn-sm" onClick={() => abrirEditar(a)}>✏️</button>
                              <button className="btn btn-sm" style={{ color: "var(--vermelho)" }} onClick={() => excluir(a.id)}>🗑️</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
        );
      })}

      {/* Templates de Material */}
      <div style={{ marginTop: 32, borderTop: "2px solid var(--border)", paddingTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📧 Cadastro de Lista de Material</div>
            <div style={{ fontSize: 12, color: "var(--cinza-med)" }}>E-mails e assuntos padrão para envio de pedido de materiais</div>
          </div>
          {isGestor && !editTemplate && (
            <button className="btn btn-sm" onClick={() => { setFormTemplate(templates); setEditTemplate(true); }}>✏️ Editar</button>
          )}
        </div>

        {editTemplate ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Geral — e-mail", key: "geralEmail" },
              { label: "Geral — assunto", key: "geralAssunto" },
              { label: "Geral — observação", key: "geralObs" },
              { label: "Reforma — e-mail", key: "reformaEmail" },
              { label: "Reforma — assunto", key: "reformaAssunto" },
              { label: "Reforma — observação", key: "reformaObs" },
            ].map(({ label, key }) => (
              <div key={key} className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12 }}>{label}</label>
                <input value={formTemplate[key] || ""} onChange={e => setTpl(key, e.target.value)} style={{ fontSize: 13 }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={salvarTemplates}>Salvar</button>
              <button className="btn" onClick={() => setEditTemplate(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { titulo: "Todas as demandas (exceto Reforma)", email: templates.geralEmail, assunto: templates.geralAssunto, obs: templates.geralObs, cor: "#185FA5" },
              { titulo: "Reforma — Plano Diretor / Espaço Itaú", email: templates.reformaEmail, assunto: templates.reformaAssunto, obs: templates.reformaObs, cor: "#B83232" },
            ].map((t, i) => (
              <div key={i} style={{ background: "var(--cinza-lt)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: t.cor, marginBottom: 8 }}>{t.titulo}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ color: "var(--cinza-med)", minWidth: 60 }}>E-mail:</span>
                    <code style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 10px" }}>{t.email}</code>
                    <CopiarBtn texto={t.email} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ color: "var(--cinza-med)", minWidth: 60 }}>Assunto:</span>
                    <code style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 10px" }}>{t.assunto}</code>
                    <CopiarBtn texto={t.assunto} />
                  </div>
                  {t.obs && <div style={{ fontSize: 11, color: "var(--cinza-med)", fontStyle: "italic" }}>{t.obs}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal add/edit */}
      {modalOpen && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:"var(--bg-card)",borderRadius:14,width:"100%",maxWidth:540,maxHeight:"90vh",overflowY:"auto",padding:24 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
              <div style={{ fontWeight:700,fontSize:16 }}>{editando?"Editar analista":"Novo analista"}</div>
              <button onClick={() => setModalOpen(false)} style={{ background:"none",border:"none",fontSize:20,cursor:"pointer",color:"var(--cinza-med)" }}>×</button>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {/* 1. Cliente — primeiro campo */}
              <div className="form-group" style={{margin:0}}>
                <label>Cliente vinculado</label>
                <select value={form.clienteId} onChange={e=>selecionarClienteModal(e.target.value)}>
                  <option value="">Sem cliente específico</option>
                  {clientes.map(c=><option key={c.id} value={c.id}>{c.razaoSocial||c.nomeFantasia||c.nome}</option>)}
                </select>
              </div>
              {/* 2. Área — opções mudam conforme cliente */}
              <div className="form-group" style={{margin:0}}>
                <label className="required">Área</label>
                <select
                  value={criandoNovaArea ? "__nova__" : form.area}
                  onChange={e=>{
                    if (e.target.value === "__nova__") {
                      setCriandoNovaArea(true);
                      setNovaArea("");
                      set("area","");
                    } else {
                      setCriandoNovaArea(false);
                      setNovaArea("");
                      set("area", e.target.value);
                    }
                  }}
                >
                  <option value="">Selecione...</option>
                  {areasDoCliente.map(a=><option key={a} value={a}>{a}</option>)}
                  <option value="__nova__">+ Nova área...</option>
                </select>
                {criandoNovaArea && (
                  <input
                    value={novaArea}
                    onChange={e=>{ const v=e.target.value.toUpperCase(); setNovaArea(v); set("area",v); }}
                    placeholder="Digite o nome da nova área"
                    style={{ marginTop:6, fontSize:13 }}
                    autoFocus
                  />
                )}
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="required">Nome</label>
                <input value={form.nome} onChange={e=>set("nome",e.target.value.toUpperCase())} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label>E-mail</label>
                <input type="email" value={form.email} onChange={e=>set("email",e.target.value)} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label>Telefone</label>
                <input value={form.telefone} onChange={e=>set("telefone",e.target.value)} placeholder="11 99999-9999" />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label>Tipos de demanda atendidos</label>
                <input value={form.tiposDemanda} onChange={e=>set("tiposDemanda",e.target.value)}
                  placeholder="Ex: ENCERRAMENTO; PLANO DIRETOR (separe por ;)" />
                <div style={{fontSize:11,color:"var(--cinza-med)",marginTop:4}}>Separe múltiplos tipos com ponto e vírgula (;)</div>
              </div>
              <div className="form-group" style={{margin:0}}>
                <label>Observações</label>
                <input value={form.obs} onChange={e=>set("obs",e.target.value)} />
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:20,justifyContent:"flex-end"}}>
              <button className="btn" onClick={()=>setModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving?"Salvando...":"Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook para uso externo (Gerenciamento) — filtra analistas por tipo de demanda e cliente
export function useAnalistasPorTipo(tipoDemanda, clienteId) {
  const [analistas, setAnalistas] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "analistas_contatos"), snap => {
      setAnalistas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  return useMemo(() => {
    if (!tipoDemanda) return [];
    const palavras = tipoDemanda.toUpperCase().split(/[\s\/]+/).filter(p => p.length > 3);
    return analistas.filter(a => {
      // Filtro por cliente: inclui analistas sem cliente vinculado e do cliente selecionado
      if (clienteId && a.clienteId && a.clienteId !== clienteId) return false;
      const td = (a.tiposDemanda || "").toUpperCase();
      if (td.includes(tipoDemanda.toUpperCase())) return true;
      return palavras.some(p => td.includes(p));
    });
  }, [analistas, tipoDemanda, clienteId]);
}
