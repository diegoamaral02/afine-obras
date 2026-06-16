// src/hooks/useNotificacoes.js — notificações em tempo real
import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";

export function useNotificacoes(uid) {
  const [notifs,  setNotifs]  = useState([]);
  const [naoLidas,setNaoLidas]= useState(0);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "notificacoes", uid, "items"),
      orderBy("criadaEm","desc"),
      limit(30)
    );
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d=>({id:d.id,...d.data()}));
      setNotifs(data);
      setNaoLidas(data.filter(n=>!n.lida).length);
    });
  }, [uid]);

  const marcarLida = useCallback(async (notifId) => {
    if (!uid) return;
    await updateDoc(doc(db,"notificacoes",uid,"items",notifId),{ lida:true, lidaEm: new Date().toISOString() });
  }, [uid]);

  const marcarTodasLidas = useCallback(async () => {
    if (!uid) return;
    await Promise.all(notifs.filter(n=>!n.lida).map(n=>marcarLida(n.id)));
  }, [uid, notifs, marcarLida]);

  return { notifs, naoLidas, marcarLida, marcarTodasLidas };
}

// Envia notificação para um usuário
export async function enviarNotificacao(uidDestino, { titulo, corpo, tipo="info", link="" }) {
  if (!uidDestino) return;
  await addDoc(collection(db,"notificacoes",uidDestino,"items"), {
    titulo, corpo, tipo, link,
    lida: false, criadaEm: new Date().toISOString(),
  });
}

// Tipos de notificação para o sistema AFINE
export const NOTIF = {
  MANUT_URGENTE:   (titulo) => ({ titulo:"⚠️ Manutenção urgente",     corpo:`${titulo} aguarda atendimento`, tipo:"danger" }),
  COMPRA_APROVADA: (titulo) => ({ titulo:"✅ Compra aprovada",          corpo:`${titulo} foi aprovada`,        tipo:"success" }),
  VENCIMENTO:      (valor)  => ({ titulo:"💰 Vencimento próximo",       corpo:`Lançamento de R$ ${valor}`,     tipo:"warning" }),
  SEM_OT:          (titulo) => ({ titulo:"📋 S/OT pendente",            corpo:`${titulo} sem número de OT`,    tipo:"warning" }),
  OBRA_ATRASADA:   (nome)   => ({ titulo:"🏗️ Obra com desvio",         corpo:`${nome} está atrasada`,         tipo:"danger" }),
};
