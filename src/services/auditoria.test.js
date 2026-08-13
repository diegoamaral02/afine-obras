// src/services/auditoria.test.js
// Testes unitários do serviço de auditoria com Firebase mockado.

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...args) => ({ _col: args })),
  doc:        jest.fn((...args) => ({ id: "mock-id", _path: args })),
  writeBatch: jest.fn(),
  addDoc:     jest.fn(),
  deleteDoc:  jest.fn(),
}));

jest.mock("../firebase", () => ({ db: {} }));

const firestore = require("firebase/firestore");
const { addComAuditoria, updateComAuditoria, deleteComAuditoria } = require("./auditoria");

let mockBatch;

beforeEach(() => {
  jest.clearAllMocks();

  // Restaura implementações após clearAllMocks
  firestore.collection.mockImplementation((...args) => ({ _col: args }));
  firestore.doc.mockImplementation((...args) => ({ id: "mock-id", _path: args }));

  mockBatch = {
    set:    jest.fn(),
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };
  firestore.writeBatch.mockReturnValue(mockBatch);
  firestore.addDoc.mockResolvedValue({ id: "new-audit-id" });
  firestore.deleteDoc.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────

describe("addComAuditoria", () => {
  it("usa writeBatch e commita uma única vez", async () => {
    await addComAuditoria("obras", { nome: "Obra A" }, "uid123", "João");

    expect(firestore.writeBatch).toHaveBeenCalledTimes(1);
    expect(mockBatch.set).toHaveBeenCalledTimes(2); // doc principal + audit_log
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it("retorna a referência do novo documento", async () => {
    const ref = await addComAuditoria("obras", { nome: "X" }, "u1", "Ana");
    expect(ref).toBeDefined();
    expect(ref.id).toBeDefined();
  });

  it("inclui createdAt e createdBy no payload do doc principal", async () => {
    await addComAuditoria("obras", { nome: "Test" }, "u1", "Ana");
    const [_newRef, payload] = mockBatch.set.mock.calls[0];
    expect(payload).toMatchObject({ createdBy: "u1", nome: "Test" });
    expect(payload.createdAt).toBeTruthy();
  });

  it("grava audit_log com acao='create'", async () => {
    await addComAuditoria("obras", { nome: "Test" }, "u1", "Ana");
    const [_logRef, logPayload] = mockBatch.set.mock.calls[1];
    expect(logPayload).toMatchObject({
      colecao: "obras", acao: "create",
      alteradoPor: "u1", alteradoPorNome: "Ana",
    });
  });
});

describe("updateComAuditoria", () => {
  it("usa writeBatch com set+set+update e commita uma única vez", async () => {
    await updateComAuditoria("obras", "doc1", { status: "CONCLUÍDA" }, "u2", "Maria");

    expect(firestore.writeBatch).toHaveBeenCalledTimes(1);
    expect(mockBatch.set).toHaveBeenCalledTimes(2);    // historico + audit_log
    expect(mockBatch.update).toHaveBeenCalledTimes(1); // doc principal
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it("grava historico com tipo='update' e os campos alterados", async () => {
    await updateComAuditoria("obras", "doc1", { status: "OK" }, "u2", "Maria");
    const [_hRef, hPayload] = mockBatch.set.mock.calls[0];
    expect(hPayload).toMatchObject({
      tipo: "update",
      campos: { status: "OK" },
      alteradoPor: "u2",
      alteradoPorNome: "Maria",
    });
  });

  it("inclui updatedAt e updatedBy no batch.update do doc principal", async () => {
    await updateComAuditoria("obras", "doc1", { status: "OK" }, "u2", "Maria");
    const [_docRef, updatePayload] = mockBatch.update.mock.calls[0];
    expect(updatePayload).toMatchObject({ status: "OK", updatedBy: "u2" });
    expect(updatePayload.updatedAt).toBeTruthy();
  });

  it("se commit falhar, propaga o erro (sem escrita parcial)", async () => {
    mockBatch.commit.mockRejectedValue(new Error("network unavailable"));
    await expect(
      updateComAuditoria("obras", "doc1", { status: "OK" }, "u2", "Maria")
    ).rejects.toThrow("network unavailable");
  });
});

describe("deleteComAuditoria", () => {
  it("grava audit_log com acao='delete' antes de deletar", async () => {
    const snapshot = { nome: "Obra A", status: "CONCLUÍDA" };
    await deleteComAuditoria("obras", "doc1", "u3", "Carlos", snapshot);

    expect(firestore.addDoc).toHaveBeenCalledTimes(1);
    const logPayload = firestore.addDoc.mock.calls[0][1];
    expect(logPayload).toMatchObject({
      colecao: "obras", docId: "doc1", acao: "delete",
      snapshot, alteradoPor: "u3", alteradoPorNome: "Carlos",
    });
    expect(firestore.deleteDoc).toHaveBeenCalledTimes(1);
  });

  it("suporta snapshot nulo (sem dados)", async () => {
    await deleteComAuditoria("obras", "doc1", "u3", "Carlos");
    const logPayload = firestore.addDoc.mock.calls[0][1];
    expect(logPayload.snapshot).toBeNull();
  });
});
