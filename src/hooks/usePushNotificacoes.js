// src/hooks/usePushNotificacoes.js
import { useState, useEffect, useCallback } from "react";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { subscribePush, unsubscribePush, getSubscription, pushSupported, notificationPermission } from "../services/pushNotifications";

export function usePushNotificacoes(uid) {
  const [ativo,        setAtivo]        = useState(false);
  const [permissao,    setPermissao]    = useState(notificationPermission());
  const [carregando,   setCarregando]   = useState(false);
  const suportado = pushSupported();

  // Verifica subscrição existente ao montar
  useEffect(() => {
    if (!suportado || !uid) return;
    getSubscription().then(sub => setAtivo(!!sub));
    setPermissao(notificationPermission());
  }, [uid, suportado]);

  const ativar = useCallback(async () => {
    if (!uid || carregando) return;
    setCarregando(true);
    try {
      const sub = await subscribePush();
      if (!sub) { setCarregando(false); return; }
      // Salva subscription no Firestore para o servidor enviar pushes
      await setDoc(doc(db, "pushSubscriptions", uid), {
        ...sub.toJSON(),
        uid,
        atualizadoEm: new Date().toISOString(),
      });
      setAtivo(true);
      setPermissao("granted");
    } catch (e) {
      console.error("[Push] Erro ao ativar:", e);
    } finally {
      setCarregando(false);
    }
  }, [uid, carregando]);

  const desativar = useCallback(async () => {
    if (!uid || carregando) return;
    setCarregando(true);
    try {
      await unsubscribePush();
      await deleteDoc(doc(db, "pushSubscriptions", uid));
      setAtivo(false);
    } catch (e) {
      console.error("[Push] Erro ao desativar:", e);
    } finally {
      setCarregando(false);
    }
  }, [uid, carregando]);

  return { ativo, permissao, suportado, carregando, ativar, desativar };
}
