// src/pages/SLAConfig.js — configuração de prazos de SLA por urgência
import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import { SLA_DEFAULTS } from "../utils/sla";

export default function SLAConfig() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [regras, setRegras] = useState(SLA_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = userProfile?.role === "gestor" || userProfile?.role === "encarregado";

  useEffect(() => {
    getDoc(doc(db, "sla_config", "manutencao")).then(snap => {
      if (snap.exists() && snap.data().regras?.length) {
        setRegras(snap.data().regras);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function setHoras(idx, val) {
    setRegras(prev => prev.map((r, i) => i === idx ? { ...r, horasMaximas: Number(val) } : r));
  }

  function setCor(idx, val) {
    setRegras(prev => prev.map((r, i) => i === idx ? { ...r, cor: val } : r));
  }

  async function salvar() {
    if (!canEdit) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "sla_config", "manutencao"), { regras, updatedAt: new Date().toISOString() });
      addToast("Configuração de SLA salva com sucesso!");
    } catch (err) {
      addToast("Erro ao salvar: " + err.message, "error");
    }
    setSaving(false);
  }

  const URGENCIA_BADGE = {
    "EMERGÊNCIA": "badge-red",
    "URGENTE":    "badge-amber",
    "NORMAL":     "badge-blue",
    "PROGRAMADA": "badge-green",
  };

  return (
    <div>
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Configuração de SLA</div>
          <div style={{ fontSize: 12, color: "#7A7A7A" }}>
            Defina os prazos máximos por tipo de urgência para manutenções
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>
            {saving ? "Salvando..." : "Salvar configuração"}
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="card" style={{ marginBottom: 16, background: "#FCEDC4", borderColor: "#E07B00" }}>
          <span style={{ fontSize: 13, color: "#7A5400" }}>
            Apenas gestores e encarregados podem editar a configuração de SLA.
          </span>
        </div>
      )}

      {loading ? (
        <div className="spinner" />
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Urgência</th>
                  <th>Prazo máximo (horas)</th>
                  <th>Equivalente</th>
                  <th>Cor</th>
                  <th>Prévia</th>
                </tr>
              </thead>
              <tbody>
                {regras.map((regra, idx) => (
                  <tr key={regra.urgencia}>
                    <td>
                      <span className={`badge ${URGENCIA_BADGE[regra.urgencia] || "badge-gray"}`}>
                        {regra.urgencia}
                      </span>
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          type="number"
                          min={1}
                          max={8760}
                          value={regra.horasMaximas}
                          onChange={e => setHoras(idx, e.target.value)}
                          style={{ width: 100 }}
                        />
                      ) : (
                        <strong>{regra.horasMaximas}h</strong>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "#7A7A7A" }}>
                      {regra.horasMaximas < 24
                        ? `${regra.horasMaximas}h`
                        : `${Math.floor(regra.horasMaximas / 24)}d ${regra.horasMaximas % 24 > 0 ? `${regra.horasMaximas % 24}h` : ""}`.trim()
                      }
                    </td>
                    <td>
                      {canEdit ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="color"
                            value={regra.cor}
                            onChange={e => setCor(idx, e.target.value)}
                            style={{ width: 36, height: 32, padding: 2, borderRadius: 6, cursor: "pointer" }}
                          />
                          <span style={{ fontSize: 11, color: "#7A7A7A" }}>{regra.cor}</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, background: regra.cor }} />
                          <span style={{ fontSize: 11 }}>{regra.cor}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "3px 10px", borderRadius: 999,
                        background: regra.cor + "22",
                        color: regra.cor,
                        fontSize: 11, fontWeight: 700,
                        border: `1px solid ${regra.cor}44`,
                      }}>
                        {regra.urgencia}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, padding: "12px 14px", background: "#F3F2EF", borderRadius: 8, fontSize: 12, color: "#46464C" }}>
            <strong>Regras de alerta:</strong> O SLA entra em "em risco" quando restam menos de 20% do prazo.
            Após o prazo expirar, o status passa para "vencido" independentemente da situação da manutenção.
          </div>
        </div>
      )}
    </div>
  );
}
