# Plan: Financial Info + Observações on Student Portal

## Context
The user wants:
1. Financial info (mensalidades) shown on the student portal — both on the Início screen and as a dedicated "Financeiro" tab
2. A field for students to send complaints, observations or questions
3. Admin ability to upload a PDF comprovante (receipt) per student per mensalidade in AlunosTab
4. Students can view their mensalidades read-only, and download comprovantes if attached

## Existing Data
- `mensalidades` table already exists with: `aluno_id, mes, valor, situacao, forma_pagamento, dinheiro, pix_deposito, cartao_assinatura, cartao_debito, obs, apostilas`
- `AlunosTab.tsx` already has a Dialog pattern for notes (GraduationCap button) — reuse same pattern for financial

---

## Changes

### 1. DB Migration
```sql
-- Add comprovante fields to mensalidades
ALTER TABLE mensalidades
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS comprovante_path TEXT DEFAULT '';

-- Create observacoes_portal table
CREATE TABLE IF NOT EXISTS observacoes_portal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  mensagem TEXT NOT NULL DEFAULT '',
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE observacoes_portal ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_obs ON observacoes_portal FOR ALL USING (true) WITH CHECK (true);
```

### 2. Storage bucket `comprovantes`
- Public bucket
- Anon policies: INSERT, SELECT, DELETE (same pattern as `portal-docs`)

### 3. `AlunosTab.tsx`
- Import `DollarSign` icon
- Add state: `financeiroDialog: { alunoId: string; nome: string } | null`, `mensalidadesAluno: MensalidadeRow[]`, `uploadingComp: string | null`
- Add `DollarSign` button per student row (alongside GraduationCap)
- Dialog content:
  - Load all mensalidades for that aluno ordered by mes desc
  - Show table: Mês | Valor | Situação | Forma Pgto | Comprovante
  - Each row: if comprovante_url exists show "Ver PDF" link; else show "Upload PDF" button
  - Upload stores to `comprovantes/{alunoId}/{mes}_{filename}` bucket, updates mensalidades row

### 4. `PortalAluno.tsx`
**Tabs (6):** Início | Notas | Calendário | Financeiro | Minha Ficha | Documentos

**loadMensalidades(alunoId)**: fetch mensalidades ordered by mes desc

**loadObservacoes(alunoId)**: fetch observacoes_portal

**Tab INÍCIO — add 2 new sections:**

A. Financial Summary Card (above nav cards):
- Shows last 3 months of mensalidades
- Each: badge showing Pago (green) / Pendente (amber) / Atrasado (red) + value
- If inadimplente: show alert banner in red

B. Observações Card (below nav cards):
- Textarea: "Observações, reclamações ou dúvidas"
- "Enviar" button → inserts to `observacoes_portal`
- Shows last 3 submitted observations (read-only preview)

**New Tab FINANCEIRO:**
- Header: "Situação Financeira"
- Full table of all mensalidades (read-only)
- Columns: Mês/Ano | Valor | Situação | Forma de Pagamento | Observação | Comprovante
- Comprovante: "Ver comprovante" link if comprovante_url exists, else "—"
- Footer: total pago, total pendente

---

## Files Changed
- `supabase/migrations/migration_XXXX.sql` — new migration
- `src/components/tabs/AlunosTab.tsx` — add financial comprovante upload dialog
- `src/pages/PortalAluno.tsx` — add financeiro tab + início sections + observações
