// src/hooks/useCatalogoItens.js
import { useState, useEffect, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { CATEGORIAS_COMPRAS } from "../constants/itensCompras";

export function useCatalogoItens() {
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeded,  setSeeded]  = useState(false);

  // ── Listener em tempo real ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "catalogo_itens"), snap => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      if (snap.size > 0) return;
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

  // ── Categorias derivadas — sempre inclui as do seed mesmo sem docs ────────
  const categorias = (() => {
    const map = new Map();
    for (const cat of CATEGORIAS_COMPRAS) {
      map.set(cat.id, { id: cat.id, label: cat.label, cor: cat.cor, itens: [] });
    }
    for (const d of docs) {
      if (!map.has(d.categoriaId)) {
        map.set(d.categoriaId, { id: d.categoriaId, label: d.categoriaLabel, cor: d.categoriaCor || "#4A4A4A", itens: [] });
      }
      map.get(d.categoriaId).itens.push(d);
    }
    for (const cat of map.values()) {
      cat.itens.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
    }
    return Array.from(map.values());
  })();

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const adicionarItem = useCallback(async (categoriaId, { descricao, unidade, fabricante = "" }) => {
    if (!descricao?.trim()) return;

    // FIX: busca metadados da categoria no seed local como fallback
    // (não depende do Firestore ter itens — funciona mesmo com coleção vazia)
    const catSeed = CATEGORIAS_COMPRAS.find(c => c.id === categoriaId);
    const catDocs = docs.find(d => d.categoriaId === categoriaId);
    const catLabel = catSeed?.label || catDocs?.categoriaLabel || categoriaId;
    const catCor   = catSeed?.cor   || catDocs?.categoriaCor   || "#4A4A4A";

    const maxOrdem = docs.filter(d => d.categoriaId === categoriaId)
      .reduce((max, d) => Math.max(max, d.ordem ?? 0), 0);

    await addDoc(collection(db, "catalogo_itens"), {
      categoriaId,
      categoriaLabel: catLabel,
      categoriaCor:   catCor,
      descricao:      descricao.trim(),
      unidade:        unidade || "un",
      fabricante:     fabricante.trim(),
      ordem:          maxOrdem + 1,
      createdAt:      new Date().toISOString(),
    });
  }, [docs]);

  const editarItem = useCallback(async (id, campos) => {
    await updateDoc(doc(db, "catalogo_itens", id), { ...campos, updatedAt: new Date().toISOString() });
  }, []);

  const removerItem = useCallback(async (id) => {
    await deleteDoc(doc(db, "catalogo_itens", id));
  }, []);

  const adicionarCategoria = useCallback(async ({ id, label, cor }) => {
    if (!label?.trim()) return;
    const safeId = (id || label).trim().toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");
    await addDoc(collection(db, "catalogo_itens"), {
      categoriaId:    safeId,
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
