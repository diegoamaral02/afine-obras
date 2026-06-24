import { buscarCEP } from "../utils/cep";
// src/pages/Obras.js — completo com endereço, busca CEP, fotos, medições, subcontratados
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import { isCampo } from "../constants/departamentos";
import FiltroAvancado, { dentroPeriodo } from "../components/FiltroAvancado";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import OSDigital from "../components/OSDigital";
import { useToast } from "../hooks/useToast";
import { Ocorrencias } from "./Equipe";
import Medicao from "./Medicao";
import Diario from "./Diario";

const TIPOS_OBRA = ["Reforma geral","Layout","Adequação","Retrofit","Manutenção preventiva","Manutenção corretiva","Instalação","Ampliação","Outro"];
const MIN_FOTOS_OBRA = 15;
// Mesmo checklist usado em Manutenção, para manter a mesma restrição de conclusão
const CHECKLIST_ITENS = [
  "Elétrica — tomadas e interruptores","Elétrica — quadro de distribuição","Elétrica — iluminação",
  "Hidráulica — torneiras e metais","Hidráulica — vasos e louças","Hidráulica — tubulação visível",
  "Ar-condicionado — filtros limpos","Ar-condicionado — funcionamento","Cabeamento — pontos de rede",
  "Cabeamento — rack e patch panel","Pintura — paredes e teto","Piso — estado geral",
  "Forro — estado geral","Portas e fechaduras","Controle de acesso","CFTV — câmeras",
  "Sinalização de emergência","Extintores — validade","Limpeza geral",
];



