// src/hooks/usePushNotificacoes.js
import { useEffect } from "react";
import { registrarTokenPush, ouvirMensagensForeground } from "../services/pushNotificacoes";

export function usePushNotificacoes(uid, onMensagem) {
  useEffect(() => {
    if (!uid) return;
    registrarTokenPush(uid);
    const unsub = ouvirMensagensForeground(onMensagem);
    return () => unsub?.();
  }, [uid]); // eslint-disable-line
}
