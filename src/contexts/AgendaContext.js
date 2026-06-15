// src/contexts/AgendaContext.js
// Estado unificado: agendamentos refletem em Equipe, Diário, Funcionários e Financeiro
import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";

const AgendaContext = createContext();
export function useAgenda() { return useContext(AgendaContext); }

export function AgendaProvider({ children }) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [obras,        setObras]        = useState([]);
  const [manutencoes,  setManutencoes]  = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"agendamentos"), snap => {
      const data = snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(a.dataInicio||"").localeCompare(b.dataInicio||""));
      setAgendamentos(data);
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db,"obras"), snap =>
      setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3 = onSnapshot(collection(db,"manutencoes"), snap =>
      setManutencoes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4 = onSnapshot(collection(db,"usuarios"), snap =>
      setFuncionarios(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="ATIVO"||!f.status)));
    return ()=>{u1();u2();u3();u4();};
  },[]);

  // Retorna agendamentos de uma data específica
  function agendamentosDodia(dataISO) {
    return agendamentos.filter(a =>
      a.dataInicio <= dataISO && a.dataFim >= dataISO
    );
  }

  // Retorna agendamentos de um funcionário numa data
  function agendaFuncionario(funcId, dataISO) {
    return agendamentos.filter(a =>
      a.dataInicio <= dataISO && a.dataFim >= dataISO &&
      (a.funcionarios||[]).includes(funcId)
    );
  }

  // Verifica se funcionário está ocupado numa data
  function funcOcupado(funcId, dataInicio, dataFim, ignorarId) {
    return agendamentos.some(a =>
      a.id !== ignorarId &&
      (a.funcionarios||[]).includes(funcId) &&
      a.dataInicio <= dataFim && a.dataFim >= dataInicio
    );
  }

  // Criar agendamento
  async function criarAgendamento(payload) {
    const agora = new Date().toISOString();
    const doc_ = await addDoc(collection(db,"agendamentos"), { ...payload, createdAt: agora, updatedAt: agora });
    // Atualiza obra/manutenção com datas se informado
    if (payload.demandaTipo === "obra" && payload.demandaId) {
      await updateDoc(doc(db,"obras",payload.demandaId), {
        inicio: payload.dataInicio, termino: payload.dataFim, updatedAt: agora
      });
    }
    return doc_.id;
  }

  async function atualizarAgendamento(id, payload) {
    const agora = new Date().toISOString();
    await updateDoc(doc(db,"agendamentos",id), { ...payload, updatedAt: agora });
    if (payload.demandaTipo === "obra" && payload.demandaId) {
      await updateDoc(doc(db,"obras",payload.demandaId), {
        inicio: payload.dataInicio, termino: payload.dataFim, updatedAt: agora
      });
    }
  }

  // Retorna equipe do dia (para RDO e Equipe)
  function equipeHoje(obraId) {
    const hoje = new Date().toISOString().split("T")[0];
    const agsHoje = agendamentos.filter(a =>
      a.dataInicio <= hoje && a.dataFim >= hoje &&
      (!obraId || a.demandaId === obraId)
    );
    const funcIds = [...new Set(agsHoje.flatMap(a=>a.funcionarios||[]))];
    return funcionarios.filter(f => funcIds.includes(f.id)||funcIds.includes(f.uid));
  }

  return (
    <AgendaContext.Provider value={{
      agendamentos, obras, manutencoes, funcionarios, loading,
      agendamentosDodia, agendaFuncionario, funcOcupado,
      criarAgendamento, atualizarAgendamento, equipeHoje,
    }}>
      {children}
    </AgendaContext.Provider>
  );
}
