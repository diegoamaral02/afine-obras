// src/components/AssinaturaDigital.js
// Componente de assinatura digital via tela touch/mouse
import React, { useRef, useEffect, useState } from "react";

export default function AssinaturaDigital({ label, assinatura, onChange }) {
  const canvasRef = useRef(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(!!assinatura);
  const [confirmado, setConfirmado] = useState(!!assinatura);
  const ultimoPonto = useRef(null);

  useEffect(() => {
    if (assinatura && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = assinatura;
    }
  }, []);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function iniciar(e) {
    e.preventDefault();
    setDesenhando(true);
    setConfirmado(false);
    const pos = getPos(e, canvasRef.current);
    ultimoPonto.current = pos;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function desenhar(e) {
    e.preventDefault();
    if (!desenhando) return;
    const pos = getPos(e, canvasRef.current);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ultimoPonto.current = pos;
    setTemAssinatura(true);
  }

  function parar(e) {
    e.preventDefault();
    setDesenhando(false);
  }

  function limpar() {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setTemAssinatura(false);
    setConfirmado(false);
    onChange(null);
  }

  function confirmar() {
    const base64 = canvasRef.current.toDataURL("image/png");
    onChange(base64);
    setConfirmado(true);
  }

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
        {label} <span style={{ color: "var(--vermelho)" }}>*</span>
      </label>

      {confirmado ? (
        <div style={{ border: "1px solid var(--verde)", borderRadius: 8, padding: 10, background: "var(--verde-lt)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--verde)", fontWeight: 600 }}>✓ Assinatura registrada</span>
            <button className="btn btn-sm" onClick={limpar} style={{ fontSize: 11 }}>Refazer</button>
          </div>
          <img src={assinatura} alt="Assinatura" style={{ maxWidth: "100%", maxHeight: 80, border: "1px solid #ddd", borderRadius: 4, background: "#fff" }} />
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: "var(--cinza-med)", marginBottom: 6 }}>
            {label.includes("Gerente") ? "📱 Entregue o celular ao gerente para assinar abaixo:" : "✍️ Assine no espaço abaixo:"}
          </div>
          <div style={{ position: "relative", border: "2px dashed #ccc", borderRadius: 8, background: "#fafafa", touchAction: "none" }}>
            <canvas
              ref={canvasRef}
              width={500}
              height={140}
              style={{ display: "block", width: "100%", height: 140, cursor: "crosshair", borderRadius: 6 }}
              onMouseDown={iniciar}
              onMouseMove={desenhar}
              onMouseUp={parar}
              onMouseLeave={parar}
              onTouchStart={iniciar}
              onTouchMove={desenhar}
              onTouchEnd={parar}
            />
            {!temAssinatura && (
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 13, color: "#bbb", pointerEvents: "none", textAlign: "center" }}>
                ✍️ Assine aqui com o dedo ou mouse
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-sm" onClick={limpar} disabled={!temAssinatura}>Limpar</button>
            <button className="btn btn-sm btn-primary" onClick={confirmar} disabled={!temAssinatura} style={{ flex: 1, justifyContent: "center" }}>
              ✓ Confirmar assinatura
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
