# Prompt de Kickoff — Gestão de Devolução CDD
> Cole diretamente no Claude Code para iniciar o desenvolvimento.

---

Você é um desenvolvedor sênior. Implemente do zero o sistema **GD — Gestão de Devolução de CDD**.
Stack: **Next.js 14 App Router + Tailwind + shadcn/ui + Supabase**.
Não me explique — apenas implemente. Comece pelo setup e avance módulo a módulo.

---

## 1. SISTEMA

Ferramenta web para gestão de devoluções de um CDD (Centro de Distribuição Direta).
Usuários: coordenadores, supervisores, CME/monitoramento e vendas.
Dados chegam via upload de planilha (.xlsx / .csv). O sistema processa, calcula indicadores e exibe dashboards.

---

## 2. STACK

- **Frontend:** Next.js 14 App Router + Tailwind + shadcn/ui
- **Banco + Auth + API:** Supabase (PostgreSQL + RLS + Auth email/senha)
- **Processamento de planilha:** SheetJS (xlsx)
- **Gráficos:** Recharts
- **Deploy:** EasyPanel (VPS)

---

## 3. ESTRUTURA DE PASTAS

```
/app
  /dashboard         → visão geral
  /devolucoes        → análise diária
  /ofensores         → ranking e matriz
  /pdvs              → PDVs reincidentes
  /reversoes         → reversões e repasses
  /raio              → aderência ao raio
  /motivos           → pareto de motivos
  /plano-acao        → gestão de ações
  /importacao        → upload de planilha
  /configuracoes     → metas e usuários
  /login             → autenticação
/components
  /ui                → shadcn components
  /charts            → wrappers recharts
  /tables            → tabelas com filtro
  /cards             → cards de indicador
/lib
  /supabase.ts       → client supabase
  /indicadores.ts    → funções de cálculo
  /planilha.ts       → parser SheetJS
  /utils.ts
/types
  index.ts
```

---

## 4. BANCO DE DADOS (Supabase — SQL)

```sql
-- Usuários e perfis
create table perfis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  nome text not null,
  role text not null check (role in ('admin','coordenador','supervisor','cme','consulta','vendas')),
  criado_em timestamptz default now()
);

-- Importações
create table importacoes (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text,
  data_importacao timestamptz default now(),
  status text default 'processando',
  total_linhas int,
  erros int default 0,
  user_id uuid references auth.users
);

-- Devoluções (tabela principal)
create table devolucoes (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid references importacoes(id),
  data_rota date,
  cdd text,
  motorista text,
  rota text,
  placa text,
  cliente text,
  codigo_pdv text,
  rn text, gv text, supervisor text, vendas text,
  motivo text,
  classificacao_motivo text check (classificacao_motivo in ('Mercado','Logístico','Vendas')),
  pdvs_faturados int,
  pdvs_devolvidos int,
  volume_faturado_hl numeric,
  volume_devolvido_hl numeric,
  alertas_apontados int default 0,
  devolucoes_revertidas int default 0,
  repasses_programados int default 0,
  repasses_informados int default 0,
  repasses_realizados int default 0,
  horario_apontamento time,
  horario_atendimento_cme time,
  horario_finalizacao time,
  status_final text check (status_final in ('entregue','devolvido','repasse','reversão','tratativa_aberta')),
  dentro_raio boolean,
  aderencia_raio numeric,
  devolucao_antes_horario boolean,
  evidencia text,
  recorrencia_pdv int default 0,
  qtd_devolucoes_anteriores int default 0,
  janela_entrega text,
  responsavel_acionado text,
  canal_contato text,
  resultado_contato text,
  criado_em timestamptz default now()
);

-- Indicadores diários (cache calculado)
create table indicadores_diarios (
  id uuid primary key default gen_random_uuid(),
  data_ref date,
  cdd text,
  devolucao_pdv_pct numeric,
  devolucao_hl_pct numeric,
  reversao_pct numeric,
  repasses_apontados_pct numeric,
  repasses_efetivos_pct numeric,
  tempo_medio_cme interval,
  tempo_medio_tratativa interval,
  devolucoes_apontadas_vs_total_pct numeric,
  aderencia_raio_pct numeric,
  devolucao_antes_horario_pct numeric,
  calculado_em timestamptz default now()
);

-- Plano de ação
create table plano_acao (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  responsavel text,
  prazo date,
  status text default 'aberto' check (status in ('aberto','em_andamento','concluido','cancelado')),
  prioridade text check (prioridade in ('critica','alta','media','monitoramento')),
  indicador_impactado text,
  evidencia text,
  comentarios text,
  criado_por uuid references auth.users,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Metas
create table metas (
  id uuid primary key default gen_random_uuid(),
  indicador text not null,
  valor_meta numeric not null,
  cdd text,
  vigencia_inicio date,
  vigencia_fim date
);
```

---

## 5. INDICADORES — FÓRMULAS EXATAS

Implementar em `/lib/indicadores.ts`. Usar exatamente estas fórmulas:

```ts
devolucao_pdv      = pdvs_devolvidos / pdvs_faturados * 100
devolucao_hl       = volume_devolvido_hl / volume_faturado_hl * 100
reversao           = devolucoes_revertidas / alertas_apontados * 100
repasses_apontados = repasses_programados / alertas_apontados * 100
repasses_efetivos  = devolucoes_revertidas_via_repasse / repasses_informados * 100
tempo_medio_cme    = média(horario_atendimento_cme - horario_apontamento)
tempo_medio_trat   = média(horario_finalizacao - horario_apontamento)
dev_apontadas_pct  = alertas_apontados / total_devolucoes * 100
aderencia_raio     = entregas_dentro_raio / total_entregas * 100
dev_antes_horario  = pedidos_devolvidos_antes_limite / total_devolvidos * 100
```

