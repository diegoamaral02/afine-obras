// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// SUBSTITUA os valores abaixo pelos da sua conta Firebase:
// Firebase Console → Seu projeto → Configurações → Adicionar app Web
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getAuth }       from "firebase/auth";
import { getFirestore }  from "firebase/firestore";

// Sem Firebase Storage — fotos e OS são salvas como base64 no Firestore.
// Plano GRATUITO (Spark) — sem cartão de crédito necessário.

const firebaseConfig = {
  apiKey:            "AIzaSyCNcxH1HhuEWkZCEWYHrv0XD2eMQ3Njlj8",
  authDomain:        "afine-obras-be3fa.firebaseapp.com",
  projectId:         "afine-obras-be3fa",
  storageBucket:     "afine-obras-be3fa.firebasestorage.app",
  messagingSenderId: "151293225943",
  appId:             "1:151293225943:web:a0e88cf53a6990f6c8f992",
};

const app     = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
