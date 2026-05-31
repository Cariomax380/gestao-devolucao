# GD — Gestão de Devolução de CDD

Ferramenta web para gestão e análise de devoluções de um Centro de Distribuição Direta (CDD).

## Stack

- **Frontend:** Next.js 14 App Router + Tailwind + shadcn/ui
- **Banco + Auth:** Supabase (PostgreSQL + RLS)
- **Planilha:** SheetJS (xlsx)
- **Gráficos:** Recharts
- **Deploy:** EasyPanel (VPS)

## Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (plano gratuito suficiente para desenvolvimento)
- Claude Code instalado

## Como usar o prompt de kickoff

O arquivo [`prompt-kickoff-gestao-devolucao.md`](./prompt-kickoff-gestao-devolucao.md) contém o prompt completo para iniciar o desenvolvimento com o Claude Code.

1. Abra o Claude Code na pasta do projeto
2. Cole o conteúdo do arquivo diretamente no chat
3. O Claude irá implementar o sistema módulo a módulo

## Módulos

| Rota | Descrição |
|---|---|
| `/dashboard` | Visão geral com cards e farol de status |
| `/devolucoes` | Análise diária e evolução |
| `/ofensores` | Ranking e matriz de priorização |
| `/pdvs` | PDVs reincidentes |
| `/reversoes` | Reversões e repasses |
| `/raio` | Aderência ao raio de entrega |
| `/motivos` | Pareto de motivos e causa raiz |
| `/plano-acao` | Gestão de ações corretivas |
| `/importacao` | Upload e processamento de planilha |
| `/configuracoes` | Metas, usuários e parâmetros |
