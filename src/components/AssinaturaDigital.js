// src/components/AssinaturaDigital.js
// Componente de assinatura digital via tela touch/mouse
// Suporta autenticação por geolocalização (usada para assinatura de gerente/responsável)
import React, { useRef, useEffect, useState } from "react";

export default function AssinaturaDigital({ label, assinatura, onChange, requererLocalizacao, geoInicial, onGeoChange }) {
  const canvasRef = useRef(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(!!assinatura);
  const [confirmado, setConfirmado] = useState(!!assinatura);
  const [geo, setGeo] = useState(geoInicial || null);
  const [buscandoGeo, setBuscandoGeo] = useState(false);
  const [erroGeo, setErroGeo] = useState("");
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

  // BUG CORRIGIDO: quando confirmado=true, o <canvas> não está montado no DOM
  // (só a <img>), então canvasRef.current era null e o "Refazer" travava aqui.
  function limpar() {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setTemAssinatura(false);
    setConfirmado(false);
    setGeo(null);
    setErroGeo("");
    onChange(null);
    if (onGeoChange) onGeoChange(null);
  }

  function obterLocalizacao() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalização não é suportada neste dispositivo/navegador."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao: Math.round(pos.coords.accuracy),
          capturadoEm: new Date().toISOString(),
        }),
        () => reject(new Error("Não foi possível obter a localização. Permita o acesso à localização do dispositivo para validar esta assinatura.")),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  async function confirmar() {
    const base64 = canvasRef.current.toDataURL("image/png");

    if (requererLocalizacao) {
      setBuscandoGeo(true);
      setErroGeo("");
      try {
        const geoData = await obterLocalizacao();
        setGeo(geoData);
        setBuscandoGeo(false);
        onChange(base64);
        if (onGeoChange) onGeoChange(geoData);
        setConfirmado(true);
      } catch (err) {
        setBuscandoGeo(false);
        setErroGeo(err.message);
      }
      return;
    }

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
          {requererLocalizacao && geo && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--verde)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              📍 Localização confirmada (precisão ~{geo.precisao}m) · {new Date(geo.capturadoEm).toLocaleString("pt-BR")}
              <a href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`} target="_blank" rel="noreferrer" style={{ color: "#185FA5" }}>ver no mapa</a>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: "var(--cinza-med)", marginBottom: 6 }}>
            {label.includes("Gerente") || label.toLowerCase().includes("responsável") ? "📱 Entregue o celular ao responsável para assinar abaixo:" : "✍️ Assine no espaço abaixo:"}
          </div>
          {requererLocalizacao && (
            <div className="alert alert-info" style={{ fontSize: 11, marginBottom: 8 }}>
              📍 Esta assinatura exige confirmação de localização do dispositivo, para autenticar a identidade do responsável.
            </div>
          )}
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
          {erroGeo && (
            <div className="alert alert-danger" style={{ fontSize: 11, marginTop: 8 }}>
              ⚠️ {erroGeo}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-sm" onClick={limpar} disabled={!temAssinatura}>Limpar</button>
            <button className="btn btn-sm btn-primary" onClick={confirmar} disabled={!temAssinatura || buscandoGeo} style={{ flex: 1, justifyContent: "center" }}>
              {buscandoGeo ? "📍 Obtendo localização..." : "✓ Confirmar assinatura"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
