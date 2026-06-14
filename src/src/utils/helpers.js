// src/utils/helpers.js

export function statusBadge(status) {
  const map = {
    "CONCLUÍDO":     "badge-green",
    "EM ANDAMENTO":  "badge-blue",
    "NÃO INICIADO":  "badge-gray",
    "PARALISADO":    "badge-red",
    "ATIVO":         "badge-green",
    "AFASTADO":      "badge-amber",
    "DESLIGADO":     "badge-gray",
    "ABERTA":        "badge-red",
    "EM TRATAMENTO": "badge-amber",
    "CONCLUÍDA":     "badge-green",
    "CANCELADA":     "badge-gray",
  };
  return map[status] || "badge-gray";
}

export function pctColor(pct) {
  if (pct === 100) return "green";
  if (pct >= 60)   return "blue";
  if (pct >= 30)   return "amber";
  return "red";
}

export function fmtDate(iso) {
  if (!iso) return "–";
  const d = iso.toDate ? iso.toDate() : new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export function initials(nome = "") {
  return nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

export function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

// Retorna classe de cor por tipo de escopo
export function tipoColor(tipo) {
  const map = {
    "manutenção":  "badge-amber",
    "reforma":     "badge-blue",
    "instalação":  "badge-purple",
  };
  return map[(tipo || "").toLowerCase()] || "badge-gray";
}
