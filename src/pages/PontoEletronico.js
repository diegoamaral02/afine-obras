// src/pages/PontoEletronico.js — Ponto Eletrônico de Campo
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  collection, onSnapshot, query,
  where, orderBy, getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import { addComAuditoria, updateComAuditoria, deleteComAuditoria } from "../services/auditoria";
import { resolverPerfilMenu, isCampo, getDepartamentoEfetivo } from "../constants/departamentos";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";
import { prepararDadosPonto, gerarPontoPDFIndividual, gerarPontoPDFGeral, gerarPontoExcel } from "../utils/exportPontoPDF";

// ─── helpers ────────────────────────────────────────────────────────────────

function hojeStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function fmtHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

/** Retorna "HH:MM" de diferença entre dois ISO strings */
function calcHoras(entradaIso, saidaIso) {
  if (!entradaIso || !saidaIso) return null;
  const diff = (new Date(saidaIso) - new Date(entradaIso)) / 1000;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Recebe array de pontos ordenados por timestamp asc.
 * Retorna array de pares { entrada, saida } do mesmo dia.
 * Pares incompletos (sem saída) terão saida = null.
 */
function pararPontos(pontos) {
  const pares = [];
  let entradaPendente = null;
  for (const p of pontos) {
    if (p.tipo === "ENTRADA") {
      if (entradaPendente) pares.push({ entrada: entradaPendente, saida: null });
      entradaPendente = p;
    } else if (p.tipo === "SAIDA" && entradaPendente) {
      pares.push({ entrada: entradaPendente, saida: p });
      entradaPendente = null;
    }
  }
  if (entradaPendente) pares.push({ entrada: entradaPendente, saida: null });
  return pares;
}

/** Soma total de horas trabalhadas (pares completos) em milissegundos */
function totalMsFromPares(pares) {
  return pares
    .filter(p => p.saida)
    .reduce((acc, p) => acc + (new Date(p.saida.timestamp) - new Date(p.entrada.timestamp)), 0);
}

function msToHorasStr(ms) {
  if (!ms || ms <= 0) return "0:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}:${String(m).padStart(2, "0")}`;
}

async function obterGeo() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }

    const PRECISAO_ALVO = 50;  // metros — aceita imediatamente se atingir
    const TIMEOUT_MS    = 20000; // aguarda até 20s por uma leitura boa
    let melhor = null;
    let watchId = null;

    const concluir = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      resolve(melhor);
    };

    const timer = setTimeout(concluir, TIMEOUT_MS);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const candidato = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao: Math.round(pos.coords.accuracy),
        };
        // Guarda sempre a melhor leitura obtida até agora
        if (!melhor || candidato.precisao < melhor.precisao) {
          melhor = candidato;
        }
        // Se atingiu a precisão alvo, encerra imediatamente
        if (melhor.precisao <= PRECISAO_ALVO) {
          clearTimeout(timer);
          concluir();
        }
      },
      () => { clearTimeout(timer); resolve(melhor); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: TIMEOUT_MS }
    );
  });
}

