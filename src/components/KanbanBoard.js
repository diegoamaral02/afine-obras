// src/components/KanbanBoard.js
// Componente genérico de Kanban com drag-and-drop nativo (sem lib externa)
import React, { useState, useRef } from "react";

export function KanbanCard({ card, onEdit, colColor }) {
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData("cardId", card.id)}
      style={{
        background:"#fff", borderRadius:8, padding:"10px 12px",
        marginBottom:8, cursor:"grab", userSelect:"none",
        border:"1px solid var(--border)",
        borderLeft:`3px solid ${colColor||"var(--afine-yellow)"}`,
        boxShadow:"0 1px 4px rgba(0,0,0,.06)",
        transition:"box-shadow .15s, transform .15s",
      }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.12)";e.currentTarget.style.transform="translateY(-1px)";}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.06)";e.currentTarget.style.transform="";}}
    >
      {/* Título */}
      <div style={{fontWeight:600,fontSize:13,color:"#1A1A1A",marginBottom:4,lineHeight:1.3}}>
        {card.titulo||card.nome||card.title||"–"}
      </div>
      {/* Subtítulo */}
      {(card.subtitulo||card.cliente||card.sub) && (
        <div style={{fontSize:11,color:"#7A7A7A",marginBottom:6}}>
          {card.subtitulo||card.cliente||card.sub}
        </div>
      )}
      {/* Tags */}
      {card.tags && (
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
          {card.tags.map((t,i)=>(
            <span key={i} style={{fontSize:10,background:"var(--afine-yellow-lt)",color:"var(--afine-yellow-dk)",padding:"2px 6px",borderRadius:10,fontWeight:600}}>{t}</span>
          ))}
        </div>
      )}
      {/* Footer */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
        {card.valor && (
          <span style={{fontSize:11,fontWeight:700,color:"var(--verde)"}}>
            R$ {Number(card.valor).toLocaleString("pt-BR",{minimumFractionDigits:0})}
          </span>
        )}
        {card.prazo && (
          <span style={{fontSize:10,color:"#7A7A7A",marginLeft:"auto"}}>
            📅 {new Date(card.prazo).toLocaleDateString("pt-BR")}
          </span>
        )}
        {card.responsavel && (
          <span style={{
            width:22,height:22,borderRadius:"50%",background:"#1A1A1A",
            color:"#F5C800",fontSize:9,fontWeight:700,display:"flex",
            alignItems:"center",justifyContent:"center",marginLeft:6,flexShrink:0
          }}>
            {card.responsavel.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
          </span>
        )}
        {onEdit && (
          <button onClick={e=>{e.stopPropagation();onEdit(card);}}
            style={{background:"none",border:"none",cursor:"pointer",fontSize:13,opacity:.4,
              padding:"0 2px",marginLeft:4,lineHeight:1}}
            onMouseEnter={e=>e.currentTarget.style.opacity=1}
            onMouseLeave={e=>e.currentTarget.style.opacity=.4}>
            ✏️
          </button>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({
  colunas,          // [{ id, titulo, cor, icone }]
  cards,            // [{ id, coluna, titulo, ... }]
  onMover,          // (cardId, novaColuna) => void
  onNovoCard,       // (colunaId) => void
  onEditCard,       // (card) => void
  renderCard,       // opcional: render customizado
}) {
  const [dragOver, setDragOver] = useState(null);

  function handleDrop(e, colunaId) {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("cardId");
    if (cardId && onMover) onMover(cardId, colunaId);
    setDragOver(null);
  }

  return (
    <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:8,alignItems:"flex-start",minHeight:400}}>
      {colunas.map(col => {
        const cardsCol = cards.filter(c => c.coluna === col.id || c.status === col.id);
        const isDragOver = dragOver === col.id;
        return (
          <div key={col.id}
            style={{
              minWidth:240,width:240,flexShrink:0,
              background: isDragOver ? "rgba(245,200,0,.08)" : "var(--cinza-lt)",
              borderRadius:10,
              border:`2px solid ${isDragOver ? "var(--afine-yellow)" : "transparent"}`,
              transition:"border-color .15s,background .15s",
            }}
            onDragOver={e=>{e.preventDefault();setDragOver(col.id);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(null);}}
            onDrop={e=>handleDrop(e,col.id)}
          >
            {/* Cabeçalho da coluna */}
            <div style={{
              padding:"10px 12px",borderRadius:"8px 8px 0 0",
              background:col.cor||"#1A1A1A",
              display:"flex",alignItems:"center",justifyContent:"space-between",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {col.icone && <span style={{fontSize:14}}>{col.icone}</span>}
                <span style={{fontSize:12,fontWeight:700,color:"#fff",letterSpacing:".03em"}}>{col.titulo}</span>
              </div>
              <span style={{
                background:"rgba(255,255,255,.2)",color:"#fff",
                fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:10,
              }}>{cardsCol.length}</span>
            </div>

            {/* Cards */}
            <div style={{padding:"8px 8px 4px",minHeight:120}}>
              {cardsCol.length === 0 && (
                <div style={{
                  textAlign:"center",padding:"20px 8px",fontSize:11,
                  color:"#7A7A7A",border:"2px dashed #E0DED8",borderRadius:6,
                }}>
                  Solte aqui
                </div>
              )}
              {cardsCol.map(card => (
                renderCard
                  ? renderCard(card, col)
                  : <KanbanCard key={card.id} card={card} colColor={col.cor} onEdit={onEditCard}/>
              ))}
            </div>

            {/* Botão novo card */}
            {onNovoCard && (
              <button onClick={() => onNovoCard(col.id)}
                style={{
                  display:"flex",alignItems:"center",gap:6,width:"100%",
                  padding:"8px 12px",background:"none",border:"none",
                  color:"#7A7A7A",fontSize:12,cursor:"pointer",
                  borderTop:"1px solid var(--border)",borderRadius:"0 0 8px 8px",
                  transition:"background .15s",
                }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,.04)"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}
              >
                <span style={{fontSize:16,lineHeight:1}}>+</span> Novo card
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
