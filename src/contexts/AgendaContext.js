// src/contexts/AgendaContext.js — v2: filtrado por perfil + memoizado
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, limit, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const AgendaContext = createContext();
export function useAgenda() { return useContext(AgendaContext); }

export function AgendaProvider({ children }) {
  const { currentUser, userProfile } = useAuth();
  const [agendamentos, setAgendamentos] = useState([]);
  const [obras,        setObras]        = useState([]);
  const [manutencoes,  setManutencoes]  = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading,      setLoading]      = useState(true);

  // Detecta perfil considerando tanto o sistema novo (departamento) quanto o legado (perfil)
  // BUG CORRIGIDO: antes só olhava userProfile.perfil, então usuários com apenas
  // "departamento" definido (ex: gestao, financeiro) caíam no fallback "campo".
  const dep = userProfile?.departamento || userProfile?.perfil || "campo";
  const isCampo = userProfile?.adm !== true && dep === "campo";
  const isGestor = !isCampo;

  useEffect(() => {
    if (!currentUser) return;

    // Agendamentos: campo vê só os seus, demais perfis veem todos
    // BUG CORRIGIDO: a consulta de "campo" combinava where(array-contains) + orderBy,
    // o que exige um índice composto no Firestore. Sem esse índice, o onSnapshot
    // nunca disparava (nem sucesso nem erro), deixando o calendário "carregando"
    // para sempre. Agora ordenamos no cliente em vez de depender do índice.
    const qAg = isGestor
      ? query(collection(db,"agendamentos"), orderBy("dataInicio","desc"), limit(200))
      : query(collection(db,"agendamentos"),
          where("funcionarios","array-contains", currentUser.uid), limit(100));

    const u1 = onSnapshot(qAg, snap => {
      const lista = snap.docs.map(d=>({id:d.id,...d.data()}));
      if (!isGestor) lista.sort((a,b)=> (b.dataInicio||"").localeCompare(a.dataInicio||""));
      setAgendamentos(lista);
      setLoading(false);
    }, () => setLoading(false));

    // Obras: campo vê só as permitidas
    const qObras = isGestor
      ? collection(db,"obras")
      : query(collection(db,"obras"), where("__name__","in",
          userProfile?.obras?.length > 0 ? userProfile.obras.slice(0,10) : ["__none__"]));

    const u2 = onSnapshot(qObras, snap => setObras(snap.docs.map(d=>({id:d.id,...d.data()}))), ()=>{});

    // Manutenções: todos autenticados podem ver (campo vê as que está alocado)
    const u3 = onSnapshot(
      query(collection(db,"manutencoes"), limit(100)),
      snap => setManutencoes(snap.docs.map(d=>({id:d.id,...d.data()}))), ()=>{}
    );

    // Funcionários: apenas perfis de gestão precisam da lista completa
    let u4 = ()=>{};
    if (isGestor) {
      u4 = onSnapshot(collection(db,"usuarios"), snap =>
        setFuncionarios(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="ATIVO"||!f.status))
      , ()=>{});
    }

    return ()=>{u1();u2();u3();u4();};
  }, [currentUser, isGestor]);

  // Memoizados para não recalcular a cada render
  const agendamentosDodia = useCallback((dataISO) =>
    agendamentos.filter(a => a.dataInicio <= dataISO && a.dataFim >= dataISO),
    [agendamentos]
  );

  const agendaFuncionario = useCallback((funcId, dataISO) =>
    agendamentos.filter(a =>
      a.dataInicio <= dataISO && a.dataFim >= dataISO &&
      (a.funcionarios||[]).includes(funcId)
    ), [agendamentos]
  );

  const funcOcupado = useCallback((funcId, dataInicio, dataFim, ignorarId) =>
    agendamentos.some(a =>
      a.id !== ignorarId &&
      (a.funcionarios||[]).includes(funcId) &&
      a.dataInicio <= dataFim && a.dataFim >= dataInicio
    ), [agendamentos]
  );

  const equipeHoje = useCallback((obraId) => {
    const hoje = new Date().toISOString().split("T")[0];
    const agsHoje = agendamentos.filter(a =>
      a.dataInicio <= hoje && a.dataFim >= hoje &&
      (!obraId || a.demandaId === obraId)
    );
    const funcIds = [...new Set(agsHoje.flatMap(a=>a.funcionarios||[]))];
    return funcionarios.filter(f => funcIds.includes(f.id)||funcIds.includes(f.uid));
  }, [agendamentos, funcionarios]);

  async function criarAgendamento(payload) {
    const agora = new Date().toISOString();
    const docRef = await addDoc(collection(db,"agendamentos"), { ...payload, createdAt:agora, updatedAt:agora });
    if (payload.demandaTipo==="obra" && payload.demandaId) {
      await updateDoc(doc(db,"obras",payload.demandaId), { inicio:payload.dataInicio, termino:payload.dataFim, updatedAt:agora });
    }
    return docRef.id;
  }

  async function atualizarAgendamento(id, payload) {
    const agora = new Date().toISOString();
    await updateDoc(doc(db,"agendamentos",id), { ...payload, updatedAt:agora });
    if (payload.demandaTipo==="obra" && payload.demandaId) {
      await updateDoc(doc(db,"obras",payload.demandaId), { inicio:payload.dataInicio, termino:payload.dataFim, updatedAt:agora });
    }
  }

  const value = useMemo(() => ({
    agendamentos, obras, manutencoes, funcionarios, loading,
    agendamentosDodia, agendaFuncionario, funcOcupado,
    criarAgendamento, atualizarAgendamento, equipeHoje,
  }), [agendamentos, obras, manutencoes, funcionarios, loading,
      agendamentosDodia, agendaFuncionario, funcOcupado, equipeHoje]);

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>;
}
