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

const TESTE_EMAIL = "teste@afine.com";
const TESTE_SENHA = "123456";
const TESTE_PERFIL = {
  nome:   "Diego (Teste)",
  perfil: "gestor",
  obras:  [],
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading,     setLoading]     = useState(true);

  async function login(email, password) {
    if (email === TESTE_EMAIL && password === TESTE_SENHA) {
      const fakeUser = { uid: "local-teste", email: TESTE_EMAIL };
      setCurrentUser(fakeUser);
      setUserProfile(TESTE_PERFIL);
      setLoading(false);
      return;
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "usuarios", cred.user.uid));
    if (snap.exists()) {
      setUserProfile(snap.data());
    }
    return cred;
  }

  function logout() {
    if (currentUser?.uid === "local-teste") {
      setCurrentUser(null);
      setUserProfile(null);
      return Promise.resolve();
    }
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (currentUser?.uid === "local-teste") {
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      if (user) {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (snap.exists()) {
          setUserProfile(snap.data());
        } else {
          setUserProfile({ nome: user.email, perfil: "campo", obras: [] });
        }
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