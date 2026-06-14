// src/utils/cep.js — busca CEP com múltiplas APIs para evitar CORS no Vercel

export async function buscarCEP(cep) {
  const c = cep.replace(/\D/g, "");
  if (c.length !== 8) return null;

  // Tenta ViaCEP primeiro
  try {
    const r = await fetch(`https://viacep.com.br/ws/${c}/json/`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const d = await r.json();
      if (!d.erro) return { logradouro: d.logradouro||"", bairro: d.bairro||"", cidade: d.localidade||"", uf: d.uf||"" };
    }
  } catch {}

  // Fallback: BrasilAPI (sem CORS)
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${c}`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const d = await r.json();
      return { logradouro: d.street||"", bairro: d.neighborhood||"", cidade: d.city||"", uf: d.state||"" };
    }
  } catch {}

  return null;
}

export function formatarCEP(value) {
  return value.replace(/\D/g,"").replace(/(\d{5})(\d)/,"$1-$2").slice(0,9);
}

export function formatarCNPJ(value) {
  return value.replace(/\D/g,"")
    .replace(/(\d{2})(\d)/,"$1.$2")
    .replace(/(\d{3})(\d)/,"$1.$2")
    .replace(/(\d{3})(\d)/,"$1/$2")
    .replace(/(\d{4})(\d)/,"$1-$2")
    .slice(0,18);
}

export function formatarTelefone(value) {
  const n = value.replace(/\D/g,"");
  if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d)/,"($1) $2-$3").slice(0,13);
  return n.replace(/(\d{2})(\d{5})(\d)/,"($1) $2-$3").slice(0,15);
}
