// src/utils/exportExcel.js
// Exportação para CSV/Excel sem dependência externa
// Abre direto no Excel quando baixado como .csv

export function exportarExcel(dados, nomeArquivo, colunas) {
  if (!dados || dados.length === 0) { alert("Nenhum dado para exportar."); return; }
  try {
    // Cabeçalho
    const header = colunas.map(c => `"${c.header}"`).join(";");
    // Linhas
    const rows = dados.map(row =>
      colunas.map(col => {
        const val = col.format ? col.format(row[col.key]) : (row[col.key] ?? "");
        return `"${String(val).replace(/"/g,'""')}"`;
      }).join(";")
    );
    const csv = "\uFEFF" + [header, ...rows].join("\r\n"); // BOM para Excel reconhecer UTF-8
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${nomeArquivo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch(err) {
    alert("Erro ao exportar: " + err.message);
    return false;
  }
}

export function BtnExcel({ onClick, disabled }) {
  return (
    <button className="btn btn-sm" onClick={onClick} disabled={disabled} title="Exportar para Excel (CSV)" style={{ gap:4 }}>
      📊 Excel
    </button>
  );
}
