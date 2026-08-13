// src/constants/departamentos.test.js
import {
  getDepartamentoEfetivo,
  getAcesso,
  podeVer,
  podeEditar,
  isCampo,
  isExterno,
  isGestorOuAdm,
  isNivelIntermediario,
  resolverPerfilMenu,
  agendaPrivadaPorPadrao,
  temFiltroSoMinhaAgenda,
} from "./departamentos";

// ── Helpers de perfil ─────────────────────────────────────────────────────────
function perfil(dep, adm = false, legado = null) {
  return { departamento: legado ? undefined : dep, perfil: legado || dep, adm };
}
function perfilLegado(dep) {
  // Simula conta antiga: só tem "perfil", não tem "departamento"
  return { perfil: dep };
}

// ── getDepartamentoEfetivo ────────────────────────────────────────────────────
describe("getDepartamentoEfetivo", () => {
  it("retorna 'adm' se adm=true independente do departamento", () => {
    expect(getDepartamentoEfetivo({ adm: true, departamento: "campo" })).toBe("adm");
  });

  it("retorna 'campo' para perfil nulo", () => {
    expect(getDepartamentoEfetivo(null)).toBe("campo");
    expect(getDepartamentoEfetivo(undefined)).toBe("campo");
  });

  it("mapeia perfil legado 'gestor' para 'gestao'", () => {
    expect(getDepartamentoEfetivo(perfilLegado("gestor"))).toBe("gestao");
  });

  it("retorna o departamento correto para contas novas", () => {
    expect(getDepartamentoEfetivo({ departamento: "financeiro" })).toBe("financeiro");
    expect(getDepartamentoEfetivo({ departamento: "campo" })).toBe("campo");
  });
});

// ── isCampo ───────────────────────────────────────────────────────────────────
describe("isCampo", () => {
  it("retorna true para campo/empreiteiro/terceiro", () => {
    expect(isCampo({ departamento: "campo" })).toBe(true);
    expect(isCampo({ departamento: "empreiteiro" })).toBe(true);
    expect(isCampo({ departamento: "terceiro" })).toBe(true);
  });

  it("retorna false para gestão e financeiro", () => {
    expect(isCampo({ departamento: "gestao" })).toBe(false);
    expect(isCampo({ departamento: "financeiro" })).toBe(false);
  });

  it("retorna false para adm=true", () => {
    expect(isCampo({ adm: true, departamento: "campo" })).toBe(false);
  });

  it("retorna true para perfil nulo (padrão mais restritivo)", () => {
    expect(isCampo(null)).toBe(true);
  });
});

// ── isGestorOuAdm ─────────────────────────────────────────────────────────────
describe("isGestorOuAdm", () => {
  it("retorna true para gestao e adm", () => {
    expect(isGestorOuAdm({ departamento: "gestao" })).toBe(true);
    expect(isGestorOuAdm({ adm: true })).toBe(true);
  });

  it("retorna false para financeiro e campo", () => {
    expect(isGestorOuAdm({ departamento: "financeiro" })).toBe(false);
    expect(isGestorOuAdm({ departamento: "campo" })).toBe(false);
  });

  it("mapeia perfil legado 'gestor' corretamente", () => {
    expect(isGestorOuAdm(perfilLegado("gestor"))).toBe(true);
  });
});

// ── isExterno ─────────────────────────────────────────────────────────────────
describe("isExterno", () => {
  it("retorna true apenas para empreiteiro e terceiro", () => {
    expect(isExterno({ departamento: "empreiteiro" })).toBe(true);
    expect(isExterno({ departamento: "terceiro" })).toBe(true);
  });

  it("retorna false para campo e gestao", () => {
    expect(isExterno({ departamento: "campo" })).toBe(false);
    expect(isExterno({ departamento: "gestao" })).toBe(false);
  });
});

// ── resolverPerfilMenu ────────────────────────────────────────────────────────
describe("resolverPerfilMenu", () => {
  it("retorna 'gestor' para gestão e adm", () => {
    expect(resolverPerfilMenu({ departamento: "gestao" })).toBe("gestor");
    expect(resolverPerfilMenu({ adm: true })).toBe("gestor");
  });

  it("retorna 'encarregado' para financeiro/compras/comercial/fiscal", () => {
    ["financeiro","compras","comercial","fiscal"].forEach(dep => {
      expect(resolverPerfilMenu({ departamento: dep })).toBe("encarregado");
    });
  });

  it("retorna 'campo' para campo/empreiteiro/terceiro", () => {
    ["campo","empreiteiro","terceiro"].forEach(dep => {
      expect(resolverPerfilMenu({ departamento: dep })).toBe("campo");
    });
  });
});

// ── podeVer / podeEditar ──────────────────────────────────────────────────────
describe("podeVer e podeEditar", () => {
  it("gestão pode ver e editar obras", () => {
    const u = { departamento: "gestao" };
    expect(podeVer(u, "obras")).toBe(true);
    expect(podeEditar(u, "obras")).toBe(true);
  });

  it("campo pode ver obras mas não editar (acesso 'ver')", () => {
    const u = { departamento: "campo" };
    expect(podeVer(u, "obras")).toBe(true);
    expect(podeEditar(u, "obras")).toBe(false);
  });

  it("campo não tem acesso ao financeiro (valor 'ver')", () => {
    const u = { departamento: "campo" };
    expect(podeVer(u, "financeiro")).toBe(true);
    expect(podeEditar(u, "financeiro")).toBe(false);
  });

  it("adm=true tem acesso master a tudo", () => {
    const u = { adm: true };
    expect(podeEditar(u, "financeiro")).toBe(true);
    expect(podeEditar(u, "funcionarios")).toBe(true);
  });

  it("perfil nulo cai no fallback campo", () => {
    expect(podeEditar(null, "financeiro")).toBe(false);
    expect(podeVer(null, "obras")).toBe(true);
  });
});

// ── agendaPrivadaPorPadrao / temFiltroSoMinhaAgenda ──────────────────────────
describe("regras de agenda", () => {
  it("gestao e financeiro têm agenda privada por padrão", () => {
    expect(agendaPrivadaPorPadrao({ departamento: "gestao" })).toBe(true);
    expect(agendaPrivadaPorPadrao({ departamento: "financeiro" })).toBe(true);
  });

  it("campo não tem agenda privada por padrão", () => {
    expect(agendaPrivadaPorPadrao({ departamento: "campo" })).toBe(false);
  });

  it("fiscal e gestao têm filtro 'só minha agenda'", () => {
    expect(temFiltroSoMinhaAgenda({ departamento: "fiscal" })).toBe(true);
    expect(temFiltroSoMinhaAgenda({ departamento: "gestao" })).toBe(true);
  });

  it("campo não tem filtro 'só minha agenda'", () => {
    expect(temFiltroSoMinhaAgenda({ departamento: "campo" })).toBe(false);
  });
});