function ObraModal({ obra, funcionarios, clientes, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const isCampoUser = isCampo(userProfile);
  const nomeUser = userProfile?.nome || currentUser?.email || "–";
  const [aba, setAba] = useState(isCampoUser ? "materiais" : "dados");
  const [form, setForm] = useState({
    nome: obra?.nome||"", tipo: obra?.tipo||"", cliente: obra?.cliente||"",
    clienteId: obra?.clienteId||"",
    agenciaId: obra?.agenciaId||"", agenciaNome: obra?.agenciaNome||"",
    gerenciadora: obra?.gerenciadora||"",
    responsavelId: obra?.responsavelId||"", responsavelNome: obra?.responsavelNome||obra?.responsavel||"",
    contrato: obra?.contrato||"", area: obra?.area||"",
    equipeIds: obra?.equipeIds||[],
    // Endereço
    cep: obra?.cep||"", logradouro: obra?.logradouro||"", numero: obra?.numero||"",
    bairro: obra?.bairro||"", cidade: obra?.cidade||"", uf: obra?.uf||"",
    // Datas
    inicio: obra?.inicio||"", termino: obra?.termino||"",
    dataVistoria: obra?.dataVistoria||"", conclusaoReal: obra?.conclusaoReal||"",
    // Status
    status: obra?.status||"EM ANDAMENTO", progresso: obra?.progresso||0,
    // Financeiro
    orcamentoEnviado: obra?.orcamentoEnviado||"NÃO",
    valorOrcamento: obra?.valorOrcamento||"",
    relatorioEnviado: obra?.relatorioEnviado||"NÃO",
    // Extra
    subcontratados: obra?.subcontratados||"",
    obs: obra?.obs||"",
    // Execução (mesmas restrições de Manutenção)
    materiais: obra?.materiais||[],
    semMaterial: obra?.semMaterial||false,
    motivoSemMaterial: obra?.motivoSemMaterial||"",
  });
  const [fotos, setFotos] = useState(obra?.fotos||[]);
  const [checklist, setChecklist] = useState(obra?.checklist||{});
  const [osDigital, setOsDigital] = useState(obra?.osDigital||null);
  const [showOS, setShowOS] = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matNome, setMatNome] = useState("");
  const [matQtd,  setMatQtd]  = useState("");
  const [matUn,   setMatUn]   = useState("un");

  function toggleCheck(item) { setChecklist(p=>({...p,[item]:!p[item]})); }
  function adicionarMaterial() {
    if(!matNome.trim()||!matQtd){alert("Informe nome e quantidade.");return;}
    setForm(p=>({...p,materiais:[...p.materiais,{nome:matNome,qtd:Number(matQtd),un:matUn}]}));
    setMatNome("");setMatQtd("");
  }

  // ── Controle de estoque: o que foi comprado/recebido para esta obra ────────
  // Busca todas as compras vinculadas a esta obra que já passaram pela
  // conferência de recebimento ("RECEBIDO" em diante) com resultado "conforme"
  // — ou seja, material que realmente entrou e foi confirmado, não apenas
  // solicitado. Isso fica disponível pra usar na execução (aba Materiais).
  const [comprasObra, setComprasObra] = useState([]);
  const [transferenciasObra, setTransferenciasObra] = useState([]);
  useEffect(() => {
    if (!obra?.id) return;
    // BUG CORRIGIDO: a consulta combinava 2 filtros (demandaTipo + demandaId).
    // Para evitar qualquer dependência de índice composto no Firestore (mesmo
    // tipo de bug já visto no Calendário), busca-se só por demandaTipo=="obra"
    // (filtro único) e filtra o demandaId no próprio app.
    return onSnapshot(
      query(collection(db,"compras"), where("demandaTipo","==","obra")),
      snap => setComprasObra(snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.demandaId===obra.id)),
      err => console.error("Erro ao buscar compras da obra:", err)
    );
  }, [obra?.id]);
  useEffect(() => {
    if (!obra?.id) return;
    return onSnapshot(collection(db,"transferencias_material"), snap => {
      const todas = snap.docs.map(d=>({id:d.id,...d.data()}));
      setTransferenciasObra(todas.filter(t=>t.obraOrigemId===obra.id||t.obraDestinoId===obra.id));
    }, err => console.error("Erro ao buscar transferências:", err));
  }, [obra?.id]);

  // Total comprado e recebido (conferido) por material, agregando todas as compras
  // + transferências recebidas de outras obras, menos transferências enviadas.
  const materiaisComprados = useMemo(() => {
    const mapa = {};
    comprasObra
      .filter(c => ["RECEBIDO","AGUARD. NF","NF VINCULADA"].includes(c.status) && (c.tipoReceb==="conforme"||!c.tipoReceb))
      .forEach(c => (c.itens||[]).forEach(it => {
        const key = `${it.nome.trim().toLowerCase()}|${it.un}`;
        if (!mapa[key]) mapa[key] = { nome: it.nome, un: it.un, comprado: 0 };
        mapa[key].comprado += Number(it.qtd)||0;
      }));
    transferenciasObra.forEach(t => {
      const key = `${t.materialNome.trim().toLowerCase()}|${t.un}`;
      if (!mapa[key]) mapa[key] = { nome: t.materialNome, un: t.un, comprado: 0 };
      if (t.obraDestinoId===obra.id) mapa[key].comprado += Number(t.qtd)||0;   // recebido de outra obra
      if (t.obraOrigemId===obra.id)  mapa[key].comprado -= Number(t.qtd)||0;   // enviado para outra obra
    });
    return mapa;
  }, [comprasObra, transferenciasObra, obra?.id]);

  // Total já utilizado por material, agregando o que já foi lançado nesta obra
  const materiaisUtilizados = useMemo(() => {
    const mapa = {};
    form.materiais.forEach(m => {
      const key = `${m.nome.trim().toLowerCase()}|${m.un}`;
      mapa[key] = (mapa[key]||0) + (Number(m.qtd)||0);
    });
    return mapa;
  }, [form.materiais]);

  const [usoQtd, setUsoQtd] = useState({}); // quantidade a usar agora, por material comprado

  function usarMaterialComprado(key, item) {
    const qtd = Number(usoQtd[key]);
    if (!qtd || qtd<=0) { alert("Informe a quantidade utilizada."); return; }
    const saldo = item.comprado - (materiaisUtilizados[key]||0);
    if (qtd > saldo) { alert(`Saldo disponível é de apenas ${saldo} ${item.un}.`); return; }
    setForm(p=>({...p,materiais:[...p.materiais,{nome:item.nome,qtd,un:item.un,origemCompra:true}]}));
    setUsoQtd(p=>({...p,[key]:""}));
  }

  function set(f,v) { setForm(p=>({...p,[f]:v})); }
  function handleFunc(field, idField, e) {
    const id=e.target.value;
    const f=(funcionarios||[]).find(x=>x.id===id||x.uid===id);
    set(field,f?.nome||""); set(idField,id);
  }

  async function handleCEP(cep) {
    set("cep",cep);
    if (cep.replace(/\D/g,"").length===8) {
      setBuscandoCEP(true);
      const d = await buscarCEP(cep);
      if (d) { set("logradouro",d.logradouro||""); set("bairro",d.bairro||""); set("cidade",d.cidade||""); set("uf",d.uf||""); }
      setBuscandoCEP(false);
    }
  }

  function abrirNavegacao() {
    const end = encodeURIComponent(`${form.logradouro}, ${form.numero}, ${form.cidade}, ${form.uf}`);
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) window.open(`maps://maps.apple.com/?q=${end}`);
    else window.open(`https://www.google.com/maps/search/?api=1&query=${end}`,"_blank");
  }

  const fotosOk = fotos.length>=MIN_FOTOS_OBRA;
  const matOk   = form.materiais.length>0 || (form.semMaterial && form.motivoSemMaterial?.trim());
  const osOk    = !!osDigital;
  const endOk   = form.logradouro&&form.numero&&form.cep;
  const podeConcluir = fotosOk&&matOk&&osOk&&endOk;

  async function save() {
    if (!form.nome||!form.cliente) { alert("Nome e cliente são obrigatórios."); return; }
    if (form.status==="CONCLUÍDA"&&!podeConcluir) {
      const msgs=[];
      if(!fotosOk) msgs.push(`• ${MIN_FOTOS_OBRA} fotos (você tem ${fotos.length})`);
      if(!matOk)   msgs.push("• Materiais utilizados (ou justificar ausência)");
      if(!osOk)    msgs.push("• OS digital assinada");
      if(!endOk)   msgs.push("• Endereço completo");
      alert("Para concluir:\n"+msgs.join("\n"));
      return;
    }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = { ...form, progresso: Number(form.progresso)||0, fotos, checklist, osDigital: osDigital||null, updatedAt: agora };
    try {
      if (obra?.id) { await updateDoc(doc(db,"obras",obra.id),payload); addToast("Obra atualizada!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"obras"),payload); addToast("Obra criada!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  const ABAS = isCampoUser
    ? ["materiais","fotos_checklist","os_digital"]
    : ["dados","endereço","financeiro","materiais","fotos_checklist","os_digital"];
  const LABELS = { dados:"Dados", "endereço":"Endereço", financeiro:"Financeiro", materiais:"Materiais", fotos_checklist:"Fotos & Checklist", os_digital:"OS Digital" };

  return (
    <Modal title={obra?.id?"Editar obra":"Nova obra"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>

      <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
        {ABAS.map((a,i)=>(
          <button key={a} onClick={()=>setAba(a)} className="btn btn-sm"
            style={{background:aba===a?"var(--afine-yellow)":"",borderColor:aba===a?"var(--afine-yellow)":"",fontWeight:aba===a?700:400,color:aba===a?"var(--afine-black)":""}}>
            {LABELS[a]}
          </button>
        ))}
      </div>

      {aba==="dados" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-grid">
            <div className="form-group span-2"><label className="required">Nome da obra</label><input value={form.nome} onChange={e=>set("nome",e.target.value)} placeholder="AG-0500 · São Paulo Centro"/></div>
            <div className="form-group">
              <label className="required">Cliente</label>
              <select value={form.clienteId} onChange={e=>{
                const id=e.target.value;
                const c=(clientes||[]).find(x=>x.id===id);
                set("clienteId",id);
                set("cliente",c?.razaoSocial||"");
                set("agenciaId",""); set("agenciaNome","");
              }}>
                <option value="">Selecione o cliente...</option>
                {(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
              </select>
              {!form.clienteId && (
                <input value={form.cliente} onChange={e=>set("cliente",e.target.value)} placeholder="Ou digite o nome (cliente não cadastrado)" style={{marginTop:6}}/>
              )}
            </div>
            {/* Agência / Loja / Filial — só aparece se o cliente selecionado tiver agências cadastradas */}
            {(() => {
              const clienteSel = (clientes||[]).find(c=>c.id===form.clienteId);
              const agencias = clienteSel?.agencias||[];
              if (agencias.length===0) return null;
              return (
                <div className="form-group">
                  <label>🏢 Agência / Loja / Filial</label>
                  <select value={form.agenciaId} onChange={e=>{
                    const id=e.target.value;
                    const a=agencias.find(x=>x.id===id);
                    set("agenciaId",id);
                    set("agenciaNome",a?.nome||"");
                    // Auto-preenche o nome da obra: "AG-{numero} · {Cidade}"
                    if (a) {
                      const num = a.agenciaFilial ? `AG-${a.agenciaFilial}` : a.nome;
                      const sufixo = a.cidade ? ` · ${a.cidade}` : "";
                      set("nome", `${num}${sufixo}`);
                      // Auto-preenche o endereço a partir da agência (ANEXO3)
                      set("cep", a.cep||""); set("logradouro", a.endereco||""); set("numero", a.numero||"");
                      set("bairro", a.bairro||""); set("cidade", a.cidade||""); set("uf", a.uf||"");
                    }
                  }}>
                    <option value="">Selecione...</option>
                    {agencias.map(a=><option key={a.id} value={a.id}>{a.nome}{a.cidade?` — ${a.cidade}`:""}</option>)}
                  </select>
                  {form.agenciaId&&(()=>{
                    const a=agencias.find(x=>x.id===form.agenciaId);
                    return a?.endereco ? (
                      <button type="button" onClick={()=>{
                        const enc=encodeURIComponent(`${a.endereco}, ${a.numero||""} ${a.cidade||""} ${a.uf||""}`);
                        window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
                      }} style={{fontSize:11,color:"#185FA5",background:"none",border:"none",cursor:"pointer",padding:0,marginTop:4}}>
                        🗺️ {a.endereco}{a.numero?`, ${a.numero}`:""} — abrir navegação
                      </button>
                    ) : null;
                  })()}
                </div>
              );
            })()}
            <div className="form-group"><label className="required">Tipo de obra</label>
              <select value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
                <option value="">Selecione...</option>
                {TIPOS_OBRA.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Gerenciadora</label><input value={form.gerenciadora} onChange={e=>set("gerenciadora",e.target.value)}/></div>
            <div className="form-group">
              <label>👤 Responsável técnico (Gestor)</label>
              <select value={form.responsavelId} onChange={e=>handleFunc("responsavelNome","responsavelId",e)}
                style={{background:form.responsavelNome?"rgba(24,95,165,.06)":""}}>
                <option value="">Selecione o gestor responsável...</option>
                {(funcionarios||[])
                  .filter(f=>f.adm===true || ["gestao","adm"].includes(f.departamento) || f.perfil==="gestor")
                  .map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              {form.responsavelNome&&<span style={{fontSize:11,color:"#185FA5",fontWeight:600}}>✓ {form.responsavelNome}</span>}
            </div>
            <div className="form-group"><label>Contrato Nº</label><input value={form.contrato} onChange={e=>set("contrato",e.target.value)}/></div>
            <div className="form-group"><label>Área (m²)</label><input type="number" value={form.area} onChange={e=>set("area",e.target.value)}/></div>
          </div>
          <div className="form-grid">
            <div className="form-group"><label>Início</label><input type="date" value={form.inicio} onChange={e=>set("inicio",e.target.value)}/></div>
            <div className="form-group"><label>Término previsto</label><input type="date" value={form.termino} onChange={e=>set("termino",e.target.value)}/></div>
            <div className="form-group"><label>Data de vistoria</label><input type="date" value={form.dataVistoria} onChange={e=>set("dataVistoria",e.target.value)}/></div>
            <div className="form-group"><label>Conclusão real</label><input type="date" value={form.conclusaoReal} onChange={e=>set("conclusaoReal",e.target.value)}/></div>
            <div className="form-group"><label>Status</label>
              <select value={form.status} onChange={e=>set("status",e.target.value)}>
                {["EM ANDAMENTO","CONCLUÍDA","PARALISADA","PLANEJAMENTO","AGUARDANDO APROVAÇÃO"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Progresso (%)</label><input type="number" min="0" max="100" value={form.progresso} onChange={e=>set("progresso",e.target.value)}/></div>
          </div>
          <div className="form-group"><label>Subcontratados / empresas envolvidas</label><input value={form.subcontratados} onChange={e=>set("subcontratados",e.target.value)} placeholder="Ex: Elétrica Total, Sub. Souza Drywall..."/></div>

          {/* Equipe alocada na obra */}
          <div style={{background:"var(--afine-yellow-lt)",borderRadius:8,padding:12,border:"1px solid rgba(245,200,0,.3)"}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--afine-yellow-dk)",marginBottom:8}}>👷 Equipe alocada nesta obra</div>
            <div style={{fontSize:11,color:"#8A6000",marginBottom:10}}>
              Selecione os colaboradores responsáveis por esta obra. Eles aparecerão vinculados a ela na aba Equipe.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:160,overflowY:"auto",background:"#fff",borderRadius:6,padding:8}}>
              {(funcionarios||[]).length===0&&<span style={{fontSize:12,color:"#7A7A7A"}}>Nenhum funcionário cadastrado</span>}
              {(funcionarios||[]).map(f=>{
                const checked=form.equipeIds.includes(f.id);
                return (
                  <label key={f.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,background:checked?"var(--afine-yellow-lt)":"transparent"}}>
                    <input type="checkbox" checked={checked} onChange={()=>{
                      setForm(p=>({...p,equipeIds:checked?p.equipeIds.filter(id=>id!==f.id):[...p.equipeIds,f.id]}));
                    }} style={{width:15,height:15}}/>
                    <span style={{flex:1}}>{f.nome}</span>
                    <span style={{fontSize:11,color:"#7A7A7A"}}>{f.funcao||f.departamento}</span>
                  </label>
                );
              })}
            </div>
            {form.equipeIds.length>0&&<div style={{marginTop:6,fontSize:11,color:"var(--afine-yellow-dk)",fontWeight:600}}>✓ {form.equipeIds.length} colaborador(es) alocado(s)</div>}
          </div>

          <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={3}/></div>
        </div>
      )}

      {aba==="endereço" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="alert alert-info" style={{fontSize:12}}>Digite o CEP para preencher o endereço automaticamente.</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="required">CEP</label>
              <div style={{display:"flex",gap:6}}>
                <input value={form.cep} onChange={e=>handleCEP(e.target.value)} placeholder="00000-000" maxLength={9} style={{flex:1}}/>
                {buscandoCEP && <span style={{fontSize:12,color:"#7A7A7A",alignSelf:"center"}}>Buscando...</span>}
              </div>
            </div>
            <div className="form-group"><label className="required">Número</label><input value={form.numero} onChange={e=>set("numero",e.target.value)} placeholder="123"/></div>
            <div className="form-group span-2"><label className="required">Logradouro</label><input value={form.logradouro} onChange={e=>set("logradouro",e.target.value)}/></div>
            <div className="form-group"><label>Bairro</label><input value={form.bairro} onChange={e=>set("bairro",e.target.value)}/></div>
            <div className="form-group"><label>Cidade</label><input value={form.cidade} onChange={e=>set("cidade",e.target.value)}/></div>
            <div className="form-group"><label>UF</label><input value={form.uf} onChange={e=>set("uf",e.target.value)} maxLength={2}/></div>
          </div>
          {form.logradouro && form.numero && (
            <div style={{background:"var(--afine-yellow-lt)",borderRadius:8,padding:14,border:"1px solid rgba(245,200,0,.3)"}}>
              <div style={{fontSize:13,marginBottom:10}}>📍 {form.logradouro}, {form.numero} — {form.bairro}, {form.cidade}/{form.uf}</div>
              <button className="btn btn-primary" onClick={abrirNavegacao}>🗺️ Abrir no mapa / Navegar</button>
            </div>
          )}
        </div>
      )}

      {aba==="financeiro" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-grid">
            <div className="form-group"><label>Orçamento enviado?</label>
              <select value={form.orcamentoEnviado} onChange={e=>set("orcamentoEnviado",e.target.value)}>
                {["NÃO","SIM","PENDENTE"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Valor do orçamento (R$)</label><input type="number" value={form.valorOrcamento} onChange={e=>set("valorOrcamento",e.target.value)} placeholder="0,00"/></div>
            <div className="form-group"><label>Relatório enviado?</label>
              <select value={form.relatorioEnviado} onChange={e=>set("relatorioEnviado",e.target.value)}>
                {["NÃO","SIM","PENDENTE"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {form.valorOrcamento && (
            <div style={{background:"var(--afine-yellow-lt)",borderRadius:8,padding:12,fontSize:13}}>
              💰 Valor do orçamento: <strong>R$ {Number(form.valorOrcamento).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong>
            </div>
          )}
        </div>
      )}

      {aba==="materiais" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {isCampoUser&&(
            <div style={{background:"#1A1A1A",borderRadius:8,padding:12,color:"#fff"}}>
              <div style={{fontWeight:600,fontSize:14,color:"#F5C800"}}>{obra?.nome}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginTop:2}}>{obra?.cliente}{obra?.agenciaNome&&` · ${obra.agenciaNome}`}</div>
              {obra?.logradouro&&<button onClick={abrirNavegacao} style={{background:"none",border:"none",color:"#F5C800",cursor:"pointer",fontSize:12,padding:0,marginTop:4}}>🗺️ {obra.logradouro}, {obra.numero}</button>}
            </div>
          )}
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Materiais utilizados <span style={{color:"var(--vermelho)"}}>*</span></div>

          {Object.keys(materiaisComprados).length>0 && (
            <div style={{background:"var(--cinza-lt)",border:"1px solid var(--border)",borderRadius:8,padding:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#4A4A4A",marginBottom:8}}>📦 Comprado e recebido para esta obra</div>
              {transferenciasObra.length>0 && (
                <div style={{fontSize:11,color:"#7A7A7A",marginBottom:8}}>
                  🔄 Inclui {transferenciasObra.filter(t=>t.obraDestinoId===obra.id).length>0?"materiais recebidos de outra obra":""}
                  {transferenciasObra.filter(t=>t.obraDestinoId===obra.id).length>0 && transferenciasObra.filter(t=>t.obraOrigemId===obra.id).length>0?" e ":""}
                  {transferenciasObra.filter(t=>t.obraOrigemId===obra.id).length>0?"materiais já transferidos para outra obra (já descontados)":""}.
                  Veja o detalhe em Suprimentos → Materiais.
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {Object.entries(materiaisComprados).map(([key,item])=>{
                  const utilizado = materiaisUtilizados[key]||0;
                  const saldo = item.comprado - utilizado;
                  return (
                    <div key={key} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:6,padding:"8px 10px",border:"1px solid var(--border)",flexWrap:"wrap"}}>
                      <div style={{flex:"2 1 140px",minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13}}>{item.nome}</div>
                        <div style={{fontSize:11,color:"#7A7A7A"}}>
                          Comprado: {item.comprado}{item.un} · Usado: {utilizado}{item.un} ·{" "}
                          <span style={{fontWeight:700,color:saldo>0?"var(--verde)":"var(--vermelho)"}}>Saldo: {saldo}{item.un}</span>
                        </div>
                      </div>
                      <input type="number" min="0" max={saldo} placeholder="Qtd. usar" value={usoQtd[key]||""}
                        onChange={e=>setUsoQtd(p=>({...p,[key]:e.target.value}))}
                        style={{width:90}} disabled={saldo<=0}/>
                      <button className="btn btn-primary btn-sm" disabled={saldo<=0} onClick={()=>usarMaterialComprado(key,item)}>Usar</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Adicionar material avulso (não comprado pelo sistema)</div>
          <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
            <div className="form-group" style={{flex:2}}><label>Material</label><input value={matNome} onChange={e=>setMatNome(e.target.value)} placeholder="Ex: Saco de cimento"/></div>
            <div className="form-group" style={{width:80}}><label>Qtd.</label><input type="number" min="0" value={matQtd} onChange={e=>setMatQtd(e.target.value)}/></div>
            <div className="form-group" style={{width:80}}><label>Un.</label>
              <select value={matUn} onChange={e=>setMatUn(e.target.value)}>
                {["un","m","m²","kg","saco","cx","rolo","litro"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={adicionarMaterial} style={{marginBottom:1}}>+ Add</button>
          </div>

          <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:8,cursor:"pointer",
            background:form.semMaterial?"rgba(245,200,0,.08)":"var(--cinza-lt)",
            border:`1px solid ${form.semMaterial?"var(--afine-yellow-dk)":"var(--border)"}`,transition:".15s"}}>
            <input type="checkbox" checked={!!form.semMaterial} onChange={e=>set("semMaterial",e.target.checked)}
              style={{width:17,height:17,marginTop:1,flexShrink:0}}/>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:form.semMaterial?"var(--afine-yellow-dk)":"#4A4A4A"}}>
                Não foi necessário utilizar materiais
              </div>
              <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>
                Marque esta opção e justifique o motivo para liberar a conclusão sem materiais
              </div>
            </div>
          </label>

          {form.semMaterial && (
            <div className="form-group">
              <label className="required" style={{color:"var(--afine-yellow-dk)"}}>
                Justificativa obrigatória — por que não houve uso de materiais?
              </label>
              <textarea
                value={form.motivoSemMaterial}
                onChange={e=>set("motivoSemMaterial",e.target.value)}
                rows={3}
                placeholder="Ex: Mão de obra apenas / Material já estava no canteiro / Serviço de limpeza..."
                style={{borderColor:!form.motivoSemMaterial?.trim()?"var(--afine-yellow-dk)":"var(--verde)"}}
              />
              {form.motivoSemMaterial?.trim() && (
                <span style={{fontSize:11,color:"var(--verde)",fontWeight:600}}>✓ Justificativa registrada</span>
              )}
            </div>
          )}

          {!form.semMaterial && form.materiais.length===0&&<div className="alert alert-warning" style={{fontSize:12}}>Adicione pelo menos 1 material ou marque "Não foi necessário utilizar materiais".</div>}
          {form.materiais.length>0&&(
            <div className="table-wrap"><table><thead><tr><th>Material</th><th>Qtd.</th><th>Un.</th><th>Origem</th><th></th></tr></thead>
              <tbody>{form.materiais.map((m,i)=>(
                <tr key={i}><td style={{fontWeight:500}}>{m.nome}</td><td>{m.qtd}</td><td>{m.un}</td>
                  <td>{m.origemCompra?<span className="badge badge-green" style={{fontSize:9}}>📦 Comprado</span>:<span style={{fontSize:11,color:"#7A7A7A"}}>Avulso</span>}</td>
                  <td><button className="btn btn-sm" style={{color:"var(--vermelho)"}} onClick={()=>setForm(p=>({...p,materiais:p.materiais.filter((_,j)=>j!==i)}))}>✕</button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}

      {aba==="fotos_checklist" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <PhotoUploader fotos={fotos} onChange={setFotos} minFotos={MIN_FOTOS_OBRA}/>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>
            Checklist de vistoria ({Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITENS.length})
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:240,overflowY:"auto"}}>
            {CHECKLIST_ITENS.map(item=>(
              <label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer",padding:"5px 8px",borderRadius:5,
                background:checklist[item]?"var(--verde-lt)":"var(--cinza-lt)",
                border:`1px solid ${checklist[item]?"rgba(45,106,31,.2)":"var(--border)"}`,transition:".15s"}}>
                <input type="checkbox" checked={!!checklist[item]} onChange={()=>toggleCheck(item)} style={{width:15,height:15}}/>
                <span style={{color:checklist[item]?"var(--verde)":"#4A4A4A"}}>{item}</span>
                {checklist[item]&&<span style={{marginLeft:"auto",fontSize:14}}>✓</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {aba==="os_digital" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11}}>
            <div style={{textAlign:"center",background:fotosOk?"var(--verde-lt)":"var(--vermelho-lt)",borderRadius:8,padding:8}}>
              <div style={{fontSize:18,marginBottom:2}}>{fotosOk?"✅":"📷"}</div>
              <div style={{fontWeight:600,color:fotosOk?"var(--verde)":"var(--vermelho)"}}>{fotos.length}/{MIN_FOTOS_OBRA} fotos</div>
            </div>
            <div style={{textAlign:"center",background:matOk?"var(--verde-lt)":"var(--vermelho-lt)",borderRadius:8,padding:8}}>
              <div style={{fontSize:18,marginBottom:2}}>{matOk?"✅":"📦"}</div>
              <div style={{fontWeight:600,color:matOk?"var(--verde)":"var(--vermelho)"}}>{form.materiais.length} mater.</div>
            </div>
            <div style={{textAlign:"center",background:osOk?"var(--verde-lt)":"var(--cinza-lt)",borderRadius:8,padding:8}}>
              <div style={{fontSize:18,marginBottom:2}}>{osOk?"✅":"✍️"}</div>
              <div style={{fontWeight:600,color:osOk?"var(--verde)":"#7A7A7A"}}>OS {osOk?"assinada":"pendente"}</div>
            </div>
          </div>

          {!osDigital?(
            <button className="btn btn-primary" onClick={()=>setShowOS(true)} style={{padding:"14px",fontSize:14}}>✍️ Assinar OS digital</button>
          ):(
            <div style={{background:"var(--verde-lt)",border:"1px solid rgba(45,106,31,.3)",borderRadius:8,padding:12,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:4}}>✅</div>
              <div style={{fontWeight:600,color:"var(--verde)"}}>OS assinada!</div>
              <button className="btn btn-sm" onClick={()=>setOsDigital(null)} style={{marginTop:8,fontSize:11}}>Refazer assinatura</button>
            </div>
          )}

          {showOS&&(
            <Modal title="Ordem de Serviço Digital" onClose={()=>setShowOS(false)}>
              <OSDigital
                manutencao={false}
                descExtra={form.obs}
                funcionario={{ nome: nomeUser, funcao: userProfile?.departamento||userProfile?.perfil||"" }}
                onSalvar={(os)=>{setOsDigital(os);setShowOS(false);}}
                onFechar={()=>setShowOS(false)}
              />
            </Modal>
          )}

          {podeConcluir&&(
            <button className="btn btn-primary" style={{background:"var(--verde)",borderColor:"var(--verde)",padding:14,fontSize:14,marginTop:4}}
              onClick={()=>{set("status","CONCLUÍDA");setTimeout(save,100);}}>
              🏁 Concluir obra
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Obras({ onObraSelect }) {
  const { userProfile, currentUser } = useAuth();
  const souCampo = isCampo(userProfile);
  const { toasts, addToast } = useToast();
  const [obras,   setObras]   = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filtros, setFiltros] = useState({ periodo:{de:"",ate:""}, clienteId:"", responsavelId:"", status:[] });
  const [modal,   setModal]   = useState(null);
  const [obraAberta, setObraAberta] = useState(null);
  const [abaDrawer, setAbaDrawer]   = useState("ocorrencias");
  const isGestor = userProfile?.perfil==="gestor";

  useEffect(() => {
    return onSnapshot(collection(db,"obras"), snap => {
      setObras(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
  },[]);

  useEffect(() => {
    return onSnapshot(collection(db,"usuarios"), snap => {
      setFuncionarios(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="ATIVO"||!f.status));
    });
  },[]);

  useEffect(() => {
    return onSnapshot(collection(db,"clientes"), snap => {
      setClientes(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
  },[]);

  // Campo só vê as obras em que está alocado (via equipeIds[])
  const obrasVisiveis = souCampo
    ? obras.filter(o => (o.equipeIds||[]).includes(currentUser?.uid))
    : obras;

  const filtered = obrasVisiveis.filter(o=>{
    const q=search.toLowerCase();
    const mQ=!q||o.nome?.toLowerCase().includes(q)||o.cliente?.toLowerCase().includes(q)||o.contrato?.toLowerCase().includes(q);
    const mPeriodo = dentroPeriodo(o.inicio, filtros.periodo);
    const mCliente = !filtros.clienteId || o.clienteId===filtros.clienteId;
    const mResp = !filtros.responsavelId || o.responsavelId===filtros.responsavelId;
    const mStatus = filtros.status.length===0 || filtros.status.includes(o.status);
    return mQ && mPeriodo && mCliente && mResp && mStatus;
  });

  const statusList=["EM ANDAMENTO","CONCLUÍDA","PARALISADA","PLANEJAMENTO","AGUARDANDO APROVAÇÃO"];
  const gestoresList = funcionarios.filter(f=>f.adm===true||f.departamento==="gestao"||f.perfil==="gestor");

  const camposFiltro = [
    { tipo:"periodo", key:"periodo", label:"Período de início" },
    { tipo:"select", key:"clienteId", label:"Cliente", opcoes: clientes.map(c=>({value:c.id,label:c.nomeFantasia||c.razaoSocial})) },
    { tipo:"select", key:"responsavelId", label:"Responsável", opcoes: gestoresList.map(f=>({value:f.id,label:f.nome})) },
    { tipo:"multi", key:"status", label:"Status", largo:true, opcoes: statusList.map(s=>({value:s,label:s})) },
  ];

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Obras</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{obrasVisiveis.length} obra(s){souCampo?" em que você está alocado":""} · {obrasVisiveis.filter(o=>o.status==="EM ANDAMENTO").length} em andamento</div>
        </div>
        {isGestor && <button className="btn btn-primary" onClick={()=>setModal({obra:null})}>+ Nova obra</button>}
      </div>

      <FiltroAvancado campos={camposFiltro} valores={filtros} onChange={setFiltros}
        onLimpar={()=>setFiltros({ periodo:{de:"",ate:""}, clienteId:"", responsavelId:"", status:[] })}/>

      <div className="search-bar">🔍<input placeholder="Buscar por nome, cliente ou contrato..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {loading && <div className="spinner"/>}
      {!loading && filtered.length===0 && (
        <div className="empty-state">
          <div className="empty-icon">🏗️</div>
          <p>{souCampo?"Você não está alocado em nenhuma obra no momento":"Nenhuma obra encontrada"}</p>
        </div>
      )}
      {!loading && filtered.length>0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Obra</th><th>Tipo</th><th>Cliente</th><th>Responsável</th><th>Equipe</th><th>Endereço</th><th>Vistoria</th><th>Término</th><th>Orçamento</th><th>Relatório</th><th>Progresso</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(o=>{
                const temEndereco = o.logradouro&&o.numero;
                const equipeIds = o.equipeIds||[];
                const nomesEquipe = equipeIds.map(id=>funcionarios.find(f=>f.id===id)?.nome).filter(Boolean);
                return (
                <tr key={o.id}>
                  <td><div style={{fontWeight:600}}>{o.nome}</div><div style={{fontSize:11,color:"#7A7A7A"}}>{o.contrato}</div></td>
                  <td><span className="badge badge-gray" style={{fontSize:10}}>{o.tipo||"–"}</span></td>
                  <td style={{fontSize:12}}>{o.cliente}{o.agenciaNome&&<div style={{fontSize:10,color:"var(--afine-yellow-dk)",fontWeight:600}}>🏢 {o.agenciaNome}</div>}</td>
                  <td style={{fontSize:12}}>
                    {o.responsavelNome ? (
                      <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                        <span style={{width:20,height:20,borderRadius:"50%",background:"#185FA5",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {o.responsavelNome.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
                        </span>
                        {o.responsavelNome}
                      </span>
                    ) : <span style={{color:"#aaa"}}>–</span>}
                  </td>
                  <td style={{fontSize:11,maxWidth:160}}>
                    {nomesEquipe.length>0 ? (
                      <span title={nomesEquipe.join(", ")} style={{fontSize:11,background:"var(--afine-yellow-lt)",color:"var(--afine-yellow-dk)",padding:"2px 8px",borderRadius:10,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"inline-block",maxWidth:"100%"}}>
                        👷 {nomesEquipe.join(", ")}
                      </span>
                    ) : <span style={{color:"#aaa"}}>Sem equipe</span>}
                  </td>
                  <td style={{fontSize:11}}>
                    {temEndereco ? (
                      <button onClick={()=>{
                        const enc=encodeURIComponent(`${o.logradouro}, ${o.numero}, ${o.cidade}`);
                        window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
                      }} style={{background:"none",border:"none",color:"var(--afine-yellow-dk)",cursor:"pointer",fontSize:11,padding:0,textAlign:"left"}}>
                        🗺️ {o.logradouro}, {o.numero}
                      </button>
                    ):"–"}
                  </td>
                  <td style={{fontSize:12}}>{fmtDate(o.dataVistoria)}</td>
                  <td style={{fontSize:12}}>{fmtDate(o.conclusaoReal||o.termino)}</td>
                  <td><span className={`badge ${o.orcamentoEnviado==="SIM"?"badge-green":o.orcamentoEnviado==="PENDENTE"?"badge-amber":"badge-red"}`}>{o.orcamentoEnviado||"NÃO"}</span></td>
                  <td><span className={`badge ${o.relatorioEnviado==="SIM"?"badge-green":"badge-red"}`}>{o.relatorioEnviado||"NÃO"}</span></td>
                  <td style={{minWidth:90}}>
                    <div className="progress-bar" style={{marginBottom:3}}><div className={`progress-fill ${o.progresso>=100?"green":"blue"}`} style={{width:`${o.progresso||0}%`}}/></div>
                    <span style={{fontSize:11}}>{o.progresso||0}%</span>
                  </td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                  <td style={{display:"flex",gap:4}}>
                    <button className="btn btn-primary btn-sm" onClick={()=>setModal({obra:o})}>▶ Executar</button>
                    {isGestor && <button className="btn btn-sm btn-icon" onClick={()=>setModal({obra:o})}>✏️</button>}
                    <button className="btn btn-sm btn-icon" title="Ocorrências" onClick={()=>{setObraAberta(o);setAbaDrawer("ocorrencias");}} style={{fontSize:12}}>⚠️</button>
                    <button className="btn btn-sm btn-icon" title="Acompanhamento" onClick={()=>{setObraAberta(o);setAbaDrawer("acompanhamento");}} style={{fontSize:12}}>📐</button>
                    <button className="btn btn-sm btn-icon" title="Diário de Obra"  onClick={()=>{setObraAberta(o);setAbaDrawer("diario");}} style={{fontSize:12}}>📓</button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
      {modal && <ObraModal obra={modal.obra} funcionarios={funcionarios} clientes={clientes} onClose={()=>setModal(null)} addToast={addToast}/>}

      {/* Painel lateral de ocorrências por obra */}
      {obraAberta && (
        <div style={{
          position:"fixed", top:0, right:0, bottom:0, width:480, maxWidth:"95vw",
          background:"#fff", boxShadow:"-4px 0 30px rgba(0,0,0,.15)",
          zIndex:200, display:"flex", flexDirection:"column", overflowY:"auto"
        }}>
          {/* Header */}
          <div style={{background:"#1A1A1A", padding:"14px 18px", flexShrink:0}}>
            <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12}}>
              <div>
                <div style={{fontSize:15, fontWeight:700, color:"#F5C800"}}>{obraAberta.nome}</div>
                <div style={{fontSize:11, color:"rgba(255,255,255,.4)"}}>{obraAberta.cliente}</div>
              </div>
              <button onClick={()=>setObraAberta(null)}
                style={{background:"rgba(255,255,255,.1)", border:"none", borderRadius:8, color:"#fff", cursor:"pointer", fontSize:18, padding:"4px 10px"}}>
                ✕
              </button>
            </div>
            {/* Sub-abas do drawer */}
            <div style={{display:"flex", gap:4}}>
              {[
                {id:"ocorrencias",     icon:"⚠️", label:"Ocorrências"},
                {id:"acompanhamento",  icon:"📐", label:"Acompanhamento"},
                {id:"diario",          icon:"📓", label:"Diário de obra"},
              ].map(a=>(
                <button key={a.id} onClick={()=>setAbaDrawer(a.id)}
                  style={{flex:1, padding:"6px 4px", border:"none", cursor:"pointer", borderRadius:6,
                    background:abaDrawer===a.id?"rgba(245,200,0,.2)":"rgba(255,255,255,.06)",
                    color:abaDrawer===a.id?"#F5C800":"rgba(255,255,255,.5)",
                    fontSize:10, fontWeight:abaDrawer===a.id?700:400, transition:".15s"}}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
          {/* Conteúdo */}
          <div style={{padding:"16px", flex:1, overflowY:"auto"}}>
            {abaDrawer==="ocorrencias"    && <Ocorrencias obraAtual={obraAberta.id}/>}
            {abaDrawer==="acompanhamento" && <Medicao     obraAtual={obraAberta.id}/>}
            {abaDrawer==="diario"         && <Diario      obraAtual={obraAberta.id}/>}
          </div>
        </div>
      )}
      {obraAberta && <div onClick={()=>setObraAberta(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:199}}/>}
    </div>
  );
}
