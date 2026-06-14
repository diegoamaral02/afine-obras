// src/utils/exportExcel.js
// Exportação para Excel usando SheetJS (disponível no ambiente React)

export async function exportarExcel(dados, nomeArquivo, colunas) {
  try {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(dados.map(row => {
      const obj = {};
      colunas.forEach(col => {
        obj[col.header] = col.format ? col.format(row[col.key]) : (row[col.key] ?? "");
      });
      return obj;
    }));
    // Auto column widths
    const colWidths = colunas.map(col => ({ wch: Math.max(col.header.length, 16) }));
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
    return true;
  } catch (err) {
    alert("Erro ao exportar: " + err.message);
    return false;
  }
}

// Botão padrão de exportação
export function BtnExcel({ onClick, disabled }) {
  return (
    <button
      className="btn btn-sm"
      onClick={onClick}
      disabled={disabled}
      title="Exportar para Excel"
      style={{ gap: 4 }}
    >
      📊 Excel
    </button>
  );
}
