// src/pages/Materiais.js — controle global de estoque + por demanda
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

// Modal de movimentação (entrada ou saída)
function MovimentacaoModal({ item, tipo, obras, manutencoes, onClose, addToast }) {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    quantidade: "",
    demandaTipo: "obra",
    demandaId: "",
    obs: "",
    data: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);
  function set(f, v) { setForm(p => ({...p, [f]: v})); }

  const demandas = form.demandaTipo === "obra" ? obras : manutencoes;

  async function save() {
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe uma quantidade válida."); return; }
    if (tipo === "saida" && Number(form.quantidade) > item.saldo) {
      alert(`Saldo insuficiente. Disponível: ${item.saldo} ${item.un}`); return;
    }
    setSaving(true);
    const mov = {
      materialId: item.id,
      materialNome: item.nome,
      tipo, // "entrada" | "saida"
      quantidade: Number(form.quantidade),
      demandaTipo: form.demandaTipo,
      demandaId: form.demandaId,
      demandaNome: demandas.find(d=>d.id===form.demandaId)?.nome || demandas.find(d=>d.id===form.demandaId)?.titulo || "",
      obs: form.obs,
      data: form.data,
      usuario: userProfile?.nome || "–",
      createdAt: new Date().toISOString(),
    };
    try {
      // Registra movimentação
      await addDoc(collection(db, "movimentacoes"), mov);
      // Atualiza saldo no item
      const novoSaldo = tipo === "entrada"
        ? item.saldo + Number(form.quantidade)
        : item.saldo - Number(form.quantidade);
      const totalEntradas = tipo === "entrada" ? item.totalEntradas + Number(form.quantidade) : item.totalEntradas;
      const totalSaidas   = tipo === "saida"   ? item.totalSaidas   + Number(form.quantidade) : item.totalSaidas;
      await updateDoc(doc(db, "materiais_estoque", item.id), { saldo: novoSaldo, totalEntradas, totalSaidas, updatedAt: new Date().toISOString() });
      addToast(tipo === "entrada" ? "Entrada registrada!" : "Saída registrada!");
      onClose();
    } catch(err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title={tipo==="entrada" ? "📥 Registrar entrada" : "📤 Registrar saída"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className={`btn ${tipo==="entrada"?"btn-primary":"btn-danger"}`} onClick={save} disabled={saving}>{saving?"Salvando...":"Confirmar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:tipo==="entrada"?"var(--verde-lt)":"var(--vermelho-lt)",borderRadius:8,padding:10,fontSize:13,fontWeight:500}}>
          {tipo==="entrada"?"📥 Entrada em estoque":"📤 Saída do estoque"} — <strong>{item.nome}</strong>
          <div style={{fontSize:12,fontWeight:400,marginTop:2}}>Saldo atual: <strong>{item.saldo} {item.un}</strong></div>
        </div>

        <div className="form-grid">
          <div className="form-group"><label className="required">Quantidade ({item.un})</label>
            <input type="number" min="1" value={form.quantidade} onChange={e=>set("quantidade",e.target.value)} placeholder="0"/>
          </div>
          <div className="form-group"><label>Data</label>
            <input type="date" value={form.data} onChange={e=>set("data",e.target.value)}/>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group"><label>Vincular a</label>
            <select value={form.demandaTipo} onChange={e=>{set("demandaTipo",e.target.value);set("demandaId","");}}>
              <option value="obra">Obra</option>
              <option value="manutencao">Manutenção</option>
              <option value="estoque">Estoque local (sem demanda)</option>
            </select>
          </div>
          {form.demandaTipo !== "estoque" && (
            <div className="form-group"><label>Qual {form.demandaTipo==="obra"?"obra":"manutenção"}?</label>
              <select value={form.demandaId} onChange={e=>set("demandaId",e.target.value)}>
                <option value="">Selecione...</option>
                {demandas.map(d=><option key={d.id} value={d.id}>{d.nome||d.titulo}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="form-group"><label>Observações</label>
          <input value={form.obs} onChange={e=>set("obs",e.target.value)} placeholder="Ex: NF 4521, Fornecedor Leroy..."/>
        </div>
      </div>
    </Modal>
  );
}

// Modal de cadastro de novo material
function NovoMaterialModal({ onClose, addToast }) {
  const [form, setForm] = useState({ nome:"", categoria:"", un:"un", estoqueMin:0, saldo:0 });
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  async function save() {
    if (!form.nome) { alert("Informe o nome do material."); return; }
    setSaving(true);
    try {
      await addDoc(collection(db,"materiais_estoque"), {
        ...form, estoqueMin:Number(form.estoqueMin)||0, saldo:Number(form.saldo)||0,
        totalEntradas:Number(form.saldo)||0, totalSaidas:0,
        createdAt: new Date().toISOString(),
      });
      addToast("Material cadastrado!");
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title="Cadastrar material" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="form-group"><label className="required">Nome do material</label><input value={form.nome} onChange={e=>set("nome",e.target.value)} placeholder="Ex: Cabo UTP Cat.6"/></div>
        <div className="form-grid">
          <div className="form-group"><label>Categoria</label>
            <select value={form.categoria} onChange={e=>set("categoria",e.target.value)}>
              {["","Elétrico","Hidráulico","Cabeamento","Acabamento","Pintura","Ferramentas","EPI","Outros"].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Unidade</label>
            <select value={form.un} onChange={e=>set("un",e.target.value)}>
              {["un","m","m²","kg","saco","cx","rolo","litro","par"].map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Saldo inicial</label><input type="number" min="0" value={form.saldo} onChange={e=>set("saldo",e.target.value)}/></div>
          <div className="form-group"><label>Estoque mínimo (alerta)</label><input type="number" min="0" value={form.estoqueMin} onChange={e=>set("estoqueMin",e.target.value)}/></div>
        </div>
      </div>
    </Modal>
  );
}

export default function MateriaisGlobal() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [materiais,  setMateriais]  = useState([]);
  const [movs,       setMovs]       = useState([]);
  const [obras,      setObras]      = useState([]);
  const [manut,      setManut]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filtroCateg,setFiltroCateg]= useState("todas");
  const [aba,        setAba]        = useState("estoque");
  const [modalMov,   setModalMov]   = useState(null); // {item, tipo}
  const [modalNovo,  setModalNovo]  = useState(false);

  const canEdit = userProfile?.perfil !== "campo";

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"materiais_estoque"), snap => {
      setMateriais(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db,"movimentacoes"), snap => {
      const data = snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setMovs(data);
    });
    const u3 = onSnapshot(collection(db,"obras"), snap => setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4 = onSnapshot(collection(db,"manutencoes"), snap => setManut(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{ u1(); u2(); u3(); u4(); };
  }, []);

  const categorias = ["todas", ...new Set(materiais.map(m=>m.categoria).filter(Boolean))];

  const filtered = materiais.filter(m => {
    const q = search.toLowerCase();
    const mQ = !q || m.nome?.toLowerCase().includes(q) || m.categoria?.toLowerCase().includes(q);
    const mC = filtroCateg==="todas" || m.categoria===filtroCateg;
    return mQ && mC;
  });

  // KPIs
  const abaixoMin = materiais.filter(m=>m.estoqueMin>0 && m.saldo<=m.estoqueMin).length;
  const zerados   = materiais.filter(m=>m.saldo<=0).length;
  const totalItens= materiais.length;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Materiais — Controle global</div>
          <div style={{fontSize:12,color:"var(--cinza-med)"}}>{totalItens} itens cadastrados</div>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={()=>setModalNovo(true)}>+ Cadastrar material</button>}
      </div>

      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="metric"><div className="metric-label">Itens em estoque</div><div className="metric-value blue">{totalItens}</div></div>
        <div className="metric"><div className="metric-label">Abaixo do mínimo</div><div className="metric-value amber">{abaixoMin}</div></div>
        <div className="metric"><div className="metric-label">Zerados</div><div className="metric-value red">{zerados}</div></div>
        <div className="metric"><div className="metric-label">Movimentações</div><div className="metric-value">{movs.length}</div></div>
      </div>

      {abaixoMin > 0 && (
        <div className="alert alert-warning" style={{marginBottom:14,fontSize:12}}>
          ⚠ <strong>{abaixoMin} item(ns)</strong> abaixo do estoque mínimo. Verifique a aba Estoque.
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${aba==="estoque"?"active":""}`} onClick={()=>setAba("estoque")}>Estoque</button>
        <button className={`tab ${aba==="movs"?"active":""}`} onClick={()=>setAba("movs")}>Movimentações</button>
        <button className={`tab ${aba==="porDemanda"?"active":""}`} onClick={()=>setAba("porDemanda")}>Por demanda</button>
      </div>

      {/* ABA ESTOQUE */}
      {aba==="estoque" && (
        <>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            {categorias.map(c=>(
              <button key={c} className={`chip ${filtroCateg===c?"active":""}`} onClick={()=>setFiltroCateg(c)}>
                {c==="todas"?"Todas":c}
              </button>
            ))}
          </div>
          <div className="search-bar">🔍<input placeholder="Buscar material..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {loading && <div className="spinner"/>}
          {!loading && filtered.length===0 && <div className="empty-state"><div className="empty-icon">📦</div><p>Nenhum material cadastrado</p></div>}
          {!loading && filtered.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Material</th><th>Categoria</th><th>Un.</th><th>Saldo</th><th>Mínimo</th><th>Total entradas</th><th>Total saídas</th><th>Status</th>{canEdit&&<th></th>}</tr></thead>
                <tbody>
                  {filtered.map(m=>{
                    const critico = m.estoqueMin>0 && m.saldo<=m.estoqueMin;
                    const zerado  = m.saldo<=0;
                    return (
                      <tr key={m.id}>
                        <td><strong>{m.nome}</strong></td>
                        <td style={{fontSize:12}}>{m.categoria||"–"}</td>
                        <td style={{fontSize:12}}>{m.un}</td>
                        <td style={{fontWeight:700,color:zerado?"var(--vermelho)":critico?"var(--laranja)":"var(--verde)",fontSize:14}}>{m.saldo}</td>
                        <td style={{fontSize:12,color:"var(--cinza-med)"}}>{m.estoqueMin||"–"}</td>
                        <td style={{fontSize:12}}>{m.totalEntradas||0}</td>
                        <td style={{fontSize:12}}>{m.totalSaidas||0}</td>
                        <td>
                          {zerado ? <span className="badge badge-red">Zerado</span>
                           : critico ? <span className="badge badge-amber">Crítico</span>
                           : <span className="badge badge-green">OK</span>}
                        </td>
                        {canEdit && (
                          <td style={{display:"flex",gap:4}}>
                            <button className="btn btn-sm" style={{background:"var(--verde-lt)",color:"var(--verde)",border:"none"}} onClick={()=>setModalMov({item:m,tipo:"entrada"})}>📥</button>
                            <button className="btn btn-sm" style={{background:"var(--vermelho-lt)",color:"var(--vermelho)",border:"none"}} onClick={()=>setModalMov({item:m,tipo:"saida"})}>📤</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ABA MOVIMENTAÇÕES */}
      {aba==="movs" && (
        <>
          <div style={{fontSize:12,color:"var(--cinza-med)",marginBottom:10}}>Histórico completo de entradas e saídas</div>
          {movs.length===0 && <div className="empty-state"><div className="empty-icon">📋</div><p>Nenhuma movimentação registrada</p></div>}
          {movs.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Tipo</th><th>Material</th><th>Qtd.</th><th>Demanda</th><th>Usuário</th><th>Obs.</th></tr></thead>
                <tbody>
                  {movs.map(m=>(
                    <tr key={m.id}>
                      <td style={{fontSize:12}}>{fmtDate(m.data)}</td>
                      <td>{m.tipo==="entrada"?<span className="badge badge-green">📥 Entrada</span>:<span className="badge badge-red">📤 Saída</span>}</td>
                      <td style={{fontWeight:500}}>{m.materialNome}</td>
                      <td style={{fontWeight:700,color:m.tipo==="entrada"?"var(--verde)":"var(--vermelho)"}}>{m.tipo==="entrada"?"+":"-"}{m.quantidade}</td>
                      <td style={{fontSize:12}}>{m.demandaNome||m.demandaTipo||"–"}</td>
                      <td style={{fontSize:12}}>{m.usuario}</td>
                      <td style={{fontSize:11,color:"var(--cinza-med)"}}>{m.obs||"–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ABA POR DEMANDA */}
      {aba==="porDemanda" && (
        <>
          <div style={{fontSize:12,color:"var(--cinza-med)",marginBottom:12}}>Consumo de materiais agrupado por obra ou manutenção</div>
          {/* Por obra */}
          {obras.map(o=>{
            const movsObra = movs.filter(m=>m.demandaId===o.id && m.tipo==="saida");
            if(movsObra.length===0) return null;
            const totalPorMat = movsObra.reduce((acc,m)=>{
              if(!acc[m.materialNome]) acc[m.materialNome]=0;
              acc[m.materialNome]+=m.quantidade;
              return acc;
            },{});
            return (
              <div key={o.id} style={{marginBottom:16}}>
                <div style={{fontWeight:600,fontSize:13,color:"var(--azul)",marginBottom:6,borderBottom:"2px solid var(--azul-claro)",paddingBottom:4}}>
                  🏗️ {o.nome}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {Object.entries(totalPorMat).map(([nome,qtd])=>(
                    <span key={nome} style={{background:"var(--cinza-lt)",padding:"3px 10px",borderRadius:20,fontSize:12}}>
                      {nome}: <strong>{qtd}</strong>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {/* Por manutenção */}
          {manut.map(m=>{
            const movsManut = movs.filter(mv=>mv.demandaId===m.id && mv.tipo==="saida");
            if(movsManut.length===0) return null;
            const totalPorMat = movsManut.reduce((acc,mv)=>{
              if(!acc[mv.materialNome]) acc[mv.materialNome]=0;
              acc[mv.materialNome]+=mv.quantidade;
              return acc;
            },{});
            return (
              <div key={m.id} style={{marginBottom:16}}>
                <div style={{fontWeight:600,fontSize:13,color:"var(--laranja)",marginBottom:6,borderBottom:"2px solid var(--laranja-lt)",paddingBottom:4}}>
                  🔧 {m.titulo}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {Object.entries(totalPorMat).map(([nome,qtd])=>(
                    <span key={nome} style={{background:"var(--cinza-lt)",padding:"3px 10px",borderRadius:20,fontSize:12}}>
                      {nome}: <strong>{qtd}</strong>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {movs.filter(m=>m.tipo==="saida").length===0 && (
            <div className="empty-state"><div className="empty-icon">📊</div><p>Nenhum consumo registrado ainda</p></div>
          )}
        </>
      )}

      {modalMov && <MovimentacaoModal item={modalMov.item} tipo={modalMov.tipo} obras={obras} manutencoes={manut} onClose={()=>setModalMov(null)} addToast={addToast}/>}
      {modalNovo && <NovoMaterialModal onClose={()=>setModalNovo(false)} addToast={addToast}/>}
    </div>
  );
}
