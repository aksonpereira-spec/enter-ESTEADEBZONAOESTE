# Plano: Ajustes e Melhorias no Sistema

## Contexto
Cinco melhorias solicitadas para o sistema ESTEADEB Núcleo Zona Oeste, mantendo todos os dados e funcionalidades atuais.

---

## 1. Campo de Observações (MensalidadeTab)

**Problema:** Coluna obs usa `hidden xl:table-cell` (invisível em telas < 1280px) + bug de save (estado `obs` desatualizado no `onBlur`).

**Solução:**
- Remover obs da tabela como coluna.
- Adicionar botão `ChevronDown` em cada linha que expande uma sub-linha (segundo `<tr>`) com campo obs visível, apostilas e qtd (que também estão ocultos em lg).
- Corrigir o save: `onBlur={e => upsert({ obs: e.target.value })}` para usar o valor imediato do evento em vez do estado stale.

**Arquivo:** `src/components/tabs/MensalidadeTab.tsx`

---

## 2. Aba Turma – Módulos e Disciplinas

### DB Migration (uma migração)
```sql
-- Adicionar colunas à tabela classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS data_aula DATE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS horario TEXT DEFAULT '';

-- Tabela de módulos
CREATE TABLE IF NOT EXISTS modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_modulos" ON modulos FOR ALL USING (true) WITH CHECK (true);

-- Tabela de disciplinas
CREATE TABLE IF NOT EXISTS disciplinas_turma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id UUID REFERENCES modulos(id) ON DELETE CASCADE NOT NULL,
  numero INT DEFAULT 1,  -- 1 ou 2
  nome TEXT NOT NULL DEFAULT '',
  professor TEXT DEFAULT '',
  honorario NUMERIC(10,2) DEFAULT 0,
  horario TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE disciplinas_turma ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_disciplinas" ON disciplinas_turma FOR ALL USING (true) WITH CHECK (true);
```

### TurmasTab – Nova UI
- Manter lista de cards de turmas existente.
- Cada card agora tem campos: **Nome, Turno, Dias da Semana, Data, Horário Geral, Núcleo** no form.
- Cada turma tem seção expansível "Módulos" com botão "Adicionar Módulo".
- Cada módulo mostra nome + 2 disciplinas (Disciplina 1 e 2), cada com: nome, professor, honorário, horário.
- CRUD completo para módulos e disciplinas (inline, sem páginas novas).
- O campo `honorario` da tabela `classes` não será mais exibido/usado (substituído pelo honorário por disciplina).

**Arquivo:** `src/components/tabs/TurmasTab.tsx` (reescrever)

### FinanceiroTab – Honorários Atualizados
- Na seção "Honorários dos Professores", buscar de `disciplinas_turma` via `modulos` em vez de `classes.honorario`.
- Mostrar: Turma → Módulo → Professor → Disciplina → Honorário.
- Somar totais por professor e global.
- Incluir nos PDFs.

**Arquivo:** `src/components/tabs/FinanceiroTab.tsx`

---

## 3. Relatórios em Excel (FinanceiroTab)

**Biblioteca:** adicionar `xlsx` via `add_dependency`.

**Novo botão:** "Exportar Excel" ao lado de "Exportar PDF Financeiro".

**Conteúdo do Excel (3 abas):**
1. **Resumo** – Mesmo conteúdo do PDF (formas de pagamento, totais, comissão, honorários).
2. **Mensalidades por Aluno** – Colunas: Matrícula, Nome, Turma, Situação, Dinheiro, Pix, Cartão Ass., Cartão Déb., Total, Apostilas, Qtd Apostilas, Observações.
3. **Apostilas** – Apenas alunos com apostilas = 'Sim': Nome, Turma, Qtd, Mês.

Para a aba 2 e 3, buscar mensalidades com JOIN de alunos (já feito no `loadData`, expandir para incluir `obs`).

**Arquivo:** `src/components/tabs/FinanceiroTab.tsx`

---

## 4. Tipo/Bolsa – Botão de Edição Rápida (AlunosTab)

Na coluna "Bolsa" da tabela de alunos, adicionar um ícone de edição (Edit2) ao lado do badge. Ao clicar, abre um `Popover` (shadcn já instalado) com um `Select` inline de TipoBolsa. Ao confirmar, salva direto no Supabase e atualiza o estado local.

**Arquivo:** `src/components/tabs/AlunosTab.tsx`

---

## 5. Campos Obrigatórios no Cadastro Online (StudentPortal)

Em `saveProfile()`, adicionar validação:
```typescript
if (!profile.nome_completo.trim()) { toast.error('Nome Completo é obrigatório'); return; }
if (!profile.telefone.trim() && !profile.celular1.trim()) { toast.error('Telefone é obrigatório'); return; }
```

Adicionar marcador `*` e classe `border-red-300` nos campos Nome Completo e Telefone quando vazios ao tentar salvar.

**Arquivo:** `src/pages/StudentPortal.tsx`

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/components/tabs/MensalidadeTab.tsx` | Fix obs (visibilidade + save bug) |
| `src/components/tabs/TurmasTab.tsx` | Reescrever com módulos/disciplinas |
| `src/components/tabs/FinanceiroTab.tsx` | Excel export + honorários por disciplina |
| `src/components/tabs/AlunosTab.tsx` | Botão edição rápida Tipo/Bolsa |
| `src/pages/StudentPortal.tsx` | Validação nome + telefone obrigatórios |
| `src/types/school.ts` | Adicionar tipos `Modulo`, `DisciplinaTurma` |
| DB Migration | Tabelas `modulos`, `disciplinas_turma`; colunas `data_aula`, `horario` em `classes` |

## Verificação
- [ ] Obs aparece e salva corretamente ao editar e sair do campo
- [ ] Turma exibe módulos com 2 disciplinas, honorários por professor
- [ ] Excel gerado com 3 abas completas
- [ ] Botão edição bolsa funciona inline sem abrir form completo
- [ ] Portal recusa salvar sem nome completo ou telefone
