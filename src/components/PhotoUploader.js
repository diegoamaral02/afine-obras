// src/components/PhotoUploader.js — camera + gallery, optional minFotos
import React, { useRef, useState } from "react";

const DEFAULT_MIN = 15;

function comprimirImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width>MAX||height>MAX) {
          if (width>height) { height=Math.round(height*MAX/width); width=MAX; }
          else { width=Math.round(width*MAX/height); height=MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width=width; canvas.height=height;
        canvas.getContext("2d").drawImage(img,0,0,width,height);
        resolve({ base64: canvas.toDataURL("image/jpeg",0.70), nome: file.name });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoUploader({ fotos, onChange, minFotos }) {
  const MIN      = minFotos !== undefined ? minFotos : DEFAULT_MIN;
  const cameraRef  = useRef();
  const galeriaRef = useRef();
  const [loading,  setLoading]  = useState(false);
  const [editIdx,  setEditIdx]  = useState(null);

  async function handleFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setLoading(true);
    try {
      const novas = await Promise.all(
        files.map(async f => { const {base64,nome}=await comprimirImagem(f); return {base64,nome,caption:"",addedAt:new Date().toISOString()}; })
      );
      onChange([...fotos,...novas]);
    } catch(err) { alert("Erro ao processar foto: "+err.message); }
    setLoading(false);
    e.target.value="";
  }

  function remover(idx) { onChange(fotos.filter((_,i)=>i!==idx)); }
  function salvarCaption(idx,val) { onChange(fotos.map((f,i)=>i===idx?{...f,caption:val}:f)); setEditIdx(null); }

  const count = fotos.length;
  const ok    = MIN===0 || count>=MIN;
  const faltam= Math.max(0,MIN-count);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <label style={{fontSize:12,fontWeight:600,color:"#4A4A4A"}}>
          Fotos {MIN>0&&<span style={{color:"var(--vermelho)"}}>*</span>}
        </label>
        {MIN>0 && (
          <span style={{fontSize:12,fontWeight:600,color:ok?"var(--verde)":"var(--vermelho)"}}>
            {count}/{MIN} {ok?"✓":`(faltam ${faltam})`}
          </span>
        )}
        {MIN===0 && <span style={{fontSize:12,color:"#7A7A7A"}}>{count} foto{count!==1?"s":""}</span>}
      </div>

      {MIN>0 && !ok && (
        <div className="alert alert-warning" style={{marginBottom:10,fontSize:12}}>
          ⚠ Mínimo <strong>{MIN} fotos</strong> com descrição. Faltam <strong>{faltam}</strong>.
        </div>
      )}

      <div className="photo-grid">
        {fotos.map((foto,idx)=>(
          <div key={idx} className="photo-thumb">
            <img src={foto.base64} alt={foto.caption||"foto"}/>
            <button className="photo-del" onClick={()=>remover(idx)}>×</button>
            {editIdx===idx ? (
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,.85)",padding:4}}>
                <input autoFocus defaultValue={foto.caption}
                  onBlur={e=>salvarCaption(idx,e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&salvarCaption(idx,e.target.value)}
                  style={{width:"100%",fontSize:10,padding:"2px 4px",borderRadius:3,border:"none"}}/>
              </div>
            ) : (
              <div className="photo-caption" onClick={()=>setEditIdx(idx)} title="Clique para descrever"
                style={{cursor:"text",color:foto.caption?"#fff":"rgba(255,255,255,.5)"}}>
                {foto.caption||"+ descrição"}
              </div>
            )}
          </div>
        ))}

        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <button className="photo-add" onClick={()=>cameraRef.current.click()} disabled={loading}
            style={{flex:1,borderColor:"var(--afine-yellow-dk)",color:"var(--afine-yellow-dk)"}}>
            {loading?<span style={{fontSize:11}}>...</span>:<><span style={{fontSize:18}}>📷</span><span style={{fontSize:10}}>Câmera</span></>}
          </button>
          <button className="photo-add" onClick={()=>galeriaRef.current.click()} disabled={loading} style={{flex:1}}>
            <span style={{fontSize:18}}>🖼️</span><span style={{fontSize:10}}>Galeria</span>
          </button>
        </div>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFiles} style={{display:"none"}}/>
      <input ref={galeriaRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{display:"none"}}/>
      <p style={{fontSize:11,color:"#7A7A7A",marginTop:6}}>Fotos comprimidas automaticamente. Clique na foto para adicionar descrição.</p>
    </div>
  );
}
