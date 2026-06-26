// src/utils/offlineQueue.js — fila de salvamento offline
//
// Problema que resolve: em Obras/Manutenção, o Campo pode preencher fotos,
// materiais, checklist e assinatura, e só no clique de "Salvar" tudo isso vai
// pro Firestore de uma vez. Se a internet cair exatamente nesse momento (comum
// em obra), sem essa fila o trabalho inteiro seria perdido.
//
// Como funciona: se o salvamento falhar (ou já não houver conexão), o payload
// completo é guardado no localStorage (não se perde nem se a página recarregar
// ou o app for fechado). Quando a internet voltar, tenta enviar automaticamente.

const CHAVE = "afine_fila_offline_v1";

function lerFila() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "[]"); }
  catch { return []; }
}
function gravarFila(fila) {
  try { localStorage.setItem(CHAVE, JSON.stringify(fila)); }
  catch (err) { console.error("Não foi possível gravar a fila offline (localStorage cheio?):", err); }
}

// Adiciona um item à fila. `tipo` deve identificar a operação (ex: "obra:update"),
// `payload` é tudo que a função executora precisa pra refazer a operação depois.
export function enfileirar(tipo, payload) {
  const fila = lerFila();
  const item = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    tipo, payload,
    criadoEm: new Date().toISOString(),
    tentativas: 0,
    ultimoErro: null,
  };
  fila.push(item);
  gravarFila(fila);
  return item.id;
}

export function listarFila() { return lerFila(); }
export function tamanhoFila() { return lerFila().length; }

export function removerDaFila(id) {
  gravarFila(lerFila().filter(i => i.id !== id));
}

// Tenta processar todos os itens pendentes. `executores` é um mapa
// { "obra:update": async (payload) => {...}, "obra:create": async (payload) => {...}, ... }
// Cada item só sai da fila se a execução for bem-sucedida.
export async function processarFila(executores, onProgresso) {
  const fila = lerFila();
  if (fila.length === 0) return { sucesso: 0, falha: 0 };
  let sucesso = 0, falha = 0;

  for (const item of fila) {
    const executar = executores[item.tipo];
    if (!executar) { falha++; continue; } // tipo desconhecido — não trava a fila por isso
    try {
      await executar(item.payload);
      removerDaFila(item.id);
      sucesso++;
      onProgresso?.({ ...item, status: "ok" });
    } catch (err) {
      item.tentativas += 1;
      item.ultimoErro = err.message;
      falha++;
      onProgresso?.({ ...item, status: "erro", erro: err.message });
    }
  }
  // Persiste tentativas/erros atualizados dos itens que falharam
  gravarFila(lerFila().map(i => {
    const atualizado = fila.find(f => f.id === i.id);
    return atualizado ? { ...i, tentativas: atualizado.tentativas, ultimoErro: atualizado.ultimoErro } : i;
  }));

  return { sucesso, falha };
}

// Helper simples: roda uma operação; se falhar (rede ou qualquer erro) ou já
// estiver offline, enfileira automaticamente em vez de propagar o erro.
// Retorna { ok: true } se salvou direto, ou { ok: false, enfileirado: true } se foi pra fila.
export async function salvarComFallbackOffline(tipo, payload, executar) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enfileirar(tipo, payload);
    return { ok: false, enfileirado: true };
  }
  try {
    await executar(payload);
    return { ok: true };
  } catch (err) {
    // Erros de rede do Firestore geralmente vêm com code "unavailable" ou
    // a mensagem menciona "network" — mas, por segurança, enfileira em
    // QUALQUER falha de escrita: é melhor guardar de novo do que perder.
    enfileirar(tipo, payload);
    return { ok: false, enfileirado: true, erroOriginal: err };
  }
}
