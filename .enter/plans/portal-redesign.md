# Plano: Mensagens para o Coordenador

## O que muda

1. **DB** — adicionar `resposta` e `respondida_em` à tabela `observacoes_portal`
2. **PortalAluno.tsx** — renomear "Secretaria" → "Coordenador" e exibir respostas do coordenador
3. **Novo componente** `src/components/tabs/MensagensTab.tsx` — painel do coordenador para ler e responder mensagens dos alunos
4. **MainApp.tsx** — adicionar aba "Mensagens" ao painel admin

---

## Migration SQL
```sql
ALTER TABLE observacoes_portal
  ADD COLUMN IF NOT EXISTS resposta TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS respondida_em TIMESTAMPTZ DEFAULT NULL;
```

---

## MensagensTab.tsx (novo)
- Carrega todas as `observacoes_portal` com JOIN em `alunos (nome, matricula)`
- Lista mensagens separadas em "Não respondidas" e "Respondidas"
- Cada item mostra: nome do aluno, matrícula, mensagem, data, status
- Botão "Responder" abre área inline de textarea + salvar → grava `resposta` + `respondida_em` + `lida = true`
- Contador de não respondidas no cabeçalho
- Filtro por nome/matrícula

---

## PortalAluno.tsx (ajustes)
- "Fale com a Secretaria" → "Fale com o Coordenador" (todos os textos visíveis)
- Na lista de mensagens enviadas: se `resposta` não nulo, exibir card de resposta abaixo da mensagem original com label "Resposta do Coordenador"

---

## MainApp.tsx
- Importar `MensagensTab`
- Adicionar `{ id: 'mensagens', label: 'Mensagens', icon: MessageCircle, desc: 'Mensagens dos alunos para o coordenador' }` à lista TABS
- Adicionar `{activeTab === 'mensagens' && <MensagensTab />}` ao render