function GeoLink({ geo }) {
  if (!geo) return <span style={{ color: "var(--afine-gray)" }}>—</span>;
  return (
    <a
      href={`https://maps.google.com/?q=${geo.lat},${geo.lng}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "var(--afine-yellow-dk)", fontSize: 12 }}
    >
      📍 {geo.precisao}m
    </a>
  );
}

// ─── Bloco de registro de ponto (usado por campo E gestor) ───────────────────

function RegistroPonto({ userProfile, currentUser, obras, manutencoes, pontosHoje, addToast }) {
  const [vinculoTipo, setVinculoTipo] = useState("escritorio");
  const [vinculoId, setVinculoId] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [horaAtual, setHoraAtual] = useState(new Date());

  // Relógio em tempo real
  useEffect(() => {
    const t = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Determina próximo tipo baseado no último ponto do dia
  const pontosOrdenados = [...pontosHoje].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const ultimoPonto = pontosOrdenados[pontosOrdenados.length - 1];
  const proximoTipo = !ultimoPonto || ultimoPonto.tipo === "SAIDA" ? "ENTRADA" : "SAIDA";
  const emAlmoco = ultimoPonto?.tipo === "SAIDA" && ultimoPonto?.subTipo === "almoco";

  // Verifica regra: só pode SAIDA se já bateu ENTRADA
  const podeRegistrar =
    proximoTipo === "ENTRADA" ||
    (proximoTipo === "SAIDA" && ultimoPonto?.tipo === "ENTRADA");

  // Horas trabalhadas hoje
  const pares = pararPontos(pontosOrdenados);
  const totalHoje = msToHorasStr(totalMsFromPares(pares));
  const parAberto = pares.find(p => !p.saida);

  // Opções de vínculo
  const opcoesVinculo =
    vinculoTipo === "obra"
      ? obras.map(o => ({ id: o.id, nome: o.nome + (o.cliente ? ` — ${o.cliente}` : "") }))
      : vinculoTipo === "manutencao"
      ? manutencoes.map(m => ({ id: m.id, nome: m.titulo + (m.clienteNome ? ` — ${m.clienteNome}` : "") }))
      : [];

  async function handleRegistrar() {
    if (!podeRegistrar) { addToast("Bata a entrada antes de registrar saída.", "error"); return; }
    if ((vinculoTipo === "obra" || vinculoTipo === "manutencao") && !vinculoId) {
      addToast("Selecione a obra ou manutenção.", "error"); return;
    }
    setSalvando(true);
    try {
      const geo = await obterGeo();
      let vinculoNome = "Escritório";
      if (vinculoTipo === "obra") {
        const o = obras.find(x => x.id === vinculoId);
        vinculoNome = o ? o.nome : vinculoId;
      } else if (vinculoTipo === "manutencao") {
        const m = manutencoes.find(x => x.id === vinculoId);
        vinculoNome = m ? m.titulo : vinculoId;
      }
      const payload = {
        usuarioId: currentUser.uid,
        usuarioNome: userProfile?.nome || currentUser.email,
        tipo: proximoTipo,
        subTipo: proximoTipo === "ENTRADA" && emAlmoco ? "retorno_almoco" : "normal",
        timestamp: new Date().toISOString(),
        vinculoTipo,
        vinculoId: vinculoTipo === "escritorio" ? "escritorio" : vinculoId,
        vinculoNome,
        geo: geo || null,
        obs: obs.trim(),
      };
      await addComAuditoria("pontos", payload, currentUser.uid, userProfile?.nome);
      addToast(`${proximoTipo === "ENTRADA" ? "Entrada" : "Saída"} registrada!`);
      setObs("");
    } catch (err) {
      addToast("Erro ao registrar ponto: " + err.message, "error");
    }
    setSalvando(false);
  }

  async function handleAlmoco() {
    if (!parAberto) { addToast("Bata a entrada antes de registrar almoço.", "error"); return; }
    setSalvando(true);
    try {
      const geo = await obterGeo();
      const payload = {
        usuarioId: currentUser.uid,
        usuarioNome: userProfile?.nome || currentUser.email,
        tipo: "SAIDA",
        subTipo: "almoco",
        timestamp: new Date().toISOString(),
        vinculoTipo: parAberto.entrada.vinculoTipo,
        vinculoId: parAberto.entrada.vinculoId,
        vinculoNome: parAberto.entrada.vinculoNome,
        geo: geo || null,
        obs: "Saída para almoço",
      };
      await addComAuditoria("pontos", payload, currentUser.uid, userProfile?.nome);
      addToast("Saída para almoço registrada!");
      setObs("");
    } catch (err) {
      addToast("Erro ao registrar almoço: " + err.message, "error");
    }
    setSalvando(false);
  }

  const isEntrada = proximoTipo === "ENTRADA";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* Card principal */}
      <div className="card" style={{ textAlign: "center", padding: "32px 28px", marginBottom: 20 }}>
        {/* Relógio */}
        <div style={{
          fontSize: 52, fontWeight: 800, letterSpacing: "-0.03em",
          color: "var(--afine-black)", lineHeight: 1, marginBottom: 4,
          fontVariantNumeric: "tabular-nums"
        }}>
          {horaAtual.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
        <div style={{ fontSize: 13, color: "var(--afine-gray)", marginBottom: 24 }}>
          {horaAtual.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </div>

        {/* Status */}
        <div style={{
          background: emAlmoco ? "#FFF8E1" : parAberto ? "var(--verde-lt)" : "var(--n-100)",
          border: `1px solid ${emAlmoco ? "#F5C800" : parAberto ? "rgba(42,107,63,.22)" : "var(--border)"}`,
          borderRadius: "var(--r-lg)",
          padding: "12px 20px",
          marginBottom: 24,
          color: emAlmoco ? "#B8860B" : parAberto ? "var(--verde)" : "var(--afine-gray)",
          fontWeight: 600,
          fontSize: 13,
        }}>
          {emAlmoco
            ? `🍽️ Em almoço desde ${fmtHora(ultimoPonto.timestamp)}`
            : parAberto
            ? `Entrada batida às ${fmtHora(parAberto.entrada.timestamp)} — ${parAberto.entrada.vinculoNome}`
            : "Aguardando entrada"}
        </div>

        {/* Seleção de vínculo */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: "center" }}>
          {[
            { v: "escritorio", label: "🏢 Escritório" },
            { v: "obra", label: "🏗️ Obra" },
            { v: "manutencao", label: "🔧 Manutenção" },
          ].map(({ v, label }) => (
            <button
              key={v}
              className={`chip${vinculoTipo === v ? " active" : ""}`}
              onClick={() => { setVinculoTipo(v); setVinculoId(""); }}
            >
              {label}
            </button>
          ))}
        </div>

        {vinculoTipo !== "escritorio" && (
          <div className="form-group" style={{ marginBottom: 14, textAlign: "left" }}>
            <label>{vinculoTipo === "obra" ? "Obra" : "Manutenção"}</label>
            <select value={vinculoId} onChange={e => setVinculoId(e.target.value)}>
              <option value="">Selecione...</option>
              {opcoesVinculo.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 20, textAlign: "left" }}>
          <label>Observação (opcional)</label>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: chegada atrasada por trânsito" />
        </div>

        {/* Botão principal */}
        <button
          className={`btn ${isEntrada ? "btn-success" : "btn-danger"}`}
          style={{
            width: "100%", padding: "18px 24px",
            fontSize: 18, fontWeight: 800, borderRadius: "var(--r-lg)",
            letterSpacing: "-.01em",
          }}
          onClick={handleRegistrar}
          disabled={salvando || !podeRegistrar}
        >
          {salvando
            ? "📡 Obtendo localização..."
            : isEntrada && emAlmoco
            ? "🍽️ Retornar do Almoço"
            : isEntrada
            ? "🟢 Registrar Entrada"
            : "🔴 Registrar Saída"}
        </button>

        {/* Botão almoço — aparece só quando há ENTRADA em aberto */}
        {!isEntrada && (
          <button
            onClick={handleAlmoco}
            disabled={salvando}
            style={{
              width: "100%", marginTop: 10, padding: "13px 20px",
              fontSize: 14, fontWeight: 700, borderRadius: "var(--r-lg)",
              background: "#FFF8E1", color: "#B8860B",
              border: "1.5px solid #F5C800", cursor: salvando ? "not-allowed" : "pointer",
              letterSpacing: "-.01em",
            }}
          >
            🍽️ Saída para Almoço
          </button>
        )}

        {/* KPI horas hoje */}
        <div style={{
          marginTop: 20, display: "flex", justifyContent: "center",
          gap: 32, paddingTop: 20, borderTop: "1px solid var(--border)"
        }}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--afine-gray)", fontWeight: 700 }}>Pontos hoje</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--afine-black)" }}>{pontosHoje.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--afine-gray)", fontWeight: 700 }}>Horas hoje</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--verde)" }}>{totalHoje}</div>
          </div>
        </div>
      </div>

      {/* Histórico 7 dias */}
      <HistoricoProprioUsuario userId={currentUser.uid} />
    </div>
  );
}

// ─── Histórico do próprio usuário (últimos 7 dias) ────────────────────────────

function HistoricoProprioUsuario({ userId }) {
  const [pontos, setPontos] = useState([]);

  useEffect(() => {
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const q = query(
      collection(db, "pontos"),
      where("usuarioId", "==", userId),
      where("timestamp", ">=", seteDiasAtras.toISOString()),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setPontos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [userId]);

  // Agrupa por data
  const porDia = {};
  for (const p of [...pontos].reverse()) {
    const dia = p.timestamp.slice(0, 10);
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(p);
  }
  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

  return (
    <div className="card">
      <div className="panel-header" style={{ marginBottom: 12 }}>
        <div className="panel-title" style={{ fontSize: 15 }}>Histórico — últimos 7 dias</div>
      </div>
      {dias.length === 0 && (
        <div className="empty-state" style={{ padding: "24px 0" }}>
          <div className="empty-icon">📋</div>
          <p>Nenhum ponto registrado.</p>
        </div>
      )}
      {dias.map(dia => {
        const ps = porDia[dia];
        const pares = pararPontos(ps);
        const totalMs = totalMsFromPares(pares);
        return (
          <div key={dia} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "var(--afine-gray-dk)",
              textTransform: "uppercase", letterSpacing: ".06em",
              marginBottom: 6, display: "flex", justifyContent: "space-between"
            }}>
              <span>{fmtData(dia + "T12:00:00")}</span>
              <span style={{ color: "var(--verde)" }}>{msToHorasStr(totalMs)}h trabalhadas</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Hora</th>
                    <th>Vínculo</th>
                    <th>Geo</th>
                    <th>Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {ps.map(p => (
                    <tr key={p.id}>
                      <td>
                        <span className={`badge ${p.tipo === "ENTRADA" ? (p.subTipo === "almoco" ? "" : "badge-green") : (p.subTipo === "almoco" ? "" : "badge-red")}`}
                          style={p.subTipo === "almoco" ? { background: "#FFF8E1", color: "#B8860B", border: "1px solid #F5C800" } : {}}>
                          {p.subTipo === "almoco" ? "🍽️ ALMOÇO" : p.tipo}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmtHora(p.timestamp)}</td>
                      <td>{p.vinculoNome || "—"}</td>
                      <td><GeoLink geo={p.geo} /></td>
                      <td style={{ color: "var(--afine-gray)", fontStyle: p.obs ? "normal" : "italic" }}>
                        {p.obs || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Aba Relatório (gestor) ───────────────────────────────────────────────────

// ─── Modal de correção de ponto ───────────────────────────────────────────────

function isoParaDatetimeLocal(iso) {
  if (!iso) return "";
  // "2026-08-25T14:30:00.000Z" → local datetime-local string
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalParaIso(val) {
  if (!val) return null;
  return new Date(val).toISOString();
}

function ModalCorrecaoPonto({ linha, obras, manutencoes, currentUser, userProfile, onFechar }) {
  const todosOsPontos = linha.todosOsPontos || [];
  const primeiroDoc   = todosOsPontos[0];

  // Estado editável para cada ponto existente: { id → horario }
  const [horarios, setHorarios] = useState(() => {
    const m = {};
    todosOsPontos.forEach(p => { m[p.id] = isoParaDatetimeLocal(p.timestamp); });
    return m;
  });

  // Novo registro
  const [novoTipo,     setNovoTipo]     = useState("ENTRADA");
  const [novoHorario,  setNovoHorario]  = useState("");
  const [novoObs,      setNovoObs]      = useState("");
  const [novoVincTipo, setNovoVincTipo] = useState(primeiroDoc?.vinculoTipo || "escritorio");
  const [novoVincId,   setNovoVincId]   = useState(primeiroDoc?.vinculoId   || "escritorio");

  const [salvando,    setSalvando]    = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [erro,        setErro]        = useState("");

  function nomeVinculo(tipo, id) {
    if (tipo === "escritorio") return "Escritório";
    const all = [...obras.map(o=>({id:o.id,nome:o.nome})), ...manutencoes.map(m=>({id:m.id,nome:m.titulo}))];
    return all.find(x => x.id === id)?.nome || id;
  }

  function labelTipo(p) {
    if (p.tipo === "ENTRADA" && p.subTipo === "retorno_almoco") return "↗ Retorno Almoço";
    if (p.tipo === "SAIDA"   && p.subTipo === "almoco")         return "🍽️ Saída Almoço";
    // fallback: ENTRADA que vem depois de uma SAIDA almoco = retorno (registros antigos sem subTipo)
    if (p.tipo === "ENTRADA" && linha.retornoDoc?.id === p.id)  return "↗ Retorno Almoço";
    if (p.tipo === "ENTRADA") return "↗ Entrada";
    return "↙ Saída";
  }
  function corTipo(p) {
    if (p.subTipo === "almoco" || p.subTipo === "retorno_almoco") return "#B8860B";
    if (p.tipo === "ENTRADA" && linha.retornoDoc?.id === p.id)    return "#B8860B";
    return p.tipo === "ENTRADA" ? "var(--verde)" : "#C62828";
  }

  async function salvarTodos() {
    setSalvando(true); setErro("");
    try {
      const nome = userProfile?.nome || currentUser.email;
      await Promise.all(todosOsPontos.map(p => {
        const h = horarios[p.id];
        if (!h) return null;
        return updateComAuditoria("pontos", p.id, {
          timestamp: datetimeLocalParaIso(h),
        }, currentUser.uid, nome);
      }));
      onFechar();
    } catch (err) {
      setErro("Erro ao salvar: " + err.message);
    }
    setSalvando(false);
  }

  async function excluirDoc(p) {
    if (!window.confirm("Excluir este registro de ponto?")) return;
    setSalvando(true);
    try {
      await deleteComAuditoria("pontos", p.id, currentUser.uid, userProfile?.nome || currentUser.email, p);
      onFechar();
    } catch (err) {
      setErro("Erro ao excluir: " + err.message);
      setSalvando(false);
    }
  }

  async function adicionarPonto() {
    if (!novoHorario) { setErro("Informe o horário do novo registro."); return; }
    setAdicionando(true); setErro("");
    try {
      const nome = userProfile?.nome || currentUser.email;
      const payload = {
        usuarioId:   primeiroDoc.usuarioId,
        usuarioNome: primeiroDoc.usuarioNome,
        tipo:        novoTipo,
        subTipo:     "normal",
        timestamp:   datetimeLocalParaIso(novoHorario),
        vinculoTipo: novoVincTipo,
        vinculoId:   novoVincTipo === "escritorio" ? "escritorio" : novoVincId,
        vinculoNome: nomeVinculo(novoVincTipo, novoVincId),
        geo:         null,
        obs:         novoObs.trim(),
        corrigidoPor: nome,
        corrigidoEm:  new Date().toISOString(),
      };
      await addComAuditoria("pontos", payload, currentUser.uid, nome);
      onFechar();
    } catch (err) {
      setErro("Erro ao adicionar: " + err.message);
    }
    setAdicionando(false);
  }

  const opcoesNovoVinc = novoVincTipo === "obra"
    ? obras.map(o => ({ id: o.id, nome: o.nome }))
    : novoVincTipo === "manutencao"
    ? manutencoes.map(m => ({ id: m.id, nome: m.titulo }))
    : [];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: 12, padding: 28,
        width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 8px 40px rgba(0,0,0,.28)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>✏️ Corrigir Ponto</div>
            <div style={{ fontSize: 12, color: "var(--afine-gray)", marginTop: 2 }}>
              {linha.usuarioNome} — {fmtData(linha.dia + "T12:00:00")}
            </div>
          </div>
          <button onClick={onFechar} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--afine-gray)" }}>×</button>
        </div>

        {erro && <div style={{ background: "#FFEBEE", color: "#C62828", borderRadius: 6, padding: "8px 12px", marginBottom: 14, fontSize: 13 }}>{erro}</div>}

        {/* Lista de todos os registros do dia */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {todosOsPontos.map(p => (
            <div key={p.id} style={{ background: "var(--n-100)", borderRadius: 8, padding: 12, borderLeft: `3px solid ${corTipo(p)}` }}>
              <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: corTipo(p), marginBottom: 8 }}>
                {labelTipo(p)}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="datetime-local"
                  value={horarios[p.id] || ""}
                  onChange={e => setHorarios(h => ({ ...h, [p.id]: e.target.value }))}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button onClick={() => excluirDoc(p)} disabled={salvando}
                  title="Excluir registro"
                  style={{ background: "none", border: "1px solid #C62828", color: "#C62828", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
                  🗑️
                </button>
              </div>
              {p.obs ? <div style={{ fontSize: 11, color: "var(--afine-gray)", marginTop: 4 }}>Obs: {p.obs}</div> : null}
            </div>
          ))}
        </div>

        {/* Adicionar registro */}
        <div style={{ background: "var(--n-100)", border: "1.5px dashed var(--border)", borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--afine-gray)", marginBottom: 10 }}>➕ Adicionar Registro</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {[{v:"ENTRADA",l:"↗ Entrada"},{v:"SAIDA",l:"↙ Saída"}].map(({v,l}) => (
              <button key={v} className={`chip${novoTipo===v?" active":""}`}
                onClick={() => setNovoTipo(v)} style={{ fontSize: 11 }}>{l}</button>
            ))}
          </div>

          <div className="form-group" style={{ marginBottom: 10 }}>
            <input type="datetime-local" value={novoHorario} onChange={e => setNovoHorario(e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {[{v:"escritorio",l:"🏢"},{v:"obra",l:"🏗️ Obra"},{v:"manutencao",l:"🔧 Manutenção"}].map(({v,l}) => (
              <button key={v} className={`chip${novoVincTipo===v?" active":""}`}
                onClick={() => { setNovoVincTipo(v); setNovoVincId("escritorio"); }} style={{ fontSize: 11 }}>{l}</button>
            ))}
          </div>

          {novoVincTipo !== "escritorio" && (
            <div className="form-group" style={{ marginBottom: 10 }}>
              <select value={novoVincId} onChange={e => setNovoVincId(e.target.value)}>
                <option value="">Selecione...</option>
                {opcoesNovoVinc.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 10 }}>
            <input value={novoObs} onChange={e => setNovoObs(e.target.value)} placeholder="Observação (opcional)" />
          </div>

          <button onClick={adicionarPonto} disabled={adicionando || !novoHorario}
            style={{ background: "var(--afine-black)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: !novoHorario ? "not-allowed" : "pointer", opacity: !novoHorario ? 0.5 : 1 }}>
            {adicionando ? "Adicionando..." : "➕ Adicionar"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={salvarTodos} disabled={salvando}
            className="btn btn-primary" style={{ flex: 1 }}>
            {salvando ? "Salvando..." : "✅ Salvar Correções"}
          </button>
          <button onClick={onFechar} disabled={salvando}
            className="btn" style={{ padding: "10px 20px" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// Departamentos visíveis por perfil
const DEPS_CAMPO = ["campo", "empreiteiro", "terceiro"];
const PERFIS_VER_TUDO = ["gestao", "financeiro", "adm"];
const PERFIS_VER_CAMPO = ["fiscal", "comercial"];

function RelatorioGestor({ obras, manutencoes, userProfile, currentUser }) {
  const [pontos, setPontos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({}); // uid → departamento
  const [filtroFuncionario, setFiltroFuncionario] = useState("");
  const [filtroObra, setFiltroObra] = useState("");
  const [filtroDe, setFiltroDe] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [filtroAte, setFiltroAte] = useState(hojeStr());
  const [carregando, setCarregando] = useState(true);

  // Carrega mapa de departamentos dos usuários
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), snap => {
      const mapa = {};
      snap.docs.forEach(d => { mapa[d.id] = d.data().departamento || d.data().perfil || "campo"; });
      setUsuariosMap(mapa);
    });
    return unsub;
  }, []);

  // Carrega pontos do período
  useEffect(() => {
    setCarregando(true);
    const q = query(
      collection(db, "pontos"),
      where("timestamp", ">=", filtroDe + "T00:00:00.000Z"),
      where("timestamp", "<=", filtroAte + "T23:59:59.999Z"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPontos(todos);
      setCarregando(false);
    });
    return unsub;
  }, [filtroDe, filtroAte]);

  const [pontoParaEditar, setPontoParaEditar] = useState(null); // linha completa

  // Determina quais funcionários o perfil pode ver
  const depAtual = getDepartamentoEfetivo(userProfile);
  const podeCorrigir = ["gestao", "adm", "financeiro"].includes(depAtual);
  const verTudo = PERFIS_VER_TUDO.includes(depAtual);
  const verCampo = PERFIS_VER_CAMPO.includes(depAtual);

  function podVerFuncionario(uid) {
    if (verTudo) return true;
    if (verCampo) {
      const dep = usuariosMap[uid] || "campo";
      return DEPS_CAMPO.includes(dep);
    }
    return false;
  }

  // Extrai funcionários visíveis dos pontos carregados
  useEffect(() => {
    const mapa = {};
    for (const p of pontos) {
      if (!mapa[p.usuarioId] && podVerFuncionario(p.usuarioId)) {
        mapa[p.usuarioId] = p.usuarioNome;
      }
    }
    setFuncionarios(Object.entries(mapa).map(([id, nome]) => ({ id, nome })));
  // eslint-disable-next-line
  }, [pontos, usuariosMap]);

  // Filtra por funcionário, obra e permissão de acesso
  const pontosFiltrados = pontos.filter(p => {
    if (!podVerFuncionario(p.usuarioId)) return false;
    if (filtroFuncionario && p.usuarioId !== filtroFuncionario) return false;
    if (filtroObra) {
      if (p.vinculoId !== filtroObra && p.vinculoNome !== filtroObra) return false;
    }
    return true;
  });

  // Agrupa por (usuário + dia) → UMA linha por dia com todas as marcações
  const linhas = [];
  const grupoChave = {};
  for (const p of pontosFiltrados) {
    const dia = p.timestamp.slice(0, 10);
    const chave = `${p.usuarioId}__${dia}`;
    if (!grupoChave[chave]) grupoChave[chave] = { usuarioId: p.usuarioId, usuarioNome: p.usuarioNome, dia, pontos: [] };
    grupoChave[chave].pontos.push(p);
  }
  for (const g of Object.values(grupoChave)) {
    const pts = [...g.pontos].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const entradaDoc    = pts.find(p => p.tipo === "ENTRADA");
    const saidaAlmDoc   = pts.find(p => p.tipo === "SAIDA" && p.subTipo === "almoco");
    const retornoDoc    = saidaAlmDoc
      ? pts.find(p => p.tipo === "ENTRADA" && p.timestamp > saidaAlmDoc.timestamp)
      : null;
    const saidaFinalDoc = [...pts].reverse().find(p => p.tipo === "SAIDA" && p.subTipo !== "almoco");
    const totalMs       = totalMsFromPares(pararPontos(pts));
    linhas.push({
      usuarioId:   g.usuarioId,
      usuarioNome: g.usuarioNome,
      dia:         g.dia,
      vinculoNome: entradaDoc?.vinculoNome || "",
      entradaDoc,
      saidaAlmDoc,
      retornoDoc,
      saidaFinalDoc,
      totalMs,
      horas: totalMs > 0 ? msToHorasStr(totalMs) : null,
      geoEntrada: entradaDoc?.geo,
      geoSaida:   saidaFinalDoc?.geo,
      todosOsPontos: pts,
    });
  }
  linhas.sort((a, b) => b.dia.localeCompare(a.dia) || a.usuarioNome.localeCompare(b.usuarioNome));

  // KPI: total de horas por obra
  const kpiObra = {};
  for (const l of linhas) {
    if (!l.totalMs) continue;
    if (!kpiObra[l.vinculoNome]) kpiObra[l.vinculoNome] = 0;
    kpiObra[l.vinculoNome] += l.totalMs;
  }
  const kpiEntradas = Object.entries(kpiObra).sort((a, b) => b[1] - a[1]);

  const periodo = `${fmtData(filtroDe + "T12:00:00")} a ${fmtData(filtroAte + "T12:00:00")}`;

  function getDadosPonto() {
    return prepararDadosPonto(pontosFiltrados);
  }

  function handleExportar() {
    exportarExcel(
      linhas,
      `ponto_eletronico_${filtroDe}_${filtroAte}`,
      [
        { key: "usuarioNome",   header: "Funcionário" },
        { key: "vinculoNome",   header: "Obra/Vínculo" },
        { key: "dia",           header: "Data",          format: v => fmtData(v + "T12:00:00") },
        { key: "entradaDoc",    header: "Entrada",       format: v => fmtHora(v?.timestamp) },
        { key: "saidaAlmDoc",   header: "Saída Almoço",  format: v => fmtHora(v?.timestamp) },
        { key: "retornoDoc",    header: "Retorno Almoço",format: v => fmtHora(v?.timestamp) },
        { key: "saidaFinalDoc", header: "Saída",         format: v => fmtHora(v?.timestamp) },
        { key: "horas",         header: "Total Horas",   format: v => v || "Em aberto" },
      ]
    );
  }

  function handlePDFIndividual() {
    if (!filtroFuncionario) { alert("Selecione um funcionário no filtro para gerar o PDF individual."); return; }
    gerarPontoPDFIndividual(getDadosPonto(), filtroFuncionario, periodo);
  }

  function handlePDFGeral() {
    gerarPontoPDFGeral(getDadosPonto(), periodo);
  }

  function handleExcelDetalhado() {
    gerarPontoExcel(getDadosPonto(), periodo);
  }

  // Opções de obras+manutencoes para filtro
  const opcoesVinculo = [
    ...obras.map(o => ({ id: o.id, nome: o.nome })),
    ...manutencoes.map(m => ({ id: m.id, nome: m.titulo })),
  ];

  return (
    <div>
      {/* Modal de correção de ponto */}
      {pontoParaEditar && podeCorrigir && (
        <ModalCorrecaoPonto
          linha={pontoParaEditar}
          obras={obras}
          manutencoes={manutencoes}
          currentUser={currentUser}
          userProfile={userProfile}
          onFechar={() => setPontoParaEditar(null)}
        />
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-grid cols-3" style={{ gap: 12 }}>
          <div className="form-group">
            <label>Funcionário</label>
            <select value={filtroFuncionario} onChange={e => setFiltroFuncionario(e.target.value)}>
              <option value="">Todos</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Obra / Manutenção</label>
            <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)}>
              <option value="">Todos</option>
              {opcoesVinculo.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label>De</label>
              <input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)} />
            </div>
            <div>
              <label>Até</label>
              <input type="date" value={filtroAte} onChange={e => setFiltroAte(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs por obra */}
      {kpiEntradas.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-heading">Horas por vínculo no período</div>
          <div className="metrics-grid">
            {kpiEntradas.slice(0, 6).map(([nome, ms]) => (
              <div key={nome} className="kpi-card">
                <div className="kpi-label">{nome}</div>
                <div className="kpi-value">{msToHorasStr(ms)}h</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Registros
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--afine-gray)", fontWeight: 400 }}>
              {linhas.length} linha{linhas.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handlePDFIndividual}
              disabled={linhas.length === 0 || !filtroFuncionario}
              title={!filtroFuncionario ? "Selecione um funcionário no filtro" : "PDF por funcionário"}
              style={{ background: "var(--afine-gray, #555)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: linhas.length === 0 || !filtroFuncionario ? "not-allowed" : "pointer", opacity: linhas.length === 0 || !filtroFuncionario ? 0.5 : 1 }}
            >📄 PDF Individual</button>
            <button
              onClick={handlePDFGeral}
              disabled={linhas.length === 0}
              style={{ background: "#1A1A1A", color: "#F5C800", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: linhas.length === 0 ? "not-allowed" : "pointer", opacity: linhas.length === 0 ? 0.5 : 1 }}
            >📋 PDF Geral</button>
            <button
              onClick={handleExcelDetalhado}
              disabled={linhas.length === 0}
              style={{ background: "#217346", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: linhas.length === 0 ? "not-allowed" : "pointer", opacity: linhas.length === 0 ? 0.5 : 1 }}
            >📊 Excel Detalhado</button>
            <BtnExcel onClick={handleExportar} disabled={linhas.length === 0} />
          </div>
        </div>
        {carregando ? (
          <div className="spinner" />
        ) : linhas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🕐</div>
            <p>Nenhum registro no período.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Vínculo</th>
                  <th>Data</th>
                  <th>↗ Entrada</th>
                  <th>🍽️ Almoço</th>
                  <th>↗ Retorno</th>
                  <th>↙ Saída</th>
                  <th>Total</th>
                  <th className="col-hide-lg">Geo E</th>
                  <th className="col-hide-lg">Geo S</th>
                  {podeCorrigir && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => {
                  const semSaida = !l.saidaFinalDoc;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{l.usuarioNome}</td>
                      <td>{l.vinculoNome}</td>
                      <td>{fmtData(l.dia + "T12:00:00")}</td>
                      <td>{l.entradaDoc ? fmtHora(l.entradaDoc.timestamp) : "—"}</td>
                      <td style={{ color: "#B8860B" }}>{l.saidaAlmDoc ? fmtHora(l.saidaAlmDoc.timestamp) : <span style={{ color: "var(--afine-gray)" }}>—</span>}</td>
                      <td>{l.retornoDoc ? fmtHora(l.retornoDoc.timestamp) : <span style={{ color: "var(--afine-gray)" }}>—</span>}</td>
                      <td>
                        {l.saidaFinalDoc
                          ? fmtHora(l.saidaFinalDoc.timestamp)
                          : <span className="badge badge-amber">Em aberto</span>}
                      </td>
                      <td style={{ fontWeight: 700, color: semSaida ? "var(--afine-gray)" : "var(--verde)" }}>
                        {l.horas ? `${l.horas}h` : "—"}
                      </td>
                      <td className="col-hide-lg"><GeoLink geo={l.geoEntrada} /></td>
                      <td className="col-hide-lg"><GeoLink geo={l.geoSaida} /></td>
                      {podeCorrigir && (
                        <td>
                          <button
                            onClick={() => setPontoParaEditar(l)}
                            title="Corrigir ponto"
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "2px 4px", color: "var(--afine-gray)", borderRadius: 4 }}
                          >✏️</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PontoEletronico() {
  const { userProfile, currentUser } = useAuth();
  const { toasts, addToast } = useToast();
  const [abaAtiva, setAbaAtiva] = useState("registrar");
  const [obras, setObras] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);

  const perfil = resolverPerfilMenu(userProfile);
  const ehCampo = isCampo(userProfile);
  // PJ não-campo não bate ponto (apenas vê relatório se tiver acesso)
  const ehPJNaoCampo = userProfile?.tipoContrato === "PJ" && !ehCampo;

  // Carrega obras ativas
  useEffect(() => {
    const q = query(collection(db, "obras"), where("status", "in", ["EM ANDAMENTO", "PENDENTE", "INICIADA"]));
    const unsub = onSnapshot(q, snap => {
      setObras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Carrega manutenções ativas
  useEffect(() => {
    const q = query(collection(db, "manutencoes"), where("status", "in", ["ABERTA", "EM ANDAMENTO"]));
    const unsub = onSnapshot(q, snap => {
      setManutencoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Pontos do usuário hoje (tempo real)
  useEffect(() => {
    if (!currentUser) return;
    const hoje = hojeStr();
    const q = query(
      collection(db, "pontos"),
      where("usuarioId", "==", currentUser.uid),
      where("timestamp", ">=", hoje + "T00:00:00.000Z"),
      where("timestamp", "<=", hoje + "T23:59:59.999Z"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      setPontosHoje(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentUser]);

  return (
    <div>
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      <div className="panel-header">
        <div>
          <div className="panel-title">⏱️ Ponto Eletrônico</div>
          <div style={{ fontSize: 12, color: "var(--afine-gray)" }}>Registro de presença em campo</div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {/* Usuário campo: só vê o bloco de registro */}
        {ehCampo ? (
          <RegistroPonto
            userProfile={userProfile}
            currentUser={currentUser}
            obras={obras}
            manutencoes={manutencoes}
            pontosHoje={pontosHoje}
            addToast={addToast}
          />
        ) : ehPJNaoCampo ? (
          /* PJ não-campo: não bate ponto, acessa só relatório */
          <RelatorioGestor obras={obras} manutencoes={manutencoes} userProfile={userProfile} currentUser={currentUser} />
        ) : (
          /* Gestor/Encarregado CLT: abas Registrar + Relatório */
          <>
            <div className="tabs" style={{ marginBottom: 20 }}>
              <button
                className={`tab${abaAtiva === "registrar" ? " active" : ""}`}
                onClick={() => setAbaAtiva("registrar")}
              >
                ⏱️ Registrar Ponto
              </button>
              <button
                className={`tab${abaAtiva === "relatorio" ? " active" : ""}`}
                onClick={() => setAbaAtiva("relatorio")}
              >
                📊 Relatório
              </button>
            </div>

            {abaAtiva === "registrar" && (
              <RegistroPonto
                userProfile={userProfile}
                currentUser={currentUser}
                obras={obras}
                manutencoes={manutencoes}
                pontosHoje={pontosHoje}
                addToast={addToast}
              />
            )}

            {abaAtiva === "relatorio" && (
              <RelatorioGestor obras={obras} manutencoes={manutencoes} userProfile={userProfile} currentUser={currentUser} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
