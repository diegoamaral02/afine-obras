// src/hooks/useCatalogoItens.js
// Carrega o catálogo de itens do Firestore (coleção catalogo_itens).
// Se a coleção estiver vazia, faz seed automático a partir de itensCompras.js.
// Expõe funções para adicionar, editar e remover itens e categorias.

import { useState, useEffect, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { CATEGORIAS_COMPRAS } from "../constants/itensCompras";

// Estrutura de cada doc no Firestore (catalogo_itens):
// { categoriaId, categoriaLabel, categoriaCor, descricao, unidade, fabricante, ordem }

export function useCatalogoItens() {
  const [docs,    setDocs]    = useState([]);   // raw Firestore docs
  const [loading, setLoading] = useState(true);
  const [seeded,  setSeeded]  = useState(false);

  // ── Listener em tempo real ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "catalogo_itens"), snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDocs(items);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // ── Seed inicial (roda uma única vez se coleção vazia) ────────────────────
  useEffect(() => {
    if (loading || seeded || docs.length > 0) return;
    setSeeded(true);
    (async () => {
      const snap = await getDocs(collection(db, "catalogo_itens"));
      if (snap.size > 0) return; // outra aba já fez o seed
      const batch = writeBatch(db);
      let ordem = 0;
      for (const cat of CATEGORIAS_COMPRAS) {
        for (const item of cat.itens) {
          const ref = doc(collection(db, "catalogo_itens"));
          batch.set(ref, {
            categoriaId:    cat.id,
            categoriaLabel: cat.label,
            categoriaCor:   cat.cor,
            descricao:      item.descricao,
            unidade:        item.unidade,
            fabricante:     item.fabricante || "",
            ordem:          ordem++,
            createdAt:      new Date().toISOString(),
          });
        }
      }
      await batch.commit();
    })();
  }, [loading, seeded, docs.length]);

  // ── Categorias derivadas (preserva ordem do seed) ────────────────────────
  const categorias = (() => {
    const map = new Map();
    // Garante a ordem original das categorias do seed
    for (const cat of CATEGORIAS_COMPRAS) {
      if (!map.has(cat.id)) map.set(cat.id, { id: cat.id, label: cat.label, cor: cat.cor, itens: [] });
    }
    // Agrupa itens do Firestore
    for (const d of docs) {
      if (!map.has(d.categoriaId)) {
        map.set(d.categoriaId, { id: d.categoriaId, label: d.categoriaLabel, cor: d.categoriaCor || "#4A4A4A", itens: [] });
      }
      map.get(d.categoriaId).itens.push(d);
    }
    // Ordena itens por campo `ordem`
    for (const cat of map.values()) {
      cat.itens.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
    }
    return Array.from(map.values()).filter(c => c.itens.length > 0 || CATEGORIAS_COMPRAS.some(s => s.id === c.id));
  })();

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const adicionarItem = useCallback(async (categoriaId, { descricao, unidade, fabricante = "" }) => {
    const cat = categorias.find(c => c.id === categoriaId);
    if (!cat || !descricao?.trim()) return;
    const maxOrdem = Math.max(0, ...docs.filter(d => d.categoriaId === categoriaId).map(d => d.ordem ?? 0));
    await addDoc(collection(db, "catalogo_itens"), {
      categoriaId,
      categoriaLabel: cat.label,
      categoriaCor:   cat.cor,
      descricao:      descricao.trim(),
      unidade:        unidade || "un",
      fabricante:     fabricante.trim(),
      ordem:          maxOrdem + 1,
      createdAt:      new Date().toISOString(),
    });
  }, [categorias, docs]);

  const editarItem = useCallback(async (id, campos) => {
    await updateDoc(doc(db, "catalogo_itens", id), { ...campos, updatedAt: new Date().toISOString() });
  }, []);

  const removerItem = useCallback(async (id) => {
    await deleteDoc(doc(db, "catalogo_itens", id));
  }, []);

  const adicionarCategoria = useCallback(async ({ id, label, cor }) => {
    if (!id?.trim() || !label?.trim()) return;
    // Adiciona um item placeholder para criar a categoria
    await addDoc(collection(db, "catalogo_itens"), {
      categoriaId:    id.trim().toLowerCase().replace(/\s+/g,"_"),
      categoriaLabel: label.trim(),
      categoriaCor:   cor || "#4A4A4A",
      descricao:      "(clique para editar)",
      unidade:        "un",
      fabricante:     "",
      ordem:          9999,
      createdAt:      new Date().toISOString(),
    });
  }, []);

  return { categorias, loading, adicionarItem, editarItem, removerItem, adicionarCategoria };
}
