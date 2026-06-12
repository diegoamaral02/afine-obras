// src/components/PhotoUploader.js — com opção câmera ou galeria
import React, { useRef, useState } from "react";

const MIN_PHOTOS = 15;

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
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve({ base64: canvas.toDataURL("image/jpeg", 0.70), nome: file.name });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoUploader({ fotos, onChange }) {
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
        files.map(async (file) => {
          const { base64, nome } = await comprimirImagem(file);
          return { base64, nome, caption: "", addedAt: new Date().toISOString() };
        })
      );
      onChange([...fotos, ...novas]);
    } catch (err) { alert("Erro ao processar foto: " + err.message); }
    setLoading(false);
    e.target.value = "";
  }

  function remover(idx) { onChange(fotos.filter((_, i) => i !== idx)); }
  function salvarCaption(idx, val) {
    onChange(fotos.map((f, i) => i === idx ? { ...f, caption: val } : f));
    setEditIdx(null);
  }

  const count  = fotos.length;
  const faltam = Math.max(0, MIN_PHOTOS - count);
  const ok     = count >= MIN_PHOTOS;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <label style={{ fontSize:12, fontWeight:600, color:"#444" }}>
          Fotos do serviço <span style={{ color:"var(--vermelho)" }}>*</span>
        </label>
        <span style={{ fontSize:12, fontWeight:600, color: ok?"var(--verde)":"var(--vermelho)" }}>
          {count} / {MIN_PHOTOS} {ok ? "✓" : `(faltam ${faltam})`}
        </span>
      </div>

      {!ok && (
        <div className="alert alert-warning" style={{ marginBottom:10, fontSize:12 }}>
          ⚠ Mínimo <strong>{MIN_PHOTOS} fotos</strong> obrigatórias. Faltam <strong>{faltam}</strong>.
        </div>
      )}

      <div className="photo-grid">
        {fotos.map((foto, idx) => (
          <div key={idx} className="photo-thumb">
            <img src={foto.base64} alt={foto.caption || "foto"} />
            <button className="photo-del" onClick={() => remover(idx)}>×</button>
            {editIdx === idx ? (
              <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,.85)", padding:4 }}>
                <input autoFocus defaultValue={foto.caption}
                  onBlur={e => salvarCaption(idx, e.target.value)}
                  onKeyDown={e => e.key==="Enter" && salvarCaption(idx, e.target.value)}
                  style={{ width:"100%", fontSize:10, padding:"2px 4px", borderRadius:3, border:"none" }}
                />
              </div>
            ) : (
              <div className="photo-caption" onClick={() => setEditIdx(idx)}
                title="Clique para descrever"
                style={{ cursor:"text", color: foto.caption?"#fff":"rgba(255,255,255,.5)" }}>
                {foto.caption || "+ descrição"}
              </div>
            )}
          </div>
        ))}

        {/* Botões separados: câmera e galeria */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <button className="photo-add" onClick={() => cameraRef.current.click()} disabled={loading}
            style={{ flex:1, borderColor:"var(--azul-med)", color:"var(--azul-med)" }}>
            {loading ? <span style={{fontSize:11}}>...</span> : <><span style={{fontSize:20}}>📷</span><span style={{fontSize:11}}>Câmera</span></>}
          </button>
          <button className="photo-add" onClick={() => galeriaRef.current.click()} disabled={loading}
            style={{ flex:1 }}>
            <span style={{fontSize:20}}>🖼️</span><span style={{fontSize:11}}>Galeria</span>
          </button>
        </div>
      </div>

      {/* Input câmera — abre câmera diretamente */}
      <input ref={cameraRef} type="file" accept="image/*" multiple capture="environment"
        onChange={handleFiles} style={{ display:"none" }} />
      {/* Input galeria — abre galeria de fotos */}
      <input ref={galeriaRef} type="file" accept="image/*" multiple
        onChange={handleFiles} style={{ display:"none" }} />

      <p style={{ fontSize:11, color:"var(--cinza-med)", marginTop:6 }}>
        Fotos comprimidas e salvas no banco. Nenhum custo adicional.
      </p>
    </div>
  );
}
