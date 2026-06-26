// src/pages/Fornecedores.js — cadastro completo de fornecedores
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { buscarCEP, formatarCNPJ, formatarTelefone } from "../utils/cep";
import { isCampo } from "../constants/departamentos";

function FornecedorModal({ forn, onClose, addToast }) {
  const [form, setForm] = useState({
    razaoSocial: forn?.razaoSocial||"", nomeFantasia: forn?.nomeFantasia||"",
    cnpj: forn?.cnpj||"", categoria: forn?.categoria||"",
    contato: forn?.contato||"", email: forn?.email||"",
    tel: forn?.tel||"", cep: forn?.cep||"",
    logradouro: forn?.logradouro||"", numero: forn?.numero||"",
    cidade: forn?.cidade||"", uf: forn?.uf||"",
    prazoEntrega: forn?.prazoEntrega||"", formaPagamento: forn?.formaPagamento||"",
    obs: forn?.obs||"", status: forn?.status||"ATIVO",
  });
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  async function handleCEP(v) {
    set("cep",v);
    if (v.replace(/\D/g,"").length===8) {
      setBuscandoCEP(true);
      const d = await buscarCEP(v);
      if (d) { set("logradouro",d.logradouro); set("cidade",d.cidade); set("uf",d.uf); }
      setBuscandoCEP(false);
    }
  }

  async function save() {
    if (!form.razaoSocial) { alert("Informe a razão social."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = { ...form, updatedAt: agora };
    try {
      if (forn?.id) { await updateDoc(doc(db,"fornecedores",forn.id),payload); addToast("Fornecedor atualizado!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"fornecedores"),payload); addToast("Fornecedor cadastrado!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  const CATEGORIAS = ["Materiais elétricos","Materiais hidráulicos","Acabamentos","Cabeamento estruturado","Climatização","Tintas e pintura","Ferramentas","EPI","Serviços especializados","Móveis e decoração","Outro"];

  return (
    <Modal title={forn?.id?"Editar fornecedor":"Novo fornecedor"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Dados da empresa</div>
        <div className="form-grid">
          <div className="form-group span-2"><label className="required">Razão social</label><input value={form.razaoSocial} onChange={e=>set("razaoSocial",e.target.value)}/></div>
          <div className="form-group"><label>Nome fantasia</label><input value={form.nomeFantasia} onChange={e=>set("nomeFantasia",e.target.value)}/></div>
          <div className="form-group"><label>CNPJ</label><input value={form.cnpj} onChange={e=>set("cnpj",formatarCNPJ(e.target.value))} placeholder="00.000.000/0000-00"/></div>
          <div className="form-group"><label>Categoria</label>
            <select value={form.categoria} onChange={e=>set("categoria",e.target.value)}>
              <option value="">Selecione...</option>
              {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {["ATIVO","INATIVO","BLOQUEADO"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Contato</div>
        <div className="form-grid">
          <div className="form-group"><label>Contato (nome)</label><input value={form.contato} onChange={e=>set("contato",e.target.value)}/></div>
          <div className="form-group"><label>Telefone</label><input value={form.tel} onChange={e=>set("tel",formatarTelefone(e.target.value))} placeholder="(11) 99999-9999"/></div>
          <div className="form-group span-2"><label>E-mail</label><input type="email" value={form.email} onChange={e=>set("email",e.target.value)}/></div>
        </div>

        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Endereço</div>
        <div className="form-grid">
          <div className="form-group">
            <label>CEP</label>
            <div style={{display:"flex",gap:6}}>
              <input value={form.cep} onChange={e=>handleCEP(e.target.value)} placeholder="00000-000" style={{flex:1}}/>
              {buscandoCEP&&<span style={{fontSize:11,alignSelf:"center",color:"#7A7A7A"}}>Buscando...</span>}
            </div>
          </div>
          <div className="form-group"><label>Número</label><input value={form.numero} onChange={e=>set("numero",e.target.value)}/></div>
          <div className="form-group span-2"><label>Logradouro</label><input value={form.logradouro} onChange={e=>set("logradouro",e.target.value)}/></div>
          <div className="form-group"><label>Cidade</label><input value={form.cidade} onChange={e=>set("cidade",e.target.value)}/></div>
          <div className="form-group"><label>UF</label><input value={form.uf} onChange={e=>set("uf",e.target.value)} maxLength={2}/></div>
        </div>

        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Condições comerciais</div>
        <div className="form-grid">
          <div className="form-group"><label>Prazo de entrega (dias)</label><input type="number" value={form.prazoEntrega} onChange={e=>set("prazoEntrega",e.target.value)} placeholder="Ex: 7"/></div>
          <div className="form-group"><label>Forma de pagamento preferencial</label>
            <select value={form.formaPagamento} onChange={e=>set("formaPagamento",e.target.value)}>
              <option value="">Selecione...</option>
              {["À vista","30 dias","30/60 dias","30/60/90 dias","Boleto","PIX","Cartão"].map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/></div>
      </div>
    </Modal>
  );
}

export default function Fornecedores() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [forns,   setForns]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [modal,   setModal]   = useState(null);
  const canEdit = !isCampo(userProfile);

  useEffect(()=>{
    return onSnapshot(collection(db,"fornecedores"), snap=>{
      setForns(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
  },[]);

  const filtered = forns.filter(f=>!search||
    f.razaoSocial?.toLowerCase().includes(search.toLowerCase())||
    f.nomeFantasia?.toLowerCase().includes(search.toLowerCase())||
    f.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = {ATIVO:"badge-green",INATIVO:"badge-gray",BLOQUEADO:"badge-red"};

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Fornecedores</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{forns.filter(f=>f.status==="ATIVO").length} ativos · {forns.length} total</div>
        </div>
        {canEdit&&<button className="btn btn-primary" onClick={()=>setModal({forn:null})}>+ Novo fornecedor</button>}
      </div>
      <div className="search-bar">🔍<input placeholder="Buscar por nome, CNPJ ou categoria..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {loading&&<div className="spinner"/>}
      {!loading&&filtered.length===0&&<div className="empty-state"><div className="empty-icon">🏢</div><p>Nenhum fornecedor cadastrado</p></div>}
      {!loading&&filtered.length>0&&(
        <div className="table-wrap">
          <table>
            <thead><tr><th>Razão social</th><th>Categoria</th><th>Contato</th><th>Telefone</th><th>Prazo entrega</th><th>Pagamento</th><th>Status</th>{canEdit&&<th></th>}</tr></thead>
            <tbody>
              {filtered.map(f=>(
                <tr key={f.id}>
                  <td><div style={{fontWeight:600}}>{f.razaoSocial}</div><div style={{fontSize:11,color:"#7A7A7A"}}>{f.nomeFantasia||f.cnpj}</div></td>
                  <td><span className="badge badge-gray" style={{fontSize:10}}>{f.categoria||"–"}</span></td>
                  <td style={{fontSize:12}}>{f.contato||"–"}</td>
                  <td style={{fontSize:12}}>{f.tel||"–"}</td>
                  <td style={{fontSize:12}}>{f.prazoEntrega?`${f.prazoEntrega} dias`:"–"}</td>
                  <td style={{fontSize:12}}>{f.formaPagamento||"–"}</td>
                  <td><span className={`badge ${statusBadge[f.status]||"badge-gray"}`}>{f.status}</span></td>
                  {canEdit&&<td><button className="btn btn-sm btn-icon" onClick={()=>setModal({forn:f})}>✏️</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal&&<FornecedorModal forn={modal.forn} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