Se a variável necessária estiver ausente, retornar: `{ valor: null, erro: "Indicador não calculado: ausência de [variável]" }`

---

## 6. PROCESSAMENTO DA PLANILHA

Em `/lib/planilha.ts`, implementar:

1. Ler `.xlsx` ou `.csv` com SheetJS
2. Mapear colunas automaticamente por similaridade de nome (ex: "dt_rota" → `data_rota`)
3. Validar colunas mínimas obrigatórias: `data_rota`, `motorista`, `pdvs_faturados`, `pdvs_devolvidos`
4. Apontar colunas ausentes sem travar o processo
5. Padronizar: datas → ISO, horários → HH:MM, texto → trim + toLowerCase
6. Inserir no Supabase em batch (máx 500 linhas por request)
7. Gravar log em `importacoes` com status e total de erros

---

## 7. REGRAS DE ANÁLISE

### Outliers
- Motorista com menos de 5 PDVs faturados → tag `outlier_base_baixa`
- Rota com menos de 3 entregas → tag `amostra_baixa`
- Sempre separar ranking por: maior %, maior volume absoluto, maior impacto HL

### Matriz de priorização de ofensores
| Classificação | Critério |
|---|---|
| Crítico | devolução PDV alta + fora do raio alto + base relevante |
| Alta prioridade operacional | devolução alta + fora do raio baixo/moderado |
| Alta prioridade geográfica | devolução baixa/média + fora do raio alto |
| Monitoramento por volume | % controlado, mas alto volume absoluto |
| Outlier | % alto com base baixa |

---

## 8. TELAS E FUNCIONALIDADES

### /dashboard — Visão Geral
- Cards: Devolução PDV%, Devolução HL%, PDVs faturados, PDVs devolvidos, Volume faturado HL, Volume devolvido HL, Reversões, Repasses efetivos
- Farol de status: verde/amarelo/vermelho vs meta
- Cards clicáveis que navegam para a visão detalhada

### /devolucoes — Devolução do CDD
- Evolução diária (gráfico de linha)
- Comparativo D-1 vs D+0
- Acumulado mensal
- Ranking de motivos
- Abertura por Mercado / Logística / Vendas
- Filtros: data, motorista, rota, RN/GV

### /ofensores — Ofensores
- Ranking por % devolução, volume absoluto, fora do raio, impacto HL
- Matriz de priorização visual (quadrante)
- Clicar em motorista → página individual com histórico completo

### /pdvs — PDVs Reincidentes
- PDVs com 2+ devoluções no período
- Histórico, motivos recorrentes, status de contato
- Sugestão de ação preventiva

### /reversoes — Reversão e Repasses
- Alertas apontados, revertidos, repasses programados/realizados
- Tempo médio aguardando CME e tempo médio de tratativa
- Fila de tratativas abertas

### /raio — Raio e Execução
- Aderência ao raio, devoluções fora do raio
- Motoristas com maior desvio
- Devoluções antes do horário adequado

### /motivos — Motivos e Causa Raiz
- Pareto de motivos (Recharts)
- Abertura por Mercado / Logística / Vendas
- Motivos reincidentes por PDV e por motorista

### /plano-acao — Plano de Ação
- CRUD completo: descrição, responsável, prazo, status, prioridade, indicador, evidência
- Histórico de tratativas

### /importacao — Importação de Dados
- Drag & drop de arquivo
- Validação de colunas com preview
- Mapeamento manual de variáveis se necessário
- Botão processar → feedback em tempo real
- Histórico de importações

### /configuracoes — Configurações
- Cadastro de metas por indicador
- Definição de horário limite de retorno
- Período de reincidência de PDV
- Gestão de usuários e perfis

---

## 9. DESIGN

- Visual: **minimalista, clean, operacional**
- Fundo: branco ou cinza muito claro (`#F8F9FA`)
- Superfície/cards: branco com sombra suave
- Tipografia: Geist (Next.js padrão) ou DM Sans
- Cores de status:
  - Verde `#16A34A` → dentro da meta
  - Amarelo `#D97706` → atenção
  - Vermelho `#DC2626` → crítico
  - Cinza `#6B7280` → neutro
  - Azul grafite `#1E3A5F` → elementos principais
- Navegação lateral colapsável
- Cards com número grande + label pequeno
- Tabelas com filtro e paginação (shadcn/ui DataTable)
- Responsivo para desktop e notebook

---

## 10. AUTENTICAÇÃO E CONTROLE DE ACESSO

- Auth Supabase com email + senha
- Perfis: `admin`, `coordenador`, `supervisor`, `cme`, `consulta`, `vendas`
- RLS: usuário autenticado acessa dados do próprio CDD
- Middleware Next.js para proteger rotas

---

## 11. ORDEM DE IMPLEMENTAÇÃO

Execute nesta sequência:

1. Setup Next.js + Tailwind + shadcn/ui + Supabase client
2. Criar todas as tabelas no Supabase (SQL do item 4)
3. Auth: login, middleware de proteção de rotas, perfil de usuário
4. `/lib/planilha.ts` — parser e inserção no Supabase
5. `/lib/indicadores.ts` — todas as fórmulas
6. `/importacao` — tela de upload com validação e feedback
7. `/dashboard` — cards + farol de status
8. `/devolucoes` — gráficos + tabelas + filtros
9. `/ofensores` — rankings + matriz
10. `/pdvs` — reincidentes
11. `/reversoes` — reversões e repasses
12. `/raio` — aderência ao raio
13. `/motivos` — pareto
14. `/plano-acao` — CRUD
15. `/configuracoes` — metas e usuários

---

Comece pelo **passo 1**: criar o projeto Next.js, instalar dependências e configurar o cliente Supabase.
