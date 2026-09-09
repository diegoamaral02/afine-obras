import { useState, useMemo, useCallback } from "react";

// usePagination: pagina um array já filtrado
// Retorna: { itens, pagina, totalPaginas, irPara, proxima, anterior, PaginacaoUI }
export function usePagination(lista, porPagina = 20) {
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaReal   = Math.min(pagina, totalPaginas);

  const itens = useMemo(() =>
    lista.slice((paginaReal - 1) * porPagina, paginaReal * porPagina),
    [lista, paginaReal, porPagina]
  );

  const irPara   = useCallback(p => setPagina(Math.max(1, Math.min(p, totalPaginas))), [totalPaginas]);
  const proxima  = useCallback(() => irPara(paginaReal + 1), [irPara, paginaReal]);
  const anterior = useCallback(() => irPara(paginaReal - 1), [irPara, paginaReal]);

  // Reset para página 1 quando a lista muda de tamanho (novo filtro)
  const totalRef = lista.length;
  useMemo(() => { setPagina(1); }, [totalRef]); // eslint-disable-line

  function PaginacaoUI() {
    if (totalPaginas <= 1) return null;
    const pages = [];
    const range = 2;
    for (let i = 1; i <= totalPaginas; i++) {
      if (i === 1 || i === totalPaginas || (i >= paginaReal - range && i <= paginaReal + range)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:16,flexWrap:"wrap"}}>
        <button className="btn btn-sm" onClick={anterior} disabled={paginaReal<=1}>‹</button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={i} style={{padding:"4px 6px",fontSize:12,color:"var(--cinza-med)"}}>…</span>
          ) : (
            <button key={p} className={`btn btn-sm${p===paginaReal?" btn-primary":""}`} onClick={()=>irPara(p)}>{p}</button>
          )
        )}
        <button className="btn btn-sm" onClick={proxima} disabled={paginaReal>=totalPaginas}>›</button>
        <span style={{fontSize:11,color:"var(--cinza-med)",marginLeft:4}}>
          {lista.length} itens · pág {paginaReal}/{totalPaginas}
        </span>
      </div>
    );
  }

  return { itens, pagina: paginaReal, totalPaginas, irPara, proxima, anterior, PaginacaoUI };
}
