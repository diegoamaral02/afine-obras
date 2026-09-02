// src/hooks/usePushNotificacoes.js
import { useEffect } from "react";
import { registrarTokenPush, ouvirMensagensForeground } from "../services/pushNotificacoes";

export function usePushNotificacoes(uid, onMensagem) {
  useEffect(() => {
    if (!uid) return;
    let cleanup = () => {};
    registrarTokenPush(uid);
    ouvirMensagensForeground(onMensagem).then(unsub => { cleanup = unsub; });
    return () => cleanup();
  }, [uid]); // eslint-disable-line
}
