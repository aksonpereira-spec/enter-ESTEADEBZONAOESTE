# Plano: Integrar Planilha Financeira + Corrigir Bugs

## Contexto
A planilha "Controle Financeiro Zona Oeste 2026" tem estrutura específica:
- **4 colunas de pagamento**: Dinheiro | Pix/Depósito/Transferência | Cartão Assinatura (-4% taxa) | Cartão Débito (-1.7% taxa)
- **27 alunos** cadastrados em Abril/2026 com pagamentos individuais
- **Resumo financeiro**: totais por forma, taxas dos cartões, comissão coordenação 12% = R$ 353,08
- **Disciplinas**: INTRODUÇÃO A TEOLOGIA (Cláudio Ananias) e TEONTOLOGIA (Sérgio Lins)

---

## 1. Banco de Dados (migrations)

**Adicionar colunas a `mensalidades`:**
```sql
ALTER TABLE mensalidades ADD COLUMN IF NOT EXISTS dinheiro NUMERIC(10,2) DEFAULT 0;
ALTER TABLE mensalidades ADD COLUMN IF NOT EXISTS pix_deposito NUMERIC(10,2) DEFAULT 0;
ALTER TABLE mensalidades ADD COLUMN IF NOT EXISTS cartao_assinatura NUMERIC(10,2) DEFAULT 0;
ALTER TABLE mensalidades ADD COLUMN IF NOT EXISTS cartao_debito NUMERIC(10,2) DEFAULT 0;
```
Manter `valor` como total calculado (soma das 4). Manter `forma_pagamento` para legado.

**Adicionar a `classes`:**
```sql
ALTER TABLE classes ADD COLUMN IF NOT EXISTS honorario NUMERIC(10,2) DEFAULT 0;
```

**Importar dados via CTE (só se tabela `alunos` estiver vazia):**
- Criar turma "Zona Oeste 2026 — Noite"
- Inserir 27 alunos
- Inserir mensalidades de Abril/2026 com valores corretos de cada coluna

---

## 2. Tipos (src/types/school.ts)
Adicionar ao `Mensalidade`:
```typescript
dinheiro: number;
pixDeposito: number;
cartaoAssinatura: number;
cartaoDebito: number;
```
Remover `formaPagamento` do cálculo principal (mantido só para legado).

---

## 3. MensalidadeTab — Substituir 1 coluna por 4
Arquivos: `src/components/tabs/MensalidadeTab.tsx`

**MensalidadeRow:**
- Substituir `forma` + `valor` por 4 campos: `dinheiro`, `pix`, `cartAss`, `cartDeb` (todos com estado local, `onBlur` para salvar)
- `total` = soma das 4 (mostrado como readonly)
- Situação continua automática: se total > 0 → "Pago", senão "Pendente"

**Cabeçalho da tabela:**
| Aluno | Turma | Dinheiro | Pix/Dep/Transf | Cart.Ass | Cart.Déb | Total | Apostilas | Qtd | Obs | Situação |

---

## 4. Nova aba: FinanceiroTab
Arquivo novo: `src/components/tabs/FinanceiroTab.tsx`

**Seção Resumo Financeiro (por mês):**
- Filtro por mês e turma
- Tabela de totais:
  - Dinheiro: R$ X | qtd
  - Pix/Dep/Transf: R$ X | qtd
  - Cartão Assinatura: bruto R$ X → (-4%) → líquido R$ X | qtd
  - Cartão Débito: bruto R$ X → (-1.7%) → líquido R$ X | qtd
  - **Total Bruto** / **Total Líquido**
- **Comissão Coordenação**: campo % editável (default 12%), valor calculado
- Botão "Exportar Relatório Financeiro PDF" (espelho do resumo da planilha)

**Seção Honorários Professores:**
- Lista de turmas com professor + campo honorário editável
- Total de honorários do mês

---

## 5. MainApp — Adicionar aba Financeiro
Arquivo: `src/pages/MainApp.tsx`

Adicionar ao array TABS:
```typescript
{ id: 'financeiro', label: 'Financeiro', icon: BarChart3, desc: 'Resumo financeiro e comissões' }
```

---

## 6. Correção de Bugs

**Bug do `onSaved` duplo:**
No `MensalidadeRow.upsert`, remover o `onSaved()` interno do else branch. Chamar apenas nos handlers (`handleSituacao`, `handleForma`, `handleApostilas`) quando necessário.

**Bug de situação automática:**
Ao salvar 4 colunas, recalcular situação = `total > 0 ? 'Pago' : 'Pendente'` automaticamente.

---

## Arquivos a modificar/criar:
1. `supabase/migrations/migration_XXXX` — schema + data import
2. `src/types/school.ts` — add 4 payment fields
3. `src/components/tabs/MensalidadeTab.tsx` — refactor com 4 colunas
4. `src/components/tabs/FinanceiroTab.tsx` — **NOVO**
5. `src/pages/MainApp.tsx` — adicionar aba Financeiro

## Verificação:
- Aba Mensalidade mostra 4 colunas de pagamento editáveis
- Situação muda automaticamente quando valor > 0
- Aba Financeiro mostra resumo com taxas e comissão
- 27 alunos da Zona Oeste aparecem no sistema
- PDF exportado reflete a estrutura da planilha
- Zero erros de lint
