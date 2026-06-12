// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// USUÁRIO DE TESTE LOCAL
// Email:  teste@afine.com
// Senha:  123456
//
// Quando o Firebase estiver configurado e você criar seus usuários reais,
// APAGUE as 11 linhas marcadas com "REMOVER DEPOIS" abaixo.
// ─────────────────────────────────────────────────────────────────────────────

// REMOVER DEPOIS ↓
const TESTE_EMAIL = "teste@afine.com";
const TESTE_SENHA = "123456";
const TESTE_PERFIL = {
  nome:   "Diego Nery (Teste)",
  perfil: "gestor",
  obras:  [],
};
// REMOVER DEPOIS ↑

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading,     setLoading]     = useState(true);

  async function login(email, password) {
    // REMOVER DEPOIS ↓
    if (email === TESTE_EMAIL && password === TESTE_SENHA) {
      const fakeUser = { uid: "local-teste", email: TESTE_EMAIL };
      setCurrentUser(fakeUser);
      setUserProfile(TESTE_PERFIL);
      return;
    }
    // REMOVER DEPOIS ↑

    // Login real via Firebase (sempre ativo)
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    // REMOVER DEPOIS ↓
    if (currentUser?.uid === "local-teste") {
      setCurrentUser(null);
      setUserProfile(null);
      return Promise.resolve();
    }
    // REMOVER DEPOIS ↑

    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // REMOVER DEPOIS ↓
      if (currentUser?.uid === "local-teste") {
        setLoading(false);
        return;
      }
      // REMOVER DEPOIS ↑

      setCurrentUser(user);
      if (user) {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        setUserProfile(snap.exists() ? snap.data() : null);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []); // eslint-disable-line

  const value = { currentUser, userProfile, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
