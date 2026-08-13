// src/utils/offlineQueue.test.js
import {
  enfileirar, listarFila, tamanhoFila,
  removerDaFila, processarFila, salvarComFallbackOffline,
} from "./offlineQueue";

// ── Mock do localStorage ──────────────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// ── enfileirar / listar / tamanho ─────────────────────────────────────────────
describe("enfileirar", () => {
  it("adiciona item à fila e retorna um id", () => {
    const id = enfileirar("obra:create", { nome: "Obra X" });
    expect(id).toBeTruthy();
    expect(listarFila()).toHaveLength(1);
    expect(listarFila()[0]).toMatchObject({ tipo: "obra:create", payload: { nome: "Obra X" } });
  });

  it("acumula múltiplos itens em ordem", () => {
    enfileirar("obra:create", { a: 1 });
    enfileirar("obra:update", { b: 2 });
    const fila = listarFila();
    expect(fila).toHaveLength(2);
    expect(fila[0].tipo).toBe("obra:create");
    expect(fila[1].tipo).toBe("obra:update");
  });

  it("tamanhoFila reflete o número de itens", () => {
    expect(tamanhoFila()).toBe(0);
    enfileirar("x", {});
    expect(tamanhoFila()).toBe(1);
    enfileirar("y", {});
    expect(tamanhoFila()).toBe(2);
  });
});

describe("removerDaFila", () => {
  it("remove apenas o item pelo id", () => {
    const id1 = enfileirar("a", {});
    const id2 = enfileirar("b", {});
    removerDaFila(id1);
    const fila = listarFila();
    expect(fila).toHaveLength(1);
    expect(fila[0].id).toBe(id2);
  });

  it("não faz nada com id inexistente", () => {
    enfileirar("a", {});
    removerDaFila("id-que-nao-existe");
    expect(tamanhoFila()).toBe(1);
  });
});

// ── processarFila ─────────────────────────────────────────────────────────────
describe("processarFila", () => {
  it("retorna { sucesso:0, falha:0 } com fila vazia", async () => {
    const result = await processarFila({});
    expect(result).toEqual({ sucesso: 0, falha: 0 });
  });

  it("executa o executor correto e remove o item em sucesso", async () => {
    enfileirar("obra:create", { nome: "Obra A" });
    const executor = jest.fn().mockResolvedValue(undefined);
    const result = await processarFila({ "obra:create": executor });
    expect(executor).toHaveBeenCalledWith({ nome: "Obra A" });
    expect(result).toEqual({ sucesso: 1, falha: 0 });
    expect(tamanhoFila()).toBe(0);
  });

  it("mantém o item na fila se o executor lançar erro", async () => {
    enfileirar("obra:update", { id: "1" });
    const executor = jest.fn().mockRejectedValue(new Error("network"));
    const result = await processarFila({ "obra:update": executor });
    expect(result).toEqual({ sucesso: 0, falha: 1 });
    expect(tamanhoFila()).toBe(1);
  });

  it("conta como falha (sem remover) item cujo tipo não tem executor", async () => {
    enfileirar("tipo:desconhecido", {});
    const result = await processarFila({});
    expect(result).toEqual({ sucesso: 0, falha: 1 });
    expect(tamanhoFila()).toBe(1);
  });

  it("processa múltiplos itens e separa sucesso/falha corretamente", async () => {
    enfileirar("ok", { v: 1 });
    enfileirar("fail", { v: 2 });
    enfileirar("ok", { v: 3 });
    const executores = {
      ok:   jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockRejectedValue(new Error("err")),
    };
    const result = await processarFila(executores);
    expect(result).toEqual({ sucesso: 2, falha: 1 });
    expect(tamanhoFila()).toBe(1); // só o "fail" permanece
  });

  it("chama onProgresso para cada item", async () => {
    enfileirar("ok", {});
    const onProgresso = jest.fn();
    await processarFila({ ok: jest.fn().mockResolvedValue(undefined) }, onProgresso);
    expect(onProgresso).toHaveBeenCalledTimes(1);
    expect(onProgresso.mock.calls[0][0]).toMatchObject({ status: "ok" });
  });
});

// ── salvarComFallbackOffline ──────────────────────────────────────────────────
describe("salvarComFallbackOffline", () => {
  it("retorna { ok: true } quando a execução tem sucesso", async () => {
    const executar = jest.fn().mockResolvedValue(undefined);
    const result = await salvarComFallbackOffline("obra:create", { nome: "X" }, executar);
    expect(result).toEqual({ ok: true });
    expect(tamanhoFila()).toBe(0);
  });

  it("enfileira e retorna { ok: false, enfileirado: true } quando offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    const executar = jest.fn();
    const result = await salvarComFallbackOffline("obra:create", { nome: "X" }, executar);
    expect(result).toMatchObject({ ok: false, enfileirado: true });
    expect(executar).not.toHaveBeenCalled();
    expect(tamanhoFila()).toBe(1);
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  it("enfileira e retorna { ok: false, enfileirado: true } quando executar lança erro", async () => {
    const executar = jest.fn().mockRejectedValue(new Error("unavailable"));
    const result = await salvarComFallbackOffline("obra:update", { id: "1" }, executar);
    expect(result).toMatchObject({ ok: false, enfileirado: true });
    expect(tamanhoFila()).toBe(1);
  });
});
