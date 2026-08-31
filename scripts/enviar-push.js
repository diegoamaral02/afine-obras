#!/usr/bin/env node
// scripts/enviar-push.js — Envia push para todos os assinantes do Firestore
//
// Pré-requisitos:
//   npm install firebase-admin web-push --prefix scripts
//
// Uso:
//   node scripts/enviar-push.js "Título" "Mensagem" "/url-opcional"
//
// Exemplos:
//   node scripts/enviar-push.js "Obra atrasada" "Residencial Bela Vista com 3 dias de atraso" "/painel"
//   node scripts/enviar-push.js "Reunião" "Reunião de alinhamento em 30 minutos" "/calendario"

const path = require("path");

// ── Configuração (lida do arquivo scripts/.env — nunca commitar) ──────────────
// Crie scripts/.env com:
//   VAPID_PUBLIC=<chave pública>
//   VAPID_PRIVATE=<chave privada>
//   VAPID_EMAIL=mailto:bear.barbershop.bb@gmail.com
const envPath = path.join(__dirname, ".env");
if (require("fs").existsSync(envPath)) {
  require("fs").readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  });
}
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || "mailto:bear.barbershop.bb@gmail.com";
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccount.json");

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error("\n❌ Chaves VAPID não encontradas. Crie scripts/.env com VAPID_PUBLIC e VAPID_PRIVATE.\n");
  process.exit(1);
}

// ── Argumentos ────────────────────────────────────────────────────────────────
const [,, titulo, corpo, url = "/"] = process.argv;
if (!titulo || !corpo) {
  console.error('\nUso: node scripts/enviar-push.js "Título" "Mensagem" "/url"\n');
  process.exit(1);
}

// ── Dependências ──────────────────────────────────────────────────────────────
let admin, webpush;
try {
  admin   = require(path.join(__dirname, "node_modules", "firebase-admin"));
  webpush = require(path.join(__dirname, "node_modules", "web-push"));
} catch {
  console.error("\n❌ Dependências não instaladas. Rode primeiro:\n");
  console.error("   npm install firebase-admin web-push --prefix scripts\n");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = require(SERVICE_ACCOUNT_PATH);
} catch {
  console.error("\n❌ Arquivo de conta de serviço não encontrado.\n");
  console.error("   1. Firebase Console → ⚙️ Configurações → Contas de serviço");
  console.error("   2. Gerar nova chave privada → salvar como scripts/serviceAccount.json\n");
  process.exit(1);
}

// ── Inicialização ─────────────────────────────────────────────────────────────
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

// ── Envio ─────────────────────────────────────────────────────────────────────
async function main() {
  const snap = await db.collection("pushSubscriptions").get();
  if (snap.empty) {
    console.log("ℹ️  Nenhum assinante encontrado. Ative as notificações no app primeiro.");
    process.exit(0);
  }

  const payload = JSON.stringify({ title: titulo, body: corpo, url, tag: "manual" });
  let ok = 0, falhas = 0;

  await Promise.allSettled(snap.docs.map(async doc => {
    const sub = doc.data();
    if (!sub.endpoint) return;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth } },
        payload,
        { TTL: 86400 }
      );
      ok++;
      console.log(`✅ Enviado para: ${doc.id}`);
    } catch (err) {
      falhas++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        await doc.ref.delete();
        console.log(`🗑️  Subscription expirada removida: ${doc.id}`);
      } else {
        console.error(`❌ Erro ao notificar ${doc.id}: ${err.message}`);
      }
    }
  }));

  console.log(`\n📊 Resultado: ${ok} enviado(s), ${falhas} falha(s)`);
  process.exit(0);
}

main().catch(err => { console.error("Erro fatal:", err); process.exit(1); });
