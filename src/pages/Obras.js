import { buscarCEP } from "../utils/cep";
// src/pages/Obras.js — completo com endereço, busca CEP, fotos, medições, subcontratados
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import { isCampo, isGestorOuAdm, isExterno } from "../constants/departamentos";
import { addComAuditoria, updateComAuditoria } from "../services/auditoria";
import { salvarComFallbackOffline } from "../utils/offlineQueue";
import { exportarObraParaPDF } from "../utils/exportPDF";
import { registrarExecutorOffline } from "../hooks/useFilaOffline";

// Registra como reenviar uma obra que ficou pendente na fila offline —
// fica fora do componente pra continuar disponível mesmo se a tela de Obras
// não estiver mais montada quando a internet voltar.
registrarExecutorOffline("obra:update", async ({ id, payload, uid, nome }) => {
  await updateComAuditoria("obras", id, payload, uid, nome);
});
registrarExecutorOffline("obra:create", async ({ payload, uid, nome }) => {
  await addComAuditoria("obras", payload, uid, nome);
});
import FiltroAvancado, { dentroPeriodo } from "../components/FiltroAvancado";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";
import { useIsMobile } from "../hooks/useIsMobile";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import OSDigital from "../components/OSDigital";
import AssinaturaDigital from "../components/AssinaturaDigital";
import CustosDemanda from "../components/CustosDemanda";
import { exportarTermoChavesParaPDF, exportarOSParaPDF } from "../utils/exportPDF";
import { useToast } from "../hooks/useToast";
import { Ocorrencias } from "./Equipe";
import Medicao from "./Medicao";
import Diario from "./Diario";

const TIPOS_OBRA = ["Reforma geral","Layout","Adequação","Retrofit","Manutenção preventiva","Manutenção corretiva","Instalação","Ampliação","Descaracterização/Devolução de imóvel","Outro"];
const TIPO_DESCARACTERIZACAO = "Descaracterização/Devolução de imóvel";

