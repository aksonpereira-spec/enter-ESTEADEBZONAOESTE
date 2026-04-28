# Plano: Aba Estoque + Área do Aluno (Loja)

## Contexto
Implementar um sistema completo de gestão de materiais (apostilas e camisas) com painel admin e área pública do aluno em `/loja`.

---

## 1. Banco de Dados (1 migração)

```sql
-- Tabela de materiais
CREATE TABLE estoque_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'Apostila',   -- 'Apostila' | 'Camisa'
  disciplina TEXT DEFAULT '',
  nome TEXT NOT NULL DEFAULT '',
  modulo INT DEFAULT 1,                    -- 1 a 44
  quantidade INT DEFAULT 0,
  valor_unitario NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Disponivel',        -- 'Disponivel' | 'Indisponivel'
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE estoque_materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_estoque" ON estoque_materiais FOR ALL USING (true) WITH CHECK (true);

-- Tabela de usuários da loja (auth simples)
CREATE TABLE loja_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE loja_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_loja_usuarios" ON loja_usuarios FOR ALL USING (true) WITH CHECK (true);

-- Tabela de pedidos
CREATE TABLE loja_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES loja_usuarios(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES estoque_materiais(id) NOT NULL,
  quantidade INT DEFAULT 1,
  valor_total NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Pendente',          -- 'Pendente' | 'Pago' | 'Entregue'
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE loja_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_loja_pedidos" ON loja_pedidos FOR ALL USING (true) WITH CHECK (true);
```

---

## 2. Arquivos a Criar/Modificar

| Arquivo | Ação |
|---|---|
| `src/components/tabs/EstoqueTab.tsx` | **Criar** — painel admin completo |
| `src/pages/LojaAluno.tsx` | **Criar** — área pública do aluno |
| `src/router.tsx` | **Modificar** — adicionar rota `/loja` |
| `src/pages/MainApp.tsx` | **Modificar** — adicionar aba Estoque |

---

## 3. EstoqueTab.tsx — Painel Admin (4 seções internas)

### Seção A: Link da Loja
- Card com URL gerada `{window.location.origin}/loja`
- Botão "Copiar Link"

### Seção B: Materiais (CRUD)
- Tabela de materiais cadastrados com: Tipo, Nome, Módulo, Disciplina, Qtd, Valor, Status
- Botão "Novo Material" abre formulário inline:
  - tipo (Select: Apostila/Camisa)
  - nome
  - disciplina (visível apenas se tipo=Apostila)
  - modulo (Select 1-44)
  - quantidade (inicial)
  - valor_unitario
  - status
- Botão "Entrada +" em cada linha para adicionar quantidade
- Botão "Editar" e "Excluir"
- Toggle rápido de status: Disponível / Indisponível

### Seção C: Pedidos dos Alunos
- Lista de todos pedidos com: Aluno, Material, Qtd, Total, Status, Data
- Filtro por status (Pendente/Pago/Entregue)
- Botão "Confirmar Pagamento" (Pendente → Pago)
- Botão "Marcar Entregue" (Pago → Entregue)

### Seção D: Usuários da Loja
- Lista de usuários cadastrados (nome, username, data)
- Pode deletar usuário se necessário

---

## 4. LojaAluno.tsx — Área do Aluno (/loja)

### Estado de auth
- `lojaUserId` / `lojaUserNome` em `useState` (session na página, sem localStorage por segurança mínima)
- Telas: 'login' | 'register' | 'loja' | 'meus-pedidos'

### Tela Login/Registro
- Tabs: Entrar / Cadastrar
- Campos: nome (só cadastro), usuário, senha
- Login: query `loja_usuarios WHERE username = $1 AND senha = $2`
- Registro: INSERT em `loja_usuarios`

### Tela Loja (após login)
- Header com nome do aluno + links "Meus Pedidos" / "Sair"
- Grid de cards dos materiais disponíveis (status = 'Disponivel' E quantidade > 0)
- Filtros: Tipo (todos/Apostila/Camisa), Disciplina
- Cada card: nome, módulo, disciplina, valor, badge Disponível
- Botão "Pedir" abre modal com: quantidade (1-10), mostra total, botão confirmar
- Ao confirmar: INSERT em `loja_pedidos`, decrementa quantidade em `estoque_materiais`

### Tela Meus Pedidos
- Lista de pedidos do usuário com: material, qtd, total, status (Pendente/Pago/Entregue), data
- Badges coloridos por status

---

## 5. Router e MainApp

**router.tsx:** Adicionar `{ path: '/loja', element: <LojaAluno /> }` como rota pública (sem ProtectedRoute)

**MainApp.tsx:** Adicionar aba "Estoque" com ícone `Package` entre as abas existentes

---

## 6. Regras de Negócio
- Ao adicionar quantidade por "Entrada +": atualiza `estoque_materiais.quantidade` e status → 'Disponivel'
- Ao fazer pedido: `quantidade` do material é decrementada; se chegar a 0 → status → 'Indisponivel'
- Só aparecem materiais com `status = 'Disponivel'` na loja do aluno
- Status do pedido muda apenas pelo admin (Pendente → Pago → Entregue)
