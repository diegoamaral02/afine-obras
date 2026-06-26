// src/hooks/useFilaOffline.js
import { useState, useEffect, useCallback, useRef } from "react";
import { tamanhoFila, processarFila } from "../utils/offlineQueue";

// Mapa global de executores — cada página que precisa de fallback offline
// registra aqui como reenviar seu próprio tipo de payload. Fica fora do
// componente porque a fila pode ter itens de páginas que não estão mais
// montadas (ex: o usuário saiu da tela de Obras antes de reconectar).
const executoresGlobais = {};
export function registrarExecutorOffline(tipo, fn) {
  executoresGlobais[tipo] = fn;
}

export function useFilaOffline() {
  const [pendentes, setPendentes] = useState(() => tamanhoFila());
  const [sincronizando, setSincronizando] = useState(false);
  const tentandoRef = useRef(false);

  const tentarSincronizar = useCallback(async () => {
    if (tentandoRef.current) return; // evita rodar 2x ao mesmo tempo
    if (tamanhoFila() === 0) return;
    tentandoRef.current = true;
    setSincronizando(true);
    try {
      await processarFila(executoresGlobais);
    } finally {
      setPendentes(tamanhoFila());
      setSincronizando(false);
      tentandoRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Atualiza o contador periodicamente (outros componentes podem enfileirar)
    const interval = setInterval(() => setPendentes(tamanhoFila()), 4000);
    // Tenta sincronizar automaticamente quando a internet volta
    window.addEventListener("online", tentarSincronizar);
    // Tenta uma vez ao montar, caso já esteja online com itens pendentes de uma sessão anterior
    tentarSincronizar();
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", tentarSincronizar);
    };
  }, [tentarSincronizar]);

  return { pendentes, sincronizando, tentarSincronizar };
}
