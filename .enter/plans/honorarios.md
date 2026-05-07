# Plano: Controle Individual de Baixa de Honorários

## Contexto
O usuário quer que os honorários na aba Financeiro:
1. Só apareçam se houver pelo menos uma chamada (attendance_sessions) registrada para aquela turma no mês selecionado
2. Cada honorário possa ser dado baixa manualmente (botão por linha)
3. No mês seguinte, a lista começa vazia (sem chamadas = sem honorários)

## Arquivos Modificados
- `src/components/tabs/FinanceiroTab.tsx`

## DB Migration
Nova tabela `honorarios_pagamentos`:
```sql
CREATE TABLE honorarios_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disciplina_turma_id UUID REFERENCES disciplinas_turma(id) ON DELETE CASCADE,
  mes TEXT NOT NULL,
  pago_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(disciplina_turma_id, mes)
);
ALTER TABLE honorarios_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON honorarios_pagamentos FOR ALL USING (true) WITH CHECK (true);
```

## Mudanças em FinanceiroTab.tsx

### 1. Interface DiscHonorario — adicionar id
```ts
interface DiscHonorario {
  disciplinaTurmaId: string; // novo — usado para dar baixa
  turmaId: string; turmaName: string; moduloNome: string;
  nome: string; professor: string; honorario: number;
  pago?: boolean; pagoEm?: string;
}
```

### 2. loadData — 3 consultas extras
- `attendance_sessions` para o mês selecionado → extrair `turma_id`s únicos com chamada
- `honorarios_pagamentos` para o mês selecionado → saber quais já foram pagos
- Filtrar `discs` para incluir apenas disciplinas cujo `turma_id` aparece nas sessões do mês
- Popular flag `pago` e `pagoEm` em cada `DiscHonorario`

### 3. Funções novas
```ts
const darBaixa = async (disciplinaTurmaId: string) => {
  await supabase.from('honorarios_pagamentos')
    .insert({ disciplina_turma_id: disciplinaTurmaId, mes: selectedMonth });
  toast.success('Honorário dado baixa'); loadData();
};

const desfazerBaixa = async (disciplinaTurmaId: string) => {
  await supabase.from('honorarios_pagamentos')
    .delete().eq('disciplina_turma_id', disciplinaTurmaId).eq('mes', selectedMonth);
  toast.success('Baixa desfeita'); loadData();
};
```

### 4. UI — tabela de honorários
Cada linha ganha:
- **Se pago**: badge verde "Baixado" + data + botão "Desfazer" (ícone X pequeno)
- **Se não pago**: botão "Dar Baixa" (ícone Check)

Cabeçalho da tabela: adicionar coluna "Situação"

Mostrar mensagem se não há chamadas no mês:
```
"Nenhuma chamada registrada neste mês — os honorários aparecerão após a primeira chamada ser lançada"
```

### 5. totalHonorarios
Calcular total apenas dos honorários não pagos (pendentes) e separar total pago.

## Verificação
1. Mês sem chamadas → lista de honorários vazia com mensagem explicativa
2. Mês com chamadas → honorários das turmas com sessões aparecem
3. Clicar "Dar Baixa" → badge "Baixado" aparece na linha, botão vira "Desfazer"
4. Próximo mês → lista vazia novamente (sem chamadas ainda)
5. PDF export continua funcionando com os dados filtrados
