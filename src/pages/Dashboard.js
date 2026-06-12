// src/pages/Dashboard.js
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { Link } from "react-router-dom";

export default function Dashboard({ obraAtual }) {
  const [obras,   setObras]   = useState([]);
  const [escopos, setEscopos] = useState([]);
  const [ocorr,   setOcorr]   = useState([]);

  // Listener: todas obras
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "obras"), snap => {
      setObras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Listener: escopos da obra ativa
  useEffect(() => {
    if (!obraAtual) return;
    const q = query(collection(db, "escopos"), where("obraId", "==", obraAtual));
    const unsub = onSnapshot(q, snap => {
      setEscopos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [obraAtual]);

  // Listener: ocorrências abertas da obra ativa
  useEffect(() => {
    if (!obraAtual) return;
    const q = query(
      collection(db, "ocorrencias"),
      where("obraId", "==", obraAtual),
      where("status", "==", "ABERTA")
    );
    const unsub = onSnapshot(q, snap => {
      setOcorr(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [obraAtual]);

  const concl   = escopos.filter(e => e.status === "CONCLUÍDO").length;
  const andando = escopos.filter(e => e.status === "EM ANDAMENTO").length;
  const naoIni  = escopos.filter(e => e.status === "NÃO INICIADO").length;

  const obraInfo = obras.find(o => o.id === obraAtual);

  return (
    <div>
      {obraInfo && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <strong>{obraInfo.nome}</strong> — {obraInfo.cliente} · Resp: {obraInfo.responsavel}
        </div>
      )}

      <div className="metrics-grid">
        <div className="metric"><div className="metric-label">Obras cadastradas</div><div className="metric-value blue">{obras.length}</div></div>
        <div className="metric"><div className="metric-label">Escopos concluídos</div><div className="metric-value green">{concl}</div></div>
        <div className="metric"><div className="metric-label">Em andamento</div><div className="metric-value amber">{andando}</div></div>
        <div className="metric"><div className="metric-label">Não iniciados</div><div className="metric-value gray">{naoIni}</div></div>
        <div className="metric"><div className="metric-label">Ocorrências abertas</div><div className="metric-value red">{ocorr.length}</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Obras */}
        <div className="card">
          <div className="panel-header">
            <span className="panel-title">Obras</span>
            <Link to="/obras" className="btn btn-sm">Ver todas</Link>
          </div>
          {obras.length === 0 && <div className="empty-state"><p>Nenhuma obra cadastrada</p></div>}
          {obras.map(o => (
            <div key={o.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{o.nome}</div>
                  <div style={{ fontSize: 12, color: "var(--cinza-med)" }}>{o.cliente} · {o.area || "–"} m²</div>
                </div>
                <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${o.progresso === 100 ? "green" : "blue"}`}
                  style={{ width: `${o.progresso || 0}%` }}
                />
              </div>
              <div style={{ fontSize: 11, color: "var(--cinza-med)", marginTop: 3, textAlign: "right" }}>
                {o.progresso || 0}% · {fmtDate(o.inicio)} → {fmtDate(o.termino)}
              </div>
            </div>
          ))}
        </div>

        {/* Ocorrências abertas */}
        <div className="card">
          <div className="panel-header">
            <span className="panel-title">Ocorrências abertas</span>
            <Link to="/ocorrencias" className="btn btn-sm">Ver todas</Link>
          </div>
          {ocorr.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <p>Nenhuma ocorrência aberta</p>
            </div>
          )}
          {ocorr.map(o => (
            <div key={o.id} className="rdo-card" style={{ borderLeft: "3px solid var(--vermelho)", paddingLeft: 13, marginBottom: 10 }}>
              <div className="rdo-header">
                <span style={{ fontWeight: 600, fontSize: 12 }}>{o.tipo}</span>
                <span className="badge badge-red">ABERTA</span>
              </div>
              <p style={{ fontSize: 12, color: "#444" }}>{o.descricao}</p>
              <p style={{ fontSize: 11, color: "var(--cinza-med)", marginTop: 4 }}>
                Resp: {o.responsavel} · Prazo: {fmtDate(o.prazo)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