// Checklist de Descaracterização/Devolução de imóvel — cada item de Área
// Externa/Interna exige avaliação (N/A · Regular · Bom) + foto. Os itens de
// Coletas são perguntas Sim/Não com comentário (sem N/A, sem foto).
const CHECKLIST_DESCARACTERIZACAO = {
  "Área Externa": [
    "Fachada", "Estacionamento",
  ],
  "Área Interna": [
    "Auto Atendimento", "Salão Gerência", "Sanitário PNE", "Sanitário Masculino",
    "Sanitário Feminino", "Copa", "Salão Retaguarda", "Sala do Cofre",
    "Almoxarifado", "Sala de Equipamentos", "Sala do Ar Condicionado", "Escada",
    "Cobertura", "Área Ociosa (se houver)",
    "Sistema de Alarme Instalado (Central/Teclados/Sensores/Sirenes/Acionadores)",
    "Sistema de CFTV (Câmeras/Gravador/Monitor/Teclado/Mouse/Rack — fotos da caixa aberta, embalada e identificada)",
    "Demais Áreas",
  ],
};
const AVALIACOES_DESCARACT = [
  { v:"na",      label:"N/A",     icone:"—" },
  { v:"regular", label:"Regular", icone:"😐" },
  { v:"bom",     label:"Bom",     icone:"😊" },
];
// Coletas — perguntas sim/não com comentário (estrutura diferente: sem N/A, sem foto)
const PERGUNTAS_COLETAS = [
  "Foram coletados todos os BDNs pela Tecban?",
  "Foram coletados todos os itens pelo Transportes?",
  "O imóvel está 100% desocupado?",
];
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
    // Descaracterização/Devolução de imóvel — dados gerais do encerramento
    descaract: obra?.descaract || {
      numeroProcesso: "", coordenador: "", inicioDesocupacao: "", terminoDesocupacao: "",
    },
    // Termo de Entrega de Chaves — disponível para qualquer tipo de obra
    termoChaves: obra?.termoChaves || {
      temChaveDevolver: "", quantidadeChaves: "", nomeRecebeu: "", cpf: "", rg: "", assinatura: "", dataDocumento: "",
    },
  });
  const [fotos, setFotos] = useState(obra?.fotos||[]);
  const [checklist, setChecklist] = useState(obra?.checklist||{});
  // Checklist específico de Descaracterização: { [item]: { avaliacao, foto } }
  const [checklistDescaract, setChecklistDescaract] = useState(obra?.checklistDescaract||{});
  const [osDigital, setOsDigital] = useState(obra?.osDigital||null);
  const [showOS, setShowOS] = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matNome, setMatNome] = useState("");
  const [matQtd,  setMatQtd]  = useState("");
  const [matUn,   setMatUn]   = useState("un");

  // ── Unificação real de estoque ──────────────────────────────────────────
  // Lança a saída no estoque central (materiais_estoque) no momento exato do
  // uso, caso exista um item com esse nome+unidade. Se não existir (material
  // nunca passou por uma compra recebida nem foi cadastrado manualmente),
  // não há estoque pra debitar — só fica registrado no histórico da obra.
  async function lancarSaidaEstoque(nome, qtd, un, origem) {
    if (!obra?.id) return; // obra ainda não salva — sem demanda pra vincular o movimento
    try {
      const snap = await getDocs(collection(db,"materiais_estoque"));
      const found = snap.docs.map(d=>({id:d.id,...d.data()}))
        .find(m => m.nome.trim().toLowerCase()===nome.trim().toLowerCase() && m.un===un);
      if (!found) return; // nada cadastrado pra debitar
      const ehDevolucao = qtd < 0;
      const qtdAbs = Math.abs(qtd);
      await addDoc(collection(db,"movimentacoes"), {
        itemId: found.id, itemNome: nome, tipo: ehDevolucao ? "entrada" : "saida", qtd: qtdAbs,
        data: new Date().toISOString().split("T")[0],
        demandaTipo: "obra", demandaId: obra.id, demandaNome: obra.nome,
        origem: ehDevolucao ? "devolucao_lancamento" : origem, usuario: nomeUser, createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db,"materiais_estoque",found.id), {
        saldo: (found.saldo||0) - qtd, // qtd negativo soma de volta
        [ehDevolucao ? "totalEntradas" : "totalSaidas"]: (found[ehDevolucao?"totalEntradas":"totalSaidas"]||0) + qtdAbs,
      });
    } catch(err) { console.error("Erro ao lançar saída de estoque:", err); }
  }

  function toggleCheck(item) { setChecklist(p=>({...p,[item]:!p[item]})); }
  function setDescaract(campo,v) { setForm(p=>({...p, descaract:{...p.descaract,[campo]:v}})); }
  function setTermoChaves(campo,v) { setForm(p=>({...p, termoChaves:{...p.termoChaves,[campo]:v}})); }
  function setAvaliacaoItem(item, avaliacao) {
    setChecklistDescaract(p=>({...p, [item]:{...p[item], avaliacao}}));
  }
  const MIN_FOTOS_ITEM_DESCARACT = 5;
  function adicionarFotosItem(item, files) {
    if (!files || !files.length) return;
    Array.from(files).forEach(file=>{
      const reader = new FileReader();
      reader.onload = () => {
        setChecklistDescaract(p=>({...p, [item]:{...p[item], fotos:[...(p[item]?.fotos||[]), reader.result]}}));
      };
      reader.readAsDataURL(file);
    });
  }
  function removerFotoItem(item, idx) {
    setChecklistDescaract(p=>({...p, [item]:{...p[item], fotos:(p[item]?.fotos||[]).filter((_,i)=>i!==idx)}}));
  }
  // Farol de cores por avaliação: Bom=verde, Regular=amarelo, N/A=vermelho
  const CORES_AVALIACAO = { bom:"var(--verde)", regular:"#D9A03B", na:"var(--vermelho)" };
  const isDescaracterizacao = form.tipo === TIPO_DESCARACTERIZACAO;
  const itensDescaractTotal = Object.values(CHECKLIST_DESCARACTERIZACAO).flat().length + PERGUNTAS_COLETAS.length;
  const itensDescaractPreenchidos =
    Object.values(CHECKLIST_DESCARACTERIZACAO).flat().filter(item=>{
      const d = checklistDescaract[item];
      if (!d?.avaliacao) return false;
      if (d.avaliacao==="na") return true; // N/A não exige foto
      return (d.fotos||[]).length>=MIN_FOTOS_ITEM_DESCARACT;
    }).length +
    PERGUNTAS_COLETAS.filter(item=>checklistDescaract[item]?.avaliacao).length;
  function adicionarMaterial() {
    if(!matNome.trim()||!matQtd){alert("Informe nome e quantidade.");return;}
    const qtd = Number(matQtd);
    setForm(p=>({...p,materiais:[...p.materiais,{nome:matNome,qtd,un:matUn}]}));
    lancarSaidaEstoque(matNome, qtd, matUn, "execucao_obra_avulso");
    setMatNome("");setMatQtd("");
  }

  // ── Controle de estoque: o que foi comprado/recebido para esta obra ────────
  // Busca todas as compras vinculadas a esta obra que já passaram pela
  // conferência de recebimento ("RECEBIDO" em diante) com resultado "conforme"
  // — ou seja, material que realmente entrou e foi confirmado, não apenas
  // solicitado. Isso fica disponível pra usar na execução (aba Materiais).
  const [comprasObra, setComprasObra] = useState([]);
  const [transferenciasObra, setTransferenciasObra] = useState([]);
  const [despesasObra, setDespesasObra] = useState([]);
  useEffect(() => {
    if (!obra?.id) return;
    return onSnapshot(query(collection(db,"despesas"), where("obraId","==",obra.id)), snap => {
      setDespesasObra(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, err => console.error("Erro ao buscar despesas da obra:", err));
  }, [obra?.id]);
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
    lancarSaidaEstoque(item.nome, qtd, item.un, "execucao_obra");
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
    const payload = { ...form, progresso: Number(form.progresso)||0, fotos, checklist, checklistDescaract, osDigital: osDigital||null, updatedAt: agora };

    const resultado = await salvarComFallbackOffline(
      obra?.id ? "obra:update" : "obra:create",
      { id: obra?.id, payload, uid: currentUser?.uid, nome: nomeUser },
      async ({ id, payload, uid, nome }) => {
        if (id) await updateComAuditoria("obras", id, payload, uid, nome);
        else    await addComAuditoria("obras", payload, uid, nome);
      }
    );

    if (resultado.ok) {
      addToast(obra?.id ? "Obra atualizada!" : "Obra criada!");
      onClose();
    } else if (resultado.enfileirado) {
      addToast("📡 Sem conexão — salvo no dispositivo. Será enviado automaticamente quando a internet voltar.", "warning");
      onClose();
    }
    setSaving(false);
  }

  const isExternoUser = isExterno(userProfile);
  const ABAS = isCampoUser
    ? [...(!isExternoUser?["custos"]:[]),"materiais","fotos_checklist",...(isDescaracterizacao?["descaracterizacao"]:[]),"termo_chaves","os_digital"]
    : ["dados","endereço","financeiro",...(!isExternoUser?["custos"]:[]),"materiais","fotos_checklist",...(isDescaracterizacao?["descaracterizacao"]:[]),"termo_chaves","os_digital"];
  const LABELS = { dados:"Dados", "endereço":"Endereço", financeiro:"Financeiro", custos:"💰 Custos", materiais:"Materiais", fotos_checklist:"Fotos & Checklist", os_digital:"OS Digital", descaracterizacao:"📋 Descaracterização", termo_chaves:"🔑 Termo de Chaves" };

  return (
    <Modal title={obra?.id?"Editar obra":"Nova obra"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>

      <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        {ABAS.map((a,i)=>(
          <button key={a} onClick={()=>setAba(a)} className="btn btn-sm"
            style={{background:aba===a?"var(--afine-yellow)":"",borderColor:aba===a?"var(--afine-yellow)":"",fontWeight:aba===a?700:400,color:aba===a?"var(--afine-black)":""}}>
            {LABELS[a]}
          </button>
        ))}
        {obra?.id && (
          <button className="btn btn-sm" style={{marginLeft:"auto"}}
            onClick={()=>exportarObraParaPDF({...obra,...form,fotos,checklist,osDigital}, Object.fromEntries(funcionarios.map(f=>[f.id,f])))}>
            📄 PDF
          </button>
        )}
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
                  .filter(f=>isGestorOuAdm(f))
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
              {(funcionarios||[]).filter(f=>["campo","empreiteiro","terceiro"].includes(f.departamento||f.perfil)).length===0&&<span style={{fontSize:12,color:"#7A7A7A"}}>Nenhum colaborador de campo cadastrado</span>}
              {(funcionarios||[]).filter(f=>["campo","empreiteiro","terceiro"].includes(f.departamento||f.perfil)).map(f=>{
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

          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Despesas vinculadas a esta obra</div>
          {despesasObra.length===0 ? (
            <div style={{fontSize:12,color:"#7A7A7A"}}>Nenhuma despesa lançada com essa obra como centro de custo ainda.</div>
          ) : (
            <>
              <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,color:"#4A4A4A"}}>Total de {despesasObra.length} despesa(s)</span>
                <strong style={{fontSize:18,color:"var(--vermelho)"}}>
                  R$ {despesasObra.reduce((s,d)=>s+(d.valor||0),0).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                </strong>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data</th><th>Descrição</th><th>Funcionário</th><th style={{textAlign:"right"}}>Valor</th></tr></thead>
                  <tbody>
                    {despesasObra.sort((a,b)=>(b.data||"").localeCompare(a.data||"")).slice(0,10).map(d=>(
                      <tr key={d.id}>
                        <td style={{fontSize:12}}>{d.data?.split("-").reverse().join("/")}</td>
                        <td style={{fontSize:12}}>{d.descricao}</td>
                        <td style={{fontSize:12}}>{d.funcionarioNome||"–"}</td>
                        <td style={{textAlign:"right",fontWeight:600,fontSize:12}}>R$ {Number(d.valor||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {despesasObra.length>10 && <div style={{fontSize:11,color:"#7A7A7A"}}>+{despesasObra.length-10} despesa(s) — veja todas em Financeiro → Despesas, filtrando por esta obra.</div>}
            </>
          )}
        </div>
      )}

      {aba==="custos" && obra?.id && (
        <CustosDemanda
          demandaTipo="obra"
          demandaId={obra.id}
          demandaNome={obra.nome}
          orcamento={form.valorOrcamento}
        />
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
                  <td><button className="btn btn-sm" style={{color:"var(--vermelho)"}} onClick={()=>{
                    setForm(p=>({...p,materiais:p.materiais.filter((_,j)=>j!==i)}));
                    lancarSaidaEstoque(m.nome, -m.qtd, m.un, "remocao_lancamento"); // qtd negativa = devolve ao estoque
                  }}>✕</button></td>
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

      {aba==="descaracterizacao" && (
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div className="alert alert-info" style={{fontSize:12}}>
            📋 Checklist de descaracterização/devolução do imóvel — preencha a avaliação e anexe uma foto para cada item.
            <strong style={{marginLeft:6}}>{itensDescaractPreenchidos}/{itensDescaractTotal} itens completos.</strong>
          </div>

          {/* Dados gerais do encerramento/desocupação */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>
              Encerramento / Desocupação e Devolução de Bem
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Nº do Processo / Protocolo</label><input value={form.descaract.numeroProcesso} onChange={e=>setDescaract("numeroProcesso",e.target.value)}/></div>
              <div className="form-group"><label>Coordenador</label><input value={form.descaract.coordenador} onChange={e=>setDescaract("coordenador",e.target.value)}/></div>
              <div className="form-group"><label>Início da desocupação</label><input type="date" value={form.descaract.inicioDesocupacao} onChange={e=>setDescaract("inicioDesocupacao",e.target.value)}/></div>
              <div className="form-group"><label>Término da desocupação</label><input type="date" value={form.descaract.terminoDesocupacao} onChange={e=>setDescaract("terminoDesocupacao",e.target.value)}/></div>
            </div>
          </div>

          {/* Seções de checklist com foto por item (Área Externa / Área Interna) */}
          {Object.entries(CHECKLIST_DESCARACTERIZACAO).map(([secao, itens])=>(
            <div key={secao}>
              <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>
                Fotos — {secao}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {itens.map(item=>{
                  const dado = checklistDescaract[item]||{};
                  const fotos = dado.fotos||[];
                  const isNA = dado.avaliacao==="na";
                  const fotosOk = isNA || fotos.length>=MIN_FOTOS_ITEM_DESCARACT;
                  return (
                    <div key={item} style={{border:"1px solid var(--border)",borderRadius:8,padding:10}}>
                      <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>{item}</div>
                      <div style={{display:"flex",gap:6,marginBottom:8}}>
                        {AVALIACOES_DESCARACT.map(op=>{
                          const ativo = dado.avaliacao===op.v;
                          const cor = CORES_AVALIACAO[op.v];
                          return (
                            <button key={op.v} type="button" onClick={()=>setAvaliacaoItem(item,op.v)}
                              style={{
                                flex:1, padding:"8px 4px", borderRadius:6, cursor:"pointer", fontSize:12,
                                border:`1px solid ${ativo?cor:"var(--border)"}`,
                                background:ativo?cor:"var(--cinza-lt)",
                                color:ativo?"#fff":"#4A4A4A",
                                fontWeight:ativo?700:400,
                              }}>
                              <div style={{fontSize:16}}>{op.icone}</div>{op.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Fotos: mínimo 5, com botões de Tirar foto e Anexar — não exigido quando N/A */}
                      {!isNA && (
                        <>
                          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                            <label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"6px 12px",border:"1px dashed var(--afine-yellow-dk)",borderRadius:6,cursor:"pointer",color:"var(--afine-yellow-dk)"}}>
                              📷 Tirar foto
                              <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{adicionarFotosItem(item, e.target.files); e.target.value="";}}/>
                            </label>
                            <label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,padding:"6px 12px",border:"1px dashed var(--border)",borderRadius:6,cursor:"pointer",color:"#7A7A7A"}}>
                              📎 Anexar
                              <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{adicionarFotosItem(item, e.target.files); e.target.value="";}}/>
                            </label>
                            <span style={{fontSize:11,fontWeight:700,color:fotosOk?"var(--verde)":"var(--vermelho)",alignSelf:"center"}}>
                              {fotosOk?"✅":"📷"} {fotos.length}/{MIN_FOTOS_ITEM_DESCARACT} fotos
                            </span>
                          </div>
                          {fotos.length>0 && (
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                              {fotos.map((f,idx)=>(
                                <div key={idx} style={{position:"relative"}}>
                                  <img src={f} alt={`${item} ${idx+1}`} style={{height:64,width:64,objectFit:"cover",borderRadius:6,border:"1px solid var(--border)"}}/>
                                  <button onClick={()=>removerFotoItem(item,idx)}
                                    style={{position:"absolute",top:-6,right:-6,background:"var(--vermelho)",color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",fontSize:10}}>✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {isNA && (
                        <div style={{fontSize:11,color:"#7A7A7A",marginBottom:8,fontStyle:"italic"}}>Não se aplica — sem necessidade de foto.</div>
                      )}

                      {/* Comentário em todos os itens */}
                      <input value={dado.comentario||""} onChange={e=>setChecklistDescaract(p=>({...p,[item]:{...p[item],comentario:e.target.value}}))}
                        placeholder="💬 Comentar (opcional)"/>

                      {(!dado.avaliacao||!fotosOk) && (
                        <div style={{fontSize:11,color:"var(--vermelho)",marginTop:4}}>
                          {!dado.avaliacao && "Avaliação pendente. "}{!fotosOk && `Faltam ${MIN_FOTOS_ITEM_DESCARACT-fotos.length} foto(s).`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Coletas — perguntas Sim/Não com comentário (sem N/A, sem foto) */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>
              Coletas
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {PERGUNTAS_COLETAS.map(pergunta=>{
                const dado = checklistDescaract[pergunta]||{};
                return (
                  <div key={pergunta} style={{border:"1px solid var(--border)",borderRadius:8,padding:10}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>{pergunta}</div>
                    <div style={{display:"flex",gap:6,marginBottom:8}}>
                      {[{v:"regular",icone:"😐",label:"Não"},{v:"bom",icone:"😊",label:"Sim"}].map(op=>{
                        const ativo = dado.avaliacao===op.v;
                        const cor = CORES_AVALIACAO[op.v];
                        return (
                          <button key={op.v} type="button" onClick={()=>setAvaliacaoItem(pergunta,op.v)}
                            style={{
                              flex:1, padding:"8px 4px", borderRadius:6, cursor:"pointer", fontSize:12,
                              border:`1px solid ${ativo?cor:"var(--border)"}`,
                              background:ativo?cor:"var(--cinza-lt)",
                              color:ativo?"#fff":"#4A4A4A",
                              fontWeight:ativo?700:400,
                            }}>
                            <div style={{fontSize:16}}>{op.icone}</div>{op.label}
                          </button>
                        );
                      })}
                    </div>
                    <input value={dado.comentario||""} onChange={e=>setChecklistDescaract(p=>({...p,[pergunta]:{...p[pergunta],comentario:e.target.value}}))}
                      placeholder="💬 Comentar (opcional)"/>
                    {!dado.avaliacao && <div style={{fontSize:11,color:"var(--vermelho)",marginTop:4}}>Resposta pendente</div>}
                  </div>
                );
              })}
            </div>
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
              <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
                <button className="btn btn-sm" onClick={()=>exportarOSParaPDF(osDigital, form)}>📄 Ver PDF</button>
                <button className="btn btn-sm" onClick={()=>setOsDigital(null)} style={{fontSize:11}}>Refazer assinatura</button>
              </div>
            </div>
          )}

          {showOS&&(
            <Modal title="Ordem de Serviço Digital" onClose={()=>setShowOS(false)}>
              <OSDigital
                manutencao={false}
                descExtra={form.obs}
                funcionario={{ nome: nomeUser, funcao: userProfile?.departamento||userProfile?.perfil||"" }}
                loja={form.agenciaNome||""}
                otTicket={form.contrato||""}
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

      {aba==="termo_chaves" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-group">
            <label className="required">Tem chave a ser devolvida?</label>
            <div style={{display:"flex",gap:6}}>
              {[["sim","Sim, tem chave a devolver"],["nao","Não tem chave a devolver"]].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setTermoChaves("temChaveDevolver",v)}
                  style={{
                    flex:1, padding:"10px 6px", fontSize:12, borderRadius:8, cursor:"pointer",
                    border:`1px solid ${form.termoChaves.temChaveDevolver===v?"var(--afine-yellow-dk)":"var(--border)"}`,
                    background:form.termoChaves.temChaveDevolver===v?"var(--afine-yellow-lt)":"#fff",
                    fontWeight:form.termoChaves.temChaveDevolver===v?700:400,
                  }}>{l}</button>
              ))}
            </div>
            {!form.termoChaves.temChaveDevolver && <div style={{fontSize:11,color:"var(--vermelho)",marginTop:4}}>Escolha uma opção — campo obrigatório.</div>}
          </div>

          {form.termoChaves.temChaveDevolver==="nao" && (
            <div className="alert alert-info" style={{fontSize:12}}>
              ✓ Sem chave a devolver — não há necessidade de preencher o termo. Pode seguir para a próxima aba.
            </div>
          )}

          {form.termoChaves.temChaveDevolver==="sim" && (
            <>
              <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12,fontSize:12}}>
                <div style={{fontWeight:700,marginBottom:4}}>Imóvel (extraído automaticamente)</div>
                <div>{form.logradouro?`${form.logradouro}, ${form.numero}`:"Endereço não cadastrado"}{form.bairro&&` — ${form.bairro}`}</div>
                <div>{form.agenciaNome&&`${form.agenciaNome} · `}{form.cidade||"–"} - {form.uf||"–"}</div>
              </div>

              <div className="form-grid">
                <div className="form-group"><label className="required">Quantidade de chaves</label>
                  <input type="number" min="1" value={form.termoChaves.quantidadeChaves} onChange={e=>setTermoChaves("quantidadeChaves",e.target.value)}/>
                </div>
                <div className="form-group"><label>Data do documento</label>
                  <input type="date" value={form.termoChaves.dataDocumento||new Date().toISOString().split("T")[0]} onChange={e=>setTermoChaves("dataDocumento",e.target.value)}/>
                </div>
                <div className="form-group span-2"><label className="required">Nome de quem recebeu a(s) chave(s)</label>
                  <input value={form.termoChaves.nomeRecebeu} onChange={e=>setTermoChaves("nomeRecebeu",e.target.value)}/>
                </div>
                <div className="form-group"><label className="required">CPF</label>
                  <input value={form.termoChaves.cpf} onChange={e=>setTermoChaves("cpf",e.target.value)} placeholder="000.000.000-00"/>
                </div>
                <div className="form-group"><label className="required">RG</label>
                  <input value={form.termoChaves.rg} onChange={e=>setTermoChaves("rg",e.target.value)} placeholder="00.000.000-0"/>
                </div>
              </div>

              <AssinaturaDigital
                label="Assinatura de quem recebeu as chaves"
                assinatura={form.termoChaves.assinatura}
                onChange={(b64)=>setTermoChaves("assinatura",b64)}
              />

              {(() => {
                const faltam = !form.termoChaves.nomeRecebeu||!form.termoChaves.quantidadeChaves||!form.termoChaves.cpf||!form.termoChaves.rg||!form.termoChaves.assinatura;
                return (
                  <>
                    <button className="btn btn-primary" style={{padding:14,fontSize:14}}
                      disabled={faltam}
                      onClick={()=>exportarTermoChavesParaPDF({
                        enderecoCompleto: form.logradouro?`${form.logradouro}, ${form.numero}${form.bairro?` — ${form.bairro}`:""}`:"",
                        agenciaNome: form.agenciaNome||"",
                        cidade: form.cidade, estado: form.uf,
                        quantidadeChaves: form.termoChaves.quantidadeChaves,
                        nomeRecebeu: form.termoChaves.nomeRecebeu,
                        cpf: form.termoChaves.cpf, rg: form.termoChaves.rg,
                        assinatura: form.termoChaves.assinatura,
                        dataDocumento: form.termoChaves.dataDocumento,
                      })}>
                      📄 Gerar PDF do Termo de Entrega de Chaves
                    </button>
                    {faltam && (
                      <div style={{fontSize:11,color:"var(--vermelho)"}}>Preencha quantidade, nome, CPF, RG e assinatura para gerar o PDF.</div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// Modal de confirmação de exclusão — requer digitar o nome para confirmar
function ModalConfirmacaoExclusao({ nome, onConfirmar, onCancelar }) {
  const [digitado, setDigitado] = React.useState("");
  const confirmado = digitado.trim().toLowerCase() === (nome||"").trim().toLowerCase();
  return (
    <div onClick={onCancelar} style={{position:"fixed",inset:0,zIndex:400,background:"rgba(10,10,10,.65)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,width:"min(460px,94vw)",boxShadow:"0 24px 64px rgba(0,0,0,.28)",overflow:"hidden"}}>
        <div style={{background:"#1A1A1A",padding:"14px 20px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>🗑️</span>
          <div style={{fontWeight:700,fontSize:15,color:"var(--vermelho,#BD3838)"}}>Excluir demanda</div>
        </div>
        <div style={{padding:"20px 20px 16px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"#fff0f0",border:"1px solid rgba(189,56,56,.25)",borderRadius:8,padding:"10px 14px",fontSize:13,color:"var(--vermelho,#BD3838)",fontWeight:600}}>
            ⚠️ Esta ação é <strong>irreversível</strong>. Todos os dados desta demanda serão excluídos permanentemente.
          </div>
          <div style={{fontSize:13,color:"#555"}}>
            Digite o nome abaixo para confirmar a exclusão de <strong>"{nome}"</strong>:
          </div>
          <input
            type="text"
            value={digitado}
            onChange={e=>setDigitado(e.target.value)}
            placeholder={nome}
            autoFocus
            style={{padding:"9px 12px",border:`1px solid ${confirmado?"var(--verde,#1E7A3C)":digitado?"var(--vermelho,#BD3838)":"#ddd"}`,borderRadius:7,fontSize:13,outline:"none"}}
          />
          {confirmado && <span style={{fontSize:11,color:"var(--verde,#1E7A3C)",fontWeight:600}}>✓ Confirmado — pronto para excluir</span>}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:4}}>
            <button onClick={onCancelar} style={{padding:"9px 20px",border:"1px solid #ddd",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={onConfirmar} disabled={!confirmado} style={{padding:"9px 22px",border:"none",borderRadius:8,background:confirmado?"var(--vermelho,#BD3838)":"#e0e0e0",color:confirmado?"#fff":"#aaa",cursor:confirmado?"pointer":"not-allowed",fontSize:13,fontWeight:700}}>
              Excluir definitivamente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Obras({ onObraSelect }) {
  const { userProfile, currentUser } = useAuth();
  const souCampo = isCampo(userProfile);
  const isMobile = useIsMobile();
  const { toasts, addToast } = useToast();
  const [obras,   setObras]   = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filtros, setFiltros] = useState({ periodo:{de:"",ate:""}, clienteId:"", responsavelId:"", status:[] });
  const [modal,   setModal]   = useState(null);
  const [obraAberta, setObraAberta] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null); // {id, nome}
  const [abaDrawer, setAbaDrawer]   = useState("ocorrencias");
  const isGestor = isGestorOuAdm(userProfile);
  const [aba, setAba] = useState("lista");

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

  // Separa ativas x concluídas
  const obrasAtivas     = useMemo(()=>obrasVisiveis.filter(o=>o.status!=="CONCLUÍDA"),[obrasVisiveis]);
  const obrasConcluidas = useMemo(()=>obrasVisiveis.filter(o=>o.status==="CONCLUÍDA"), [obrasVisiveis]);

  function buildPorCliente(lista) {
    const map = {};
    lista.forEach(o=>{
      const cli = o.cliente||"Sem cliente";
      if(!map[cli]) map[cli] = { nome:cli, agencias:{} };
      const ag = o.agenciaNome||o.agencia||"Sede / Sem agência";
      if(!map[cli].agencias[ag]) map[cli].agencias[ag] = [];
      map[cli].agencias[ag].push(o);
    });
    return Object.values(map).sort((a,b)=>a.nome.localeCompare(b.nome));
  }

  const porCliente           = useMemo(()=>buildPorCliente(obrasAtivas),    [obrasAtivas]);
  const porClienteConcluidas = useMemo(()=>buildPorCliente(obrasConcluidas),[obrasConcluidas]);

  const filtered = obrasAtivas.filter(o=>{
    const q=search.toLowerCase();
    const mQ=!q||o.nome?.toLowerCase().includes(q)||o.cliente?.toLowerCase().includes(q)||o.contrato?.toLowerCase().includes(q);
    const mPeriodo = dentroPeriodo(o.inicio, filtros.periodo);
    const mCliente = !filtros.clienteId || o.clienteId===filtros.clienteId;
    const mResp = !filtros.responsavelId || o.responsavelId===filtros.responsavelId;
    const mStatus = filtros.status.length===0 || filtros.status.includes(o.status);
    return mQ && mPeriodo && mCliente && mResp && mStatus;
  });

  const statusList=["EM ANDAMENTO","CONCLUÍDA","PARALISADA","PLANEJAMENTO","AGUARDANDO APROVAÇÃO"];

  // KPIs
  const kpiEmAndamento  = obrasVisiveis.filter(o=>o.status==="EM ANDAMENTO").length;
  const kpiConcluidas   = obrasVisiveis.filter(o=>o.status==="CONCLUÍDA").length;
  const kpiPlanejamento = obrasVisiveis.filter(o=>o.status==="PLANEJAMENTO").length;
  const kpiParalisadas  = obrasVisiveis.filter(o=>o.status==="PARALISADA").length;
  const hoje = new Date().toISOString().split("T")[0];
  const kpiAtrasadas    = obrasVisiveis.filter(o=>o.termino&&o.termino<hoje&&!["CONCLUÍDA","PARALISADA"].includes(o.status)).length;
  const gestoresList = funcionarios.filter(f=>isGestorOuAdm(f));



  const [clienteExpandido, setClienteExpandido] = useState(null);

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
        <div style={{display:"flex",gap:8}}>
          <BtnExcel onClick={()=>exportarExcel(filtered,"Obras",[
            { key:"nome", header:"Obra" },
            { key:"tipo", header:"Tipo" },
            { key:"cliente", header:"Cliente" },
            { key:"responsavelNome", header:"Responsável" },
            { key:"logradouro", header:"Endereço" },
            { key:"numero", header:"Nº" },
            { key:"cidade", header:"Cidade" },
            { key:"uf", header:"UF" },
            { key:"inicio", header:"Início", format:v=>v?v.split("-").reverse().join("/"):"" },
            { key:"termino", header:"Término previsto", format:v=>v?v.split("-").reverse().join("/"):"" },
            { key:"conclusaoReal", header:"Conclusão real", format:v=>v?v.split("-").reverse().join("/"):"" },
            { key:"valorOrcamento", header:"Valor orçamento", format:v=>Number(v||0).toFixed(2) },
            { key:"progresso", header:"Progresso (%)" },
            { key:"status", header:"Status" },
          ])} disabled={filtered.length===0}/>
          {isGestor && <button className="btn btn-primary" onClick={()=>setModal({obra:null})}>+ Nova obra</button>}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:16}}>
        <div className="metric" style={{borderLeft:"3px solid #185FA5"}}><div className="metric-label">Em andamento</div><div className="metric-value blue">{kpiEmAndamento}</div></div>
        <div className="metric" style={{borderLeft:"3px solid var(--verde)"}}><div className="metric-label">Concluídas</div><div className="metric-value green">{kpiConcluidas}</div></div>
        {kpiPlanejamento>0&&<div className="metric" style={{borderLeft:"3px solid #aaa"}}><div className="metric-label">Planejamento</div><div className="metric-value">{kpiPlanejamento}</div></div>}
        {kpiParalisadas>0&&<div className="metric" style={{borderLeft:"3px solid var(--vermelho)"}}><div className="metric-label">Paralisadas</div><div className="metric-value red">{kpiParalisadas}</div></div>}
        {kpiAtrasadas>0&&<div className="metric" style={{borderLeft:"3px solid var(--laranja,#F5A623)"}}><div className="metric-label">Atrasadas</div><div className="metric-value amber">{kpiAtrasadas}</div></div>}
      </div>

      {/* Sub-abas */}
      {!souCampo && (
        <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",flexWrap:"wrap"}}>
          {[
            {id:"lista",       label:"📋 Lista completa"},
            {id:"por_cliente", label:"🏢 Por cliente"},
            {id:"concluidas",  label:`✅ Concluídas (${kpiConcluidas})`},
          ].map((a,i,arr)=>(
            <button key={a.id} onClick={()=>setAba(a.id)}
              style={{flex:"1 1 auto",padding:"9px 10px",border:"none",cursor:"pointer",
                background:aba===a.id?"#1A1A1A":"var(--cinza-lt)",
                color:aba===a.id?"#F5C800":"#4A4A4A",
                borderRight:i<arr.length-1?"1px solid var(--border)":"none",
                transition:"all .15s",fontSize:11,fontWeight:aba===a.id?700:400,whiteSpace:"nowrap"}}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* ── ABA: LISTA COMPLETA ── */}
      {(aba==="lista" || souCampo) && (<>
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
      {!loading && filtered.length>0 && isMobile && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(o=>{
            const temEndereco = o.logradouro&&o.numero;
            const equipeIds = o.equipeIds||[];
            const nomesEquipe = equipeIds.map(id=>funcionarios.find(f=>f.id===id)?.nome).filter(Boolean);
            return (
              <div key={o.id} className="card" style={{padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14}}>{o.nome}</div>
                    <div style={{fontSize:11,color:"#7A7A7A"}}>{o.cliente}{o.agenciaNome&&` · ${o.agenciaNome}`}</div>
                  </div>
                  <span className={`badge ${statusBadge(o.status)}`} style={{flexShrink:0}}>{o.status}</span>
                </div>

                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  <span className="badge badge-gray" style={{fontSize:10}}>{o.tipo||"–"}</span>
                  {o.responsavelNome && <span style={{fontSize:11,color:"#7A7A7A"}}>👤 {o.responsavelNome}</span>}
                  {nomesEquipe.length>0 && <span style={{fontSize:11,color:"var(--afine-yellow-dk)",fontWeight:600}}>👷 {nomesEquipe.length}</span>}
                </div>

                {temEndereco && (
                  <button onClick={()=>{
                    const enc=encodeURIComponent(`${o.logradouro}, ${o.numero}, ${o.cidade}`);
                    window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
                  }} style={{background:"none",border:"none",color:"var(--afine-yellow-dk)",cursor:"pointer",fontSize:12,padding:0,textAlign:"left",marginBottom:8,display:"block"}}>
                    🗺️ {o.logradouro}, {o.numero}
                  </button>
                )}

                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div className="progress-bar" style={{flex:1}}><div className={`progress-fill ${o.progresso>=100?"green":"blue"}`} style={{width:`${o.progresso||0}%`}}/></div>
                  <span style={{fontSize:11,fontWeight:600,flexShrink:0}}>{o.progresso||0}%</span>
                </div>

                <div style={{display:"flex",gap:6,fontSize:11,color:"#7A7A7A",marginBottom:10,flexWrap:"wrap"}}>
                  <span>Término: {fmtDate(o.conclusaoReal||o.termino)}</span>
                  <span className={`badge ${o.orcamentoEnviado==="SIM"?"badge-green":"badge-red"}`} style={{fontSize:9}}>Orç. {o.orcamentoEnviado||"NÃO"}</span>
                  <span className={`badge ${o.relatorioEnviado==="SIM"?"badge-green":"badge-red"}`} style={{fontSize:9}}>Rel. {o.relatorioEnviado||"NÃO"}</span>
                </div>

                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button className="btn btn-primary btn-sm" onClick={()=>setModal({obra:o})} style={{flex:1}}>▶ Executar</button>
                  {isGestor && <button className="btn btn-sm btn-icon" onClick={()=>setModal({obra:o})}>✏️</button>}
                  <button className="btn btn-sm btn-icon" title="Ocorrências" onClick={()=>{setObraAberta(o);setAbaDrawer("ocorrencias");}}>⚠️</button>
                  <button className="btn btn-sm btn-icon" title="Acompanhamento" onClick={()=>{setObraAberta(o);setAbaDrawer("acompanhamento");}}>📐</button>
                  <button className="btn btn-sm btn-icon" title="Diário de Obra"  onClick={()=>{setObraAberta(o);setAbaDrawer("diario");}}>📓</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && filtered.length>0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Obra</th><th>Cliente</th><th>Responsável</th><th>Término</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(o=>{
                const temEndereco = o.logradouro&&o.numero;
                const equipeIds = o.equipeIds||[];
                const nomesEquipe = equipeIds.map(id=>funcionarios.find(f=>f.id===id)?.nome).filter(Boolean);
                return (
                <tr key={o.id}>
                  <td>
                    <div style={{fontWeight:600,fontSize:13}}>{o.nome}</div>
                    <div style={{fontSize:11,color:"#7A7A7A",marginTop:2,display:"flex",gap:6,flexWrap:"wrap"}}>
                      {o.contrato&&<span>{o.contrato}</span>}
                      {o.tipo&&<span className="badge badge-gray" style={{fontSize:10}}>{o.tipo}</span>}
                      {nomesEquipe.length>0&&<span style={{color:"var(--afine-yellow-dk)"}}>👷 {nomesEquipe.join(", ")}</span>}
                    </div>
                  </td>
                  <td style={{fontSize:12}}>
                    {o.cliente}
                    {o.agenciaNome&&<div style={{fontSize:10,color:"var(--afine-yellow-dk)",fontWeight:600}}>🏢 {o.agenciaNome}</div>}
                    {temEndereco&&<div style={{fontSize:10,color:"#aaa"}}>📍 {o.logradouro}, {o.numero}</div>}
                  </td>
                  <td style={{fontSize:12}}>
                    {o.responsavelNome ? (
                      <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                        <span style={{width:22,height:22,borderRadius:"50%",background:"#185FA5",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {o.responsavelNome.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
                        </span>
                        {o.responsavelNome}
                      </span>
                    ) : <span style={{color:"#aaa"}}>–</span>}
                  </td>
                  <td style={{fontSize:12}}>
                    {fmtDate(o.conclusaoReal||o.termino)||"–"}
                    <div style={{marginTop:4}}>
                      <div className="progress-bar" style={{marginBottom:2}}><div className={`progress-fill ${o.progresso>=100?"green":"blue"}`} style={{width:`${o.progresso||0}%`}}/></div>
                      <span style={{fontSize:10,color:"#aaa"}}>{o.progresso||0}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
                    <div style={{display:"flex",gap:3,marginTop:4}}>
                      <span className={`badge ${o.orcamentoEnviado==="SIM"?"badge-green":"badge-red"}`} style={{fontSize:9}}>Orç</span>
                      <span className={`badge ${o.relatorioEnviado==="SIM"?"badge-green":"badge-red"}`} style={{fontSize:9}}>Rel</span>
                    </div>
                  </td>
                  <td style={{whiteSpace:"nowrap"}}>
                    <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      <button className="btn btn-primary btn-sm" onClick={()=>setModal({obra:o})}>▶</button>
                      {isGestor && <button className="btn btn-sm btn-icon" onClick={()=>setModal({obra:o})}>✏️</button>}
                      <button className="btn btn-sm btn-icon" title="Ocorrências" onClick={()=>{setObraAberta(o);setAbaDrawer("ocorrencias");}}>⚠️</button>
                      <button className="btn btn-sm btn-icon" title="Acompanhamento" onClick={()=>{setObraAberta(o);setAbaDrawer("acompanhamento");}}>📐</button>
                      <button className="btn btn-sm btn-icon" title="Diário" onClick={()=>{setObraAberta(o);setAbaDrawer("diario");}}>📓</button>
                      {isGestor && <button className="btn btn-sm btn-icon" title="Excluir" onClick={()=>setConfirmarExclusao({id:o.id,nome:o.nome})} style={{color:"var(--vermelho)"}}>🗑️</button>}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cards responsivos (visíveis em telas < 960px) ── */}
      {!loading && filtered.length>0 && (
        <div className="rdo-cards-grid">
          {filtered.map(o => {
            const equipeIds = o.equipeIds||[];
            const nomesEquipe = equipeIds.map(id=>funcionarios.find(f=>f.id===id)?.nome).filter(Boolean);
            const temEndereco = o.logradouro&&o.numero;
            return (
              <div key={o.id} className="rdo-card-item" style={{borderLeft:`4px solid ${o.status==="EM ANDAMENTO"?"#185FA5":o.status==="CONCLUÍDA"?"var(--verde)":"#ccc"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="card-title">{o.nome}</div>
                    {o.contrato&&<div className="card-sub">{o.contrato}</div>}
                  </div>
                  <span className={`badge ${statusBadge(o.status)}`} style={{flexShrink:0}}>{o.status}</span>
                </div>
                <div className="card-meta">
                  {o.tipo&&<span className="badge badge-gray" style={{fontSize:10}}>{o.tipo}</span>}
                  {o.cliente&&<span className="card-meta-item">🏢 {o.cliente}{o.agenciaNome?` · ${o.agenciaNome}`:""}</span>}
                  {o.responsavelNome&&<span className="card-meta-item">👤 {o.responsavelNome}</span>}
                  {nomesEquipe.length>0&&<span className="card-meta-item">👷 {nomesEquipe.join(", ")}</span>}
                </div>
                <div className="card-meta" style={{fontSize:11,color:"#7A7A7A"}}>
                  {o.termino&&<span>🗓 Término: {fmtDate(o.conclusaoReal||o.termino)}</span>}
                  {temEndereco&&<button onClick={()=>{const enc=encodeURIComponent(`${o.logradouro}, ${o.numero}, ${o.cidade}`);window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");}} style={{background:"none",border:"none",color:"var(--afine-yellow-dk)",cursor:"pointer",fontSize:11,padding:0}}>🗺️ {o.logradouro}, {o.numero}</button>}
                </div>
                {(o.progresso||0) > 0 && (
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#aaa",marginBottom:3}}>
                      <span>Progresso</span><span>{o.progresso||0}%</span>
                    </div>
                    <div className="card-progress">
                      <div className={`card-progress-fill${o.progresso>=100?" green":""}`} style={{width:`${o.progresso||0}%`}}/>
                    </div>
                  </div>
                )}
                <div className="card-meta">
                  <span style={{fontSize:10,color:"#aaa"}}>Orç:</span>
                  <span className={`badge ${o.orcamentoEnviado==="SIM"?"badge-green":o.orcamentoEnviado==="PENDENTE"?"badge-amber":"badge-red"}`} style={{fontSize:10}}>{o.orcamentoEnviado||"NÃO"}</span>
                  <span style={{fontSize:10,color:"#aaa"}}>Rel:</span>
                  <span className={`badge ${o.relatorioEnviado==="SIM"?"badge-green":"badge-red"}`} style={{fontSize:10}}>{o.relatorioEnviado||"NÃO"}</span>
                </div>
                <div className="card-actions">
                  <button className="btn btn-primary btn-sm" onClick={()=>setModal({obra:o})}>▶ Executar</button>
                  {isGestor&&<button className="btn btn-sm btn-icon" onClick={()=>setModal({obra:o})}>✏️</button>}
                  <button className="btn btn-sm btn-icon" title="Ocorrências" onClick={()=>{setObraAberta(o);setAbaDrawer("ocorrencias");}}>⚠️</button>
                  <button className="btn btn-sm btn-icon" title="Acompanhamento" onClick={()=>{setObraAberta(o);setAbaDrawer("acompanhamento");}}>📐</button>
                  <button className="btn btn-sm btn-icon" title="Diário" onClick={()=>{setObraAberta(o);setAbaDrawer("diario");}}>📓</button>
                  {isGestor&&<button className="btn btn-sm btn-icon" title="Excluir" onClick={()=>setConfirmarExclusao({id:o.id,nome:o.nome})} style={{color:"var(--vermelho)"}}>🗑️</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {/* ── ABA: POR CLIENTE ── */}
      {aba==="por_cliente" && !souCampo && (
        <div>
          {porCliente.length===0&&<div className="empty-state"><div className="empty-icon">🏢</div><p>Nenhuma obra encontrada</p></div>}
          {porCliente.map(cli=>(
            <div key={cli.nome} style={{marginBottom:16}}>
              {/* Header do cliente */}
              <button
                onClick={()=>setClienteExpandido(clienteExpandido===cli.nome?null:cli.nome)}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"10px 14px",border:"none",borderRadius:8,cursor:"pointer",
                  background:"#1A1A1A",color:"#fff",textAlign:"left",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16}}>🏢</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#F5C400"}}>{cli.nome}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:1}}>
                      {Object.values(cli.agencias).flat().length} obra(s) · {Object.keys(cli.agencias).length} agência(s)/loja(s)
                    </div>
                  </div>
                </div>
                <span style={{color:"#F5C400",fontSize:12,transform:clienteExpandido===cli.nome?"rotate(180deg)":"",transition:"transform .2s"}}>▼</span>
              </button>

              {/* Agências do cliente */}
              {clienteExpandido===cli.nome && Object.entries(cli.agencias).sort((a,b)=>a[0].localeCompare(b[0])).map(([ag,obras])=>(
                <div key={ag} style={{marginLeft:16,marginBottom:8}}>
                  <div style={{fontWeight:600,fontSize:12,padding:"6px 10px",
                    background:"var(--cinza-lt)",borderRadius:6,marginBottom:4,
                    display:"flex",alignItems:"center",gap:6,
                    borderLeft:"3px solid var(--afine-yellow)"}}>
                    🏪 {ag}
                    <span style={{fontSize:11,fontWeight:400,color:"#7A7A7A"}}>({obras.length} obra{obras.length>1?"s":""})</span>
                    <span style={{marginLeft:"auto",fontSize:11,color:"var(--verde)"}}>
                      {obras.filter(o=>o.status==="CONCLUÍDA").length} concluída{obras.filter(o=>o.status==="CONCLUÍDA").length!==1?"s":""}
                    </span>
                  </div>
                  {obras.map(o=>(
                    <div key={o.id} className="rdo-card" style={{borderLeft:`3px solid ${o.status==="EM ANDAMENTO"?"#185FA5":o.status==="CONCLUÍDA"?"var(--verde)":"#ccc"}`,marginBottom:6,marginLeft:8}}>
                      <div className="rdo-header">
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:13}}>{o.nome}</div>
                          <div style={{fontSize:11,color:"#7A7A7A",marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                            {o.tipo&&<span>{o.tipo}</span>}
                            {o.responsavelNome&&<span>👤 {o.responsavelNome}</span>}
                            {o.termino&&<span>🗓 {fmtDate(o.termino)}</span>}
                          </div>
                          {(o.progresso||0)>0&&(
                            <div style={{marginTop:6}}>
                              <div className="progress-bar" style={{marginBottom:2}}><div className={`progress-fill ${o.progresso>=100?"green":"blue"}`} style={{width:`${o.progresso||0}%`}}/></div>
                              <span style={{fontSize:10,color:"#aaa"}}>{o.progresso||0}%</span>
                            </div>
                          )}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                          <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
                          <div style={{display:"flex",gap:3}}>
                            <button className="btn btn-sm btn-primary" onClick={()=>setModal({obra:o})} title="Abrir">▶</button>
                            <button className="btn btn-sm btn-icon" title="Ocorrências" onClick={()=>{setObraAberta(o);setAbaDrawer("ocorrencias");}}>⚠️</button>
                            <button className="btn btn-sm btn-icon" title="Acompanhamento" onClick={()=>{setObraAberta(o);setAbaDrawer("acompanhamento");}}>📐</button>
                            <button className="btn btn-sm btn-icon" title="Diário de Obra" onClick={()=>{setObraAberta(o);setAbaDrawer("diario");}}>📓</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── ABA: CONCLUÍDAS (por cliente / agência) ── */}
      {aba==="concluidas" && !souCampo && (
        <div>
          <div className="search-bar">🔍<input placeholder="Buscar obra concluída..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {porClienteConcluidas.length===0&&<div className="empty-state"><div className="empty-icon">✅</div><p>Nenhuma obra concluída</p></div>}
          {porClienteConcluidas
            .map(cli=>({
              ...cli,
              agencias: Object.fromEntries(
                Object.entries(cli.agencias).map(([ag,obras])=>[
                  ag,
                  obras.filter(o=>!search||o.nome?.toLowerCase().includes(search.toLowerCase())||o.cliente?.toLowerCase().includes(search.toLowerCase()))
                ]).filter(([,obras])=>obras.length>0)
              )
            }))
            .filter(cli=>Object.keys(cli.agencias).length>0)
            .map(cli=>(
            <div key={cli.nome} style={{marginBottom:12}}>
              <button
                onClick={()=>setClienteExpandido(clienteExpandido===("c_"+cli.nome)?null:("c_"+cli.nome))}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"10px 14px",border:"none",borderRadius:8,cursor:"pointer",
                  background:"#1A1A1A",color:"#fff",textAlign:"left",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16}}>🏢</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#F5C400"}}>{cli.nome}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:1}}>
                      {Object.values(cli.agencias).flat().length} concluída(s) · {Object.keys(cli.agencias).length} agência(s)/loja(s)
                    </div>
                  </div>
                </div>
                <span style={{color:"#F5C400",fontSize:12,transform:clienteExpandido===("c_"+cli.nome)?"rotate(180deg)":"",transition:"transform .2s"}}>▼</span>
              </button>

              {clienteExpandido===("c_"+cli.nome) && Object.entries(cli.agencias).sort((a,b)=>a[0].localeCompare(b[0])).map(([ag,obras])=>(
                <div key={ag} style={{marginLeft:16,marginBottom:8}}>
                  <div style={{fontWeight:600,fontSize:12,padding:"6px 10px",
                    background:"var(--cinza-lt)",borderRadius:6,marginBottom:4,
                    display:"flex",alignItems:"center",gap:6,
                    borderLeft:"3px solid var(--verde)"}}>
                    🏪 {ag}
                    <span style={{fontSize:11,fontWeight:400,color:"#7A7A7A"}}>({obras.length} obra{obras.length>1?"s":""})</span>
                  </div>
                  <div style={{marginLeft:8}}>
                    {obras.sort((a,b)=>(b.conclusaoReal||b.termino||"").localeCompare(a.conclusaoReal||a.termino||"")).map(o=>(
                      <div key={o.id} className="rdo-card" style={{borderLeft:"3px solid var(--verde)",marginBottom:6}}>
                        <div className="rdo-header">
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:13}}>{o.nome}</div>
                            <div style={{fontSize:11,color:"#7A7A7A",marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                              {o.tipo&&<span>{o.tipo}</span>}
                              {o.responsavelNome&&<span>👤 {o.responsavelNome}</span>}
                              {(o.conclusaoReal||o.termino)&&<span>✓ {fmtDate(o.conclusaoReal||o.termino)}</span>}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:3,flexShrink:0}}>
                            <span className="badge badge-green" style={{fontSize:10}}>CONCLUÍDA</span>
                            <button className="btn btn-sm btn-icon" onClick={()=>setModal({obra:o})}>✏️</button>
                            <button className="btn btn-sm btn-icon" title="Diário" onClick={()=>{setObraAberta(o);setAbaDrawer("diario");}}>📓</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {confirmarExclusao && (
        <ModalConfirmacaoExclusao
          nome={confirmarExclusao.nome}
          onCancelar={()=>setConfirmarExclusao(null)}
          onConfirmar={async()=>{
            try {
              await deleteDoc(doc(db,"obras",confirmarExclusao.id));
              addToast(`Obra "${confirmarExclusao.nome}" excluída.`);
            } catch(e) { addToast("Erro ao excluir: "+e.message,"error"); }
            setConfirmarExclusao(null);
          }}
        />
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
