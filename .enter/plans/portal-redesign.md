# Multi-tenancy: Portal Núcleo ESTEADEB

## Contexto
Transformar o sistema em multi-tenant para que qualquer coordenador com email @esteadeb.org.br possa fazer login e ter seu próprio banco de dados isolado. O coordenador Zona Oeste (admin/1234) mantém seu acesso e dados existentes.

## Decisões
- `admin/1234` continua funcionando para Zona Oeste (ID fixo: `'00000000-0000-0000-0000-000000000001'`)
- Coordenadores `@esteadeb.org.br` usam tabela `diretores` (já existente), com `diretores.id` como seu `coordenador_id`
- **Todos os dados são filtrados por `coordenador_id`** — sem compartilhamento entre núcleos
- Dados existentes do Zona Oeste recebem `coordenador_id = ZONA_OESTE_ID`

---

## Fase 1 — Migração do Banco

Adicionar `coordenador_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'` a 17 tabelas:

```
alunos, classes, mensalidades, notas_aluno, calendario_aulas,
nucleo_config, estoque_materiais, loja_pedidos, loja_usuarios,
student_profiles, observacoes_portal, portal_acessos,
attendance_sessions, portal_arquivos, disciplinas_turma,
modulos, honorarios_pagamentos
```

Após adicionar colunas: `UPDATE tabela SET coordenador_id = '00000000-0000-0000-0000-000000000001'` em todas.

---

## Fase 2 — AuthContext

Adicionar `coordenadorId: string | null` ao contexto:
- Login `admin` → `coordenadorId = '00000000-0000-0000-0000-000000000001'`
- Login director → `coordenadorId = diretores.id` (buscar após autenticar)
- Expor via `useAuth().coordenadorId`

---

## Fase 3 — Todos os Tab Components

Em cada componente, adicionar:
```typescript
const { coordenadorId } = useAuth();
```

E filtrar TODAS as queries:
- SELECT: `.eq('coordenador_id', coordenadorId)`
- INSERT: incluir `coordenador_id: coordenadorId` no payload
- UPDATE/DELETE: já são filtrados por `id` (ok)

**Arquivos a modificar:**
- `src/components/tabs/AlunosTab.tsx`
- `src/components/tabs/TurmasTab.tsx`
- `src/components/tabs/MensalidadeTab.tsx`
- `src/components/tabs/ChamadaTab.tsx`
- `src/components/tabs/FinanceiroTab.tsx`
- `src/components/tabs/FichasTab.tsx`
- `src/components/tabs/EstoqueTab.tsx`
- `src/components/tabs/CalendarioTab.tsx`
- `src/components/tabs/MensagensTab.tsx`
- `src/components/tabs/MonitoramentoTab.tsx`
- `src/components/tabs/ConfigTab.tsx`
- `src/pages/PortalAluno.tsx`
- `src/pages/LojaAluno.tsx`

---

## Fase 4 — ConfigTab: Setup Wizard

Quando `nucleo_config` não tiver registro para o `coordenador_id` atual, exibir tela de boas-vindas/setup pedindo:
- Nome do Núcleo
- Nome do Coordenador
- Nome da Esposa (opcional)
- Ano

Após salvar, cria registro na `nucleo_config` com `coordenador_id`.

---

## Fase 5 — Branding

- `src/pages/Login.tsx`: trocar "ESTEADEB NÚCLEO ZONA OESTE" → "Portal Núcleo ESTEADEB"
- `src/pages/MainApp.tsx`: nada muda (usa `nucleo_config` dinamicamente já)
- `src/pages/PortalAluno.tsx`: cabeçalho "Portal ESTEADEB" genérico

---

## Arquivos Modificados (resumo)
1. `supabase/migrations/` — 1 migration script grande
2. `src/contexts/AuthContext.tsx` — adicionar `coordenadorId`
3. `src/components/tabs/*.tsx` — todos os 11 tabs
4. `src/pages/PortalAluno.tsx` — queries filtradas
5. `src/pages/LojaAluno.tsx` — queries filtradas
6. `src/pages/Login.tsx` — branding genérico
