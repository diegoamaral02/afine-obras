// functions/index.js — Cloud Functions AFINE Obras
// Deploy: firebase deploy --only functions
//
// Antes do deploy, configure as chaves VAPID (NÃO commitar a chave privada):
//   firebase functions:config:set vapid.public="<VAPID_PUBLIC_KEY>"
//   firebase functions:config:set vapid.private="<VAPID_PRIVATE_KEY>"
//   firebase functions:config:set vapid.email="mailto:bear.barbershop.bb@gmail.com"

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const webpush   = require("web-push");

admin.initializeApp();
const db = admin.firestore();

// Configura VAPID a partir das variáveis de ambiente do Functions
function initWebPush() {
  const cfg = functions.config().vapid || {};
  const pub  = cfg.public  || process.env.VAPID_PUBLIC;
  const priv = cfg.private || process.env.VAPID_PRIVATE;
  const mail = cfg.email   || process.env.VAPID_EMAIL   || "mailto:bear.barbershop.bb@gmail.com";
  if (!pub || !priv) throw new Error("VAPID keys não configuradas. Rode: firebase functions:config:set vapid.public=... vapid.private=...");
  webpush.setVapidDetails(mail, pub, priv);
}

// ── Utilitário: envia push para todos os gestores ─────────────────────────────
async function notificarGestores(payload) {
  initWebPush();
  const snap = await db.collection("pushSubscriptions").get();
  const promises = snap.docs.map(async doc => {
    const sub = doc.data();
    if (!sub.endpoint) return;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth } },
        JSON.stringify(payload),
        { TTL: 86400 }
      );
    } catch (err) {
      // Subscription inválida (expirada): remove do Firestore
      if (err.statusCode === 404 || err.statusCode === 410) {
        await doc.ref.delete();
        functions.logger.info(`[Push] Subscription expirada removida: ${doc.id}`);
      } else {
        functions.logger.error(`[Push] Erro ao notificar ${doc.id}:`, err.message);
      }
    }
  });
  await Promise.allSettled(promises);
}

// ── 1. Agendado — verifica obras atrasadas todo dia às 07:00 BRT ─────────────
exports.alertaObrasAtrasadas = functions.pubsub
  .schedule("0 10 * * *") // 07:00 BRT = 10:00 UTC
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const hoje = new Date().toISOString().split("T")[0];
    const snap = await db.collection("obras")
      .where("status", "==", "EM ANDAMENTO")
      .where("termino", "<=", hoje)
      .get();
    const atrasadas = snap.docs.filter(d => (d.data().progresso || 0) < 100);
    if (atrasadas.length === 0) return null;
    await notificarGestores({
      title: `⚠️ ${atrasadas.length} obra(s) atrasada(s)`,
      body:  atrasadas.map(d => d.data().nome).slice(0, 3).join(", ") + (atrasadas.length > 3 ? " e mais..." : ""),
      url:   "/painel",
      tag:   "obras-atrasadas",
    });
    functions.logger.info(`[Push] Alertas de obras atrasadas enviados: ${atrasadas.length}`);
    return null;
  });

// ── 2. Agendado — verifica manutenções vencidas todo dia às 07:30 BRT ─────────
exports.alertaManutencoesAtrasadas = functions.pubsub
  .schedule("30 10 * * *") // 07:30 BRT = 10:30 UTC
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const hoje = new Date().toISOString().split("T")[0];
    const snap = await db.collection("manutencoes")
      .where("status", "in", ["ABERTA", "EM ANDAMENTO"])
      .where("dataPrevista", "<", hoje)
      .get();
    if (snap.empty) return null;
    await notificarGestores({
      title: `🔧 ${snap.size} manutenção(ões) vencida(s)`,
      body:  snap.docs.map(d => d.data().titulo || d.data().nome || "–").slice(0, 3).join(", "),
      url:   "/manutencao",
      tag:   "manutencoes-atrasadas",
    });
    return null;
  });

// ── 3. Trigger — nova manutenção criada (notifica encarregados) ───────────────
exports.novaManutencao = functions.firestore
  .document("manutencoes/{id}")
  .onCreate(async snap => {
    const data = snap.data();
    await notificarGestores({
      title: "🔧 Nova manutenção aberta",
      body:  `${data.titulo || data.nome || "–"} · ${data.cliente || ""}`,
      url:   "/manutencao",
      tag:   "nova-manutencao",
    });
    return null;
  });

// ── 4. Trigger — lançamento financeiro vencido hoje ────────────────────────────
exports.lancamentoVencendo = functions.firestore
  .document("financeiro/{id}")
  .onWrite(async (change, context) => {
    const data = change.after.exists ? change.after.data() : null;
    if (!data) return null;
    const hoje = new Date().toISOString().split("T")[0];
    if (data.status === "PAGO" || !data.data || data.data !== hoje) return null;
    await notificarGestores({
      title: `💰 Lançamento vence hoje`,
      body:  `${data.descricao || "–"} · R$ ${Number(data.valor || 0).toLocaleString("pt-BR")}`,
      url:   "/financeiro",
      tag:   "lancamento-vencendo",
    });
    return null;
  });

// ── 5. Callable — envia push manual (ex: do painel admin) ─────────────────────
exports.enviarPushManual = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário");
  const { titulo, corpo, url } = data;
  if (!titulo || !corpo) throw new functions.https.HttpsError("invalid-argument", "titulo e corpo são obrigatórios");
  await notificarGestores({ title: titulo, body: corpo, url: url || "/" });
  return { ok: true };
});
