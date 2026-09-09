# Auditoria Afine Obras — Plano de Correção

## FASE 1 — P0 (Bloqueantes críticos)
- [ ] firestore.rules: regra notificações `{id}` → `items/{id}`
- [ ] firestore.rules: adicionar match para coleção `gerenciamento`
- [ ] firestore.rules: adicionar match para coleção `garantias`
- [ ] firestore.rules: `financeiro` dept bloqueado de /financeiro (usar isEncarregado)

## FASE 2 — P1 (Graves)
- [ ] firestore.rules: campo não edita compra após criar
- [ ] Manutencao.js: `isGestor = !isCampo` incorreto
- [ ] Funcionarios.js: criação sem audit trail

## FASE 3 — P2 (Inconsistências)
- [ ] firestore.rules: campo bloqueado de ler clientes
- [ ] firestore.rules: historico de obras ilegível para campo
- [ ] firestore.rules: agendamentos bloqueados para campo
- [ ] Compras.js: gestao sem adm não aprova compras de obra
- [ ] Obras.js: fiscal como gestor local incorreto

## FASE 4 — P3 (Limpeza)
- [ ] Remover dead imports (Despesas.js, Manutencao.js)
- [ ] NOTIF constants não utilizados — implementar ou remover
