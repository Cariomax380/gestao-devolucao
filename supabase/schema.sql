-- ================================================================
-- GD — Gestão de Devolução
-- Schema completo: tabelas + índices + RPCs + RLS + permissões
-- Execute uma única vez em um projeto Supabase limpo
-- ================================================================


-- ================================================================
-- TABELAS
-- ================================================================

-- 1. importacoes
CREATE TABLE IF NOT EXISTS public.importacoes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text        NOT NULL,
  total_linhas integer,
  status       text        NOT NULL DEFAULT 'processando',
  erros        integer     DEFAULT 0,
  user_id      uuid,
  cdd          text,
  periodo      text,
  criado_em    timestamptz DEFAULT now()
);

ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all"    ON public.importacoes;
DROP POLICY IF EXISTS "owner_only"  ON public.importacoes;
CREATE POLICY "owner_only" ON public.importacoes
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes TO authenticated, service_role;


-- 2. devolucoes
CREATE TABLE IF NOT EXISTS public.devolucoes (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id             uuid        REFERENCES public.importacoes(id) ON DELETE CASCADE,
  cdd                       text,
  periodo                   text,                          -- 'YYYY-MM', gravado no import
  data_rota                 date,
  rota                      text,
  placa                     text,
  motorista                 text,
  cliente                   text,
  codigo_pdv                text,
  status_final              text        CHECK (status_final IN ('entregue','devolvido','devolvido_parcial','reagendado','tratativa_aberta','em_tratamento')),
  motivo                    text,
  classificacao_motivo      text,
  pdvs_faturados            integer     DEFAULT 1,
  pdvs_devolvidos           integer     DEFAULT 0,
  pdv_repasse               integer     DEFAULT 0,
  volume_faturado_hl        numeric     DEFAULT 0,
  volume_devolvido_hl       numeric     DEFAULT 0,
  dentro_raio               boolean,
  aderencia_raio            numeric,
  horario_apontamento       text,
  horario_finalizacao       text,
  horario_atendimento_cme   text,
  janela_entrega            text,
  alertas_apontados         integer     DEFAULT 0,
  devolucoes_revertidas     integer     DEFAULT 0,
  repasses_programados      integer     DEFAULT 0,
  repasses_informados       integer     DEFAULT 0,
  repasses_realizados       integer     DEFAULT 0,
  recorrencia_pdv           integer     DEFAULT 0,
  qtd_devolucoes_anteriores integer     DEFAULT 0,
  rn                        text,
  gv                        text,
  supervisor                text,
  vendas                    text,
  devolucao_antes_horario   boolean,
  evidencia                 text,
  responsavel_acionado      text,
  canal_contato             text,
  resultado_contato         text,
  criado_em                 timestamptz DEFAULT now()
);

ALTER TABLE public.devolucoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all"    ON public.devolucoes;
DROP POLICY IF EXISTS "owner_only"  ON public.devolucoes;
CREATE POLICY "owner_only" ON public.devolucoes
  FOR ALL TO authenticated
  USING (
    importacao_id IN (
      SELECT id FROM public.importacoes WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    importacao_id IN (
      SELECT id FROM public.importacoes WHERE user_id = auth.uid()
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devolucoes TO authenticated, service_role;


-- 3. motoristas
CREATE TABLE IF NOT EXISTS public.motoristas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo    text NOT NULL,
  nome      text NOT NULL,
  cdd       text,
  criado_em timestamptz DEFAULT now(),
  CONSTRAINT motoristas_codigo_cdd_key UNIQUE (codigo, cdd)
);

ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON public.motoristas;
CREATE POLICY "auth_all" ON public.motoristas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motoristas TO authenticated, service_role;


-- 4. metas
CREATE TABLE IF NOT EXISTS public.metas (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador   text    NOT NULL,
  valor_meta  numeric NOT NULL,
  cdd         text    NOT NULL DEFAULT '*',
  periodo     text    NOT NULL DEFAULT 'global',
  criado_em   timestamptz DEFAULT now(),
  CONSTRAINT metas_indicador_cdd_periodo_key UNIQUE (indicador, cdd, periodo)
);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON public.metas;
CREATE POLICY "auth_all" ON public.metas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO authenticated, service_role;


-- 5. plano_acao
CREATE TABLE IF NOT EXISTS public.plano_acao (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao           text NOT NULL,
  responsavel         text,
  prazo               date,
  status              text NOT NULL DEFAULT 'aberto',
  prioridade          text NOT NULL DEFAULT 'media',
  indicador_impactado text,
  comentarios         text,
  criado_por          text,
  -- user_id separa propriedade (UUID) de exibição (criado_por = email/texto)
  user_id             uuid,
  criado_em           timestamptz DEFAULT now(),
  atualizado_em       timestamptz
);

-- Contexto estruturado do gatilho que originou o item (opcional)
ALTER TABLE public.plano_acao
  ADD COLUMN IF NOT EXISTS gatilho_contexto jsonb DEFAULT NULL;

ALTER TABLE public.plano_acao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all"    ON public.plano_acao;
DROP POLICY IF EXISTS "owner_only"  ON public.plano_acao;
CREATE POLICY "owner_only" ON public.plano_acao
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_acao TO authenticated, service_role;


-- 6. gatilho_relato — registro de relatos por estouro de gatilho individual e geral
--    devs_dia / limiar são numeric para suportar tanto contagens (int) quanto percentuais (pct_dev %)
--    tipo 'geral' usa motorista = '' (vazio) e valores em percentual
CREATE TABLE IF NOT EXISTS public.gatilho_relato (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  motorista   text NOT NULL DEFAULT '',
  data_rota   date NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('total', 'fechado', 'geral')),
  devs_dia    numeric(10,4) NOT NULL,
  limiar      numeric(10,4) NOT NULL,
  relato      text NOT NULL,
  responsavel text,
  status      text NOT NULL DEFAULT 'relatado'
                   CHECK (status IN ('relatado', 'em_acompanhamento', 'concluido')),
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- Migração: se a tabela já existia com tipos antigos, ajusta (idempotente)
ALTER TABLE public.gatilho_relato
  ALTER COLUMN devs_dia TYPE numeric(10,4) USING devs_dia::numeric,
  ALTER COLUMN limiar    TYPE numeric(10,4) USING limiar::numeric;
ALTER TABLE public.gatilho_relato
  DROP CONSTRAINT IF EXISTS gatilho_relato_tipo_check;
ALTER TABLE public.gatilho_relato
  ADD CONSTRAINT gatilho_relato_tipo_check CHECK (tipo IN ('total', 'fechado', 'geral'));

-- 5 Porquês: análise de causa raiz opcional por estouro
ALTER TABLE public.gatilho_relato
  ADD COLUMN IF NOT EXISTS cinco_porques jsonb DEFAULT NULL;

-- Categoria da causa raiz (operacional | comercial | externo | sistemico)
ALTER TABLE public.gatilho_relato
  ADD COLUMN IF NOT EXISTS categoria text DEFAULT NULL;
ALTER TABLE public.gatilho_relato
  DROP CONSTRAINT IF EXISTS gatilho_relato_categoria_check;
ALTER TABLE public.gatilho_relato
  ADD CONSTRAINT gatilho_relato_categoria_check
    CHECK (categoria IS NULL OR categoria IN ('operacional', 'comercial', 'externo', 'sistemico'));
-- Armazena array de strings ["resp1","resp2",...] com apenas as respostas preenchidas

ALTER TABLE public.gatilho_relato ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_only" ON public.gatilho_relato;
CREATE POLICY "owner_only" ON public.gatilho_relato
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gatilho_relato TO authenticated, service_role;


-- ================================================================
-- ÍNDICES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_dev_periodo            ON public.devolucoes(periodo);
CREATE INDEX IF NOT EXISTS idx_dev_data_rota          ON public.devolucoes(data_rota);
CREATE INDEX IF NOT EXISTS idx_dev_motorista          ON public.devolucoes(motorista);
CREATE INDEX IF NOT EXISTS idx_dev_motivo             ON public.devolucoes(motivo);
CREATE INDEX IF NOT EXISTS idx_dev_status_final       ON public.devolucoes(status_final);
CREATE INDEX IF NOT EXISTS idx_dev_codigo_pdv         ON public.devolucoes(codigo_pdv);
CREATE INDEX IF NOT EXISTS idx_dev_periodo_motorista  ON public.devolucoes(periodo, motorista);
CREATE INDEX IF NOT EXISTS idx_dev_importacao         ON public.devolucoes(importacao_id);
CREATE INDEX IF NOT EXISTS idx_relato_user_tipo       ON public.gatilho_relato(user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_relato_motorista_data  ON public.gatilho_relato(motorista, data_rota);


-- ================================================================
-- RPCs
-- ================================================================

-- ----------------------------------------------------------------
-- 1. periodos_disponiveis — lista de períodos com dados
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION periodos_disponiveis()
RETURNS TABLE(periodo text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT periodo
  FROM public.devolucoes
  WHERE periodo IS NOT NULL
  ORDER BY periodo DESC;
$$;

-- ----------------------------------------------------------------
-- 2. motivos_disponiveis — lista de motivos únicos (filtro)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION motivos_disponiveis()
RETURNS TABLE(motivo text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT motivo
  FROM public.devolucoes
  WHERE motivo IS NOT NULL
  ORDER BY motivo;
$$;

-- ----------------------------------------------------------------
-- 3. resumo_dashboard_filtrado — KPIs gerais com filtros completos
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_dashboard_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE(
  pdvs_faturados  bigint,
  pdvs_devolvidos bigint,
  pdv_repasse     bigint,
  vol_faturado    numeric,
  vol_devolvido   numeric,
  revertidas      bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(SUM(pdvs_faturados), 0)::bigint,
    COALESCE(SUM(pdvs_devolvidos), 0)::bigint,
    COALESCE(SUM(pdv_repasse), 0)::bigint,
    SUM(volume_faturado_hl),
    SUM(volume_devolvido_hl),
    COALESCE(SUM(devolucoes_revertidas), 0)::bigint
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND (p_periodo     IS NULL OR periodo LIKE p_periodo || '%')
    AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR motorista  = p_motorista)
    AND (p_motivo      IS NULL OR motivo     = p_motivo);
$$;

-- ----------------------------------------------------------------
-- 4. resumo_por_data_filtrado — % devolução por dia
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_por_data_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE(data_rota date, fat bigint, dev bigint, pct numeric, vol_fat numeric, vol_dev numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    data_rota,
    COALESCE(SUM(pdvs_faturados), 0)::bigint                                     AS fat,
    COALESCE(SUM(pdvs_devolvidos), 0)::bigint                                    AS dev,
    ROUND(SUM(pdvs_devolvidos)::numeric / NULLIF(SUM(pdvs_faturados),0) * 100, 2) AS pct,
    ROUND(SUM(volume_faturado_hl)::numeric, 2)                                   AS vol_fat,
    ROUND(SUM(volume_devolvido_hl)::numeric, 2)                                  AS vol_dev
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND data_rota IS NOT NULL
    AND (p_periodo     IS NULL OR periodo LIKE p_periodo || '%')
    AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR motorista  = p_motorista)
    AND (p_motivo      IS NULL OR motivo     = p_motivo)
  GROUP BY data_rota
  ORDER BY data_rota;
$$;

-- ----------------------------------------------------------------
-- 5. resumo_por_motivo_filtrado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_por_motivo_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE(motivo text, qtd bigint, pct numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH total AS (
    SELECT SUM(pdvs_devolvidos) AS t
    FROM public.devolucoes
    WHERE pdvs_devolvidos > 0
      AND (p_periodo     IS NULL OR periodo LIKE p_periodo || '%')
      AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
      AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
      AND (p_motorista   IS NULL OR motorista  = p_motorista)
      AND (p_motivo      IS NULL OR motivo     = p_motivo)
  )
  SELECT
    COALESCE(d.motivo, 'Não informado'),
    SUM(d.pdvs_devolvidos)::bigint,
    ROUND(SUM(d.pdvs_devolvidos)::numeric / NULLIF((SELECT t FROM total),0) * 100, 2)
  FROM public.devolucoes d
  WHERE d.pdvs_devolvidos > 0
    AND (p_periodo     IS NULL OR d.periodo LIKE p_periodo || '%')
    AND (p_data_inicio IS NULL OR d.data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR d.data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR d.motorista  = p_motorista)
    AND (p_motivo      IS NULL OR d.motivo     = p_motivo)
  GROUP BY d.motivo
  ORDER BY 2 DESC;
$$;

-- ----------------------------------------------------------------
-- 6. resumo_por_motorista_filtrado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_por_motorista_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE(motorista text, fat bigint, dev bigint, pct numeric, vol_fat numeric, vol_dev numeric, pct_hl numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    motorista,
    COALESCE(SUM(pdvs_faturados), 0)::bigint,
    COALESCE(SUM(pdvs_devolvidos), 0)::bigint,
    ROUND(SUM(pdvs_devolvidos)::numeric / NULLIF(SUM(pdvs_faturados),0) * 100, 2),
    ROUND(SUM(volume_faturado_hl)::numeric, 2),
    ROUND(SUM(volume_devolvido_hl)::numeric, 2),
    ROUND(SUM(volume_devolvido_hl)::numeric / NULLIF(SUM(volume_faturado_hl),0) * 100, 2)
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND motorista IS NOT NULL
    AND (p_periodo     IS NULL OR periodo LIKE p_periodo || '%')
    AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR motorista  = p_motorista)
    AND (p_motivo      IS NULL OR motivo     = p_motivo)
  GROUP BY motorista
  HAVING SUM(pdvs_faturados) >= 5
  ORDER BY 4 DESC;
$$;

-- ----------------------------------------------------------------
-- 7. resumo_por_classificacao_filtrado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_por_classificacao_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE(classificacao text, dev bigint, pct numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH total AS (
    SELECT SUM(pdvs_devolvidos) AS t
    FROM public.devolucoes
    WHERE pdvs_devolvidos > 0
      AND (p_periodo     IS NULL OR periodo LIKE p_periodo || '%')
      AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
      AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
      AND (p_motorista   IS NULL OR motorista  = p_motorista)
      AND (p_motivo      IS NULL OR motivo     = p_motivo)
  )
  SELECT
    COALESCE(classificacao_motivo, 'Não classificado'),
    SUM(pdvs_devolvidos)::bigint,
    ROUND(SUM(pdvs_devolvidos)::numeric / NULLIF((SELECT t FROM total),0) * 100, 2)
  FROM public.devolucoes
  WHERE pdvs_devolvidos > 0
    AND (p_periodo     IS NULL OR periodo LIKE p_periodo || '%')
    AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR motorista  = p_motorista)
    AND (p_motivo      IS NULL OR motivo     = p_motivo)
  GROUP BY classificacao_motivo
  ORDER BY 2 DESC;
$$;

-- ----------------------------------------------------------------
-- 8. resumo_ofensores — ranking de motoristas
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_ofensores(p_periodo text DEFAULT NULL)
RETURNS TABLE(
  motorista text, fat bigint, dev bigint,
  vol_fat numeric, vol_dev numeric,
  fora_raio bigint, total bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    motorista,
    COALESCE(SUM(pdvs_faturados), 0)::bigint,
    COALESCE(SUM(pdvs_devolvidos), 0)::bigint,
    SUM(volume_faturado_hl),
    SUM(volume_devolvido_hl),
    COUNT(*) FILTER (WHERE dentro_raio = false)::bigint,
    COALESCE(SUM(pdvs_faturados), 0)::bigint
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND motorista IS NOT NULL
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  GROUP BY motorista;
$$;

-- ----------------------------------------------------------------
-- 9. resumo_raio — aderência geral ao raio
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_raio(p_periodo text DEFAULT NULL)
RETURNS TABLE(total_entregas bigint, dentro_raio bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE dentro_raio = true)::bigint
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%');
$$;

-- ----------------------------------------------------------------
-- 10. resumo_motivos_completo — página Motivos (com filtro)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_motivos_completo(p_periodo text DEFAULT NULL)
RETURNS TABLE(motivo text, classificacao text, qtd bigint, vol numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(motivo, 'Não informado'),
    COALESCE(classificacao_motivo, 'Não classificado'),
    SUM(pdvs_devolvidos)::bigint,
    SUM(volume_devolvido_hl)
  FROM public.devolucoes
  WHERE pdvs_devolvidos > 0
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  GROUP BY motivo, classificacao_motivo
  ORDER BY 3 DESC;
$$;

-- ----------------------------------------------------------------
-- 11. resumo_pdvs_reincidentes — página PDVs
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_pdvs_reincidentes(p_periodo text DEFAULT NULL)
RETURNS TABLE(codigo_pdv text, cliente text, total_dev bigint, total_fat bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    codigo_pdv,
    MAX(cliente),
    SUM(pdvs_devolvidos)::bigint,
    COUNT(*)::bigint
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  GROUP BY codigo_pdv
  HAVING SUM(pdvs_devolvidos) >= 2
  ORDER BY 3 DESC;
$$;

-- ----------------------------------------------------------------
-- 12. resumo_reversoes — página Reversões
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_reversoes(p_periodo text DEFAULT NULL)
RETURNS TABLE(
  total_dev          bigint,
  total_repasse      bigint,
  total_revert       bigint,
  tratativas_abertas jsonb
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH base AS (
    SELECT pdvs_devolvidos, pdv_repasse, devolucoes_revertidas,
           status_final, data_rota, motorista, cliente, motivo
    FROM public.devolucoes
    WHERE (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  )
  SELECT
    -- QTD DEV = devolvidos NÃO revertidos (pdvs_devolvidos > 0 AND pdv_repasse = 0)
    -- Um devolvido com reattempt conta apenas uma vez, como REV, não como DEV
    COUNT(*) FILTER (WHERE pdvs_devolvidos > 0 AND pdv_repasse = 0)::bigint,
    SUM(pdv_repasse)::bigint,
    SUM(devolucoes_revertidas)::bigint,
    (SELECT jsonb_agg(row_to_json(t) ORDER BY t.data_rota DESC)
     FROM (
       SELECT data_rota::text, motorista, cliente, motivo
       FROM base WHERE status_final = 'tratativa_aberta'
     ) t)
  FROM base;
$$;

-- ----------------------------------------------------------------
-- 13. resumo_tendencia_semanal — página Tendência
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_tendencia_semanal(p_periodo text DEFAULT NULL)
RETURNS TABLE(semana date, fat bigint, dev bigint, pct numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    date_trunc('week', data_rota::timestamp)::date,
    COALESCE(SUM(pdvs_faturados), 0)::bigint,
    COALESCE(SUM(pdvs_devolvidos), 0)::bigint,
    ROUND(SUM(pdvs_devolvidos)::numeric / NULLIF(SUM(pdvs_faturados),0) * 100, 2)
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  GROUP BY 1
  ORDER BY 1;
$$;

-- ----------------------------------------------------------------
-- 14. resumo_calor_motivo_dia — página Mapa de Calor
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_calor_motivo_dia(p_periodo text DEFAULT NULL)
RETURNS TABLE(motivo text, dia_semana int, qtd bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    motivo,
    EXTRACT(isodow FROM data_rota)::int,
    SUM(pdvs_devolvidos)::bigint
  FROM public.devolucoes
  WHERE motivo IS NOT NULL
    AND pdvs_devolvidos > 0
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

-- ----------------------------------------------------------------
-- 15. resumo_reincidencia — página Reincidência
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_reincidencia(p_periodo text DEFAULT NULL)
RETURNS TABLE(
  total_pdvs         bigint,
  pdvs_com_devolucao bigint,
  pdvs_reincidentes  bigint,
  taxa_reincidencia  numeric,
  top_reincidentes   jsonb
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH base AS (
    SELECT
      codigo_pdv,
      MAX(cliente)                 AS cliente,
      COUNT(*)::bigint             AS fat,
      SUM(pdvs_devolvidos)::bigint AS dev
    FROM public.devolucoes
    WHERE status_final != 'tratativa_aberta'
      AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
    GROUP BY codigo_pdv
  )
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE dev > 0)::bigint,
    COUNT(*) FILTER (WHERE dev > 1)::bigint,
    ROUND(
      COUNT(*) FILTER (WHERE dev > 1)::numeric
      / NULLIF(COUNT(*) FILTER (WHERE dev > 0), 0) * 100, 2),
    (SELECT jsonb_agg(row_to_json(t))
     FROM (SELECT codigo_pdv, cliente, fat, dev FROM base
           WHERE dev > 1 ORDER BY dev DESC LIMIT 20) t)
  FROM base;
$$;

-- ----------------------------------------------------------------
-- 16. resumo_ofensores_variacao — página Variação
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_ofensores_variacao(p_periodo text)
RETURNS TABLE(
  motorista text,
  fat_atual bigint, dev_atual bigint, pct_atual numeric,
  fat_ant   bigint, dev_ant   bigint, pct_ant   numeric,
  delta     numeric
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ano int := EXTRACT(year  FROM to_date(p_periodo, 'YYYY-MM'))::int;
  v_mes int := EXTRACT(month FROM to_date(p_periodo, 'YYYY-MM'))::int;
  v_ant text;
BEGIN
  v_ant := CASE WHEN v_mes = 1
                THEN format('%s-12', v_ano - 1)
                ELSE format('%s-%s', v_ano, LPAD((v_mes - 1)::text, 2, '0'))
           END;
  RETURN QUERY
  WITH atual AS (
    SELECT d.motorista,
           COALESCE(SUM(d.pdvs_faturados), 0)::bigint AS fat,
           COALESCE(SUM(d.pdvs_devolvidos), 0)::bigint AS dev
    FROM public.devolucoes d
    WHERE d.status_final != 'tratativa_aberta'
      AND d.periodo LIKE p_periodo || '%'
    GROUP BY d.motorista HAVING SUM(d.pdvs_faturados) >= 1
  ),
  anterior AS (
    SELECT d.motorista,
           COALESCE(SUM(d.pdvs_faturados), 0)::bigint AS fat,
           COALESCE(SUM(d.pdvs_devolvidos), 0)::bigint AS dev
    FROM public.devolucoes d
    WHERE d.status_final != 'tratativa_aberta'
      AND d.periodo = v_ant
    GROUP BY d.motorista
  )
  SELECT
    a.motorista,
    a.fat, a.dev,
    ROUND(a.dev::numeric / NULLIF(a.fat,0) * 100, 2),
    COALESCE(p.fat, 0),
    COALESCE(p.dev, 0),
    ROUND(p.dev::numeric / NULLIF(p.fat,0) * 100, 2),
    ROUND(a.dev::numeric / NULLIF(a.fat,0) * 100, 2)
    - ROUND(p.dev::numeric / NULLIF(p.fat,0) * 100, 2)
  FROM atual a LEFT JOIN anterior p USING (motorista)
  ORDER BY 4 DESC;
END;
$$;


-- ================================================================
-- ----------------------------------------------------------------
-- 17. resumo_reversoes_mensal — evolução mensal de reversão
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_reversoes_mensal(p_periodo text DEFAULT NULL)
RETURNS TABLE(
  periodo      text,
  qtd_rev      bigint,
  qtd_dev      bigint,
  pct_reversao numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    periodo,
    SUM(pdv_repasse)::bigint AS qtd_rev,
    COUNT(*) FILTER (WHERE pdvs_devolvidos > 0 AND pdv_repasse = 0)::bigint AS qtd_dev,
    ROUND(
      SUM(pdv_repasse)::numeric
      / NULLIF(SUM(pdv_repasse) + COUNT(*) FILTER (WHERE pdvs_devolvidos > 0 AND pdv_repasse = 0), 0) * 100, 2
    ) AS pct_reversao
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  GROUP BY periodo
  ORDER BY periodo;
$$;

-- ----------------------------------------------------------------
-- 18. resumo_reversoes_agrupado — memória de cálculo por dimensão
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS resumo_reversoes_agrupado(text, text);
CREATE OR REPLACE FUNCTION resumo_reversoes_agrupado(
  p_periodo     text DEFAULT NULL,
  p_agrupamento text DEFAULT 'motorista'
)
RETURNS TABLE(
  grupo               text,
  qtd_rev             bigint,
  qtd_dev             bigint,
  total_oportunidades bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      CASE p_agrupamento
        WHEN 'motorista' THEN COALESCE(mot.nome, 'cód. ' || d.motorista, 'Sem motorista')
        WHEN 'cod_pdv'   THEN COALESCE(TRIM(d.codigo_pdv::text), 'Sem código')
        WHEN 'data'      THEN COALESCE(d.data_rota::text, 'Sem data')
        WHEN 'motivo'    THEN COALESCE(TRIM(d.motivo), 'Sem motivo')
        WHEN 'rota'      THEN COALESCE(TRIM(d.rota), 'Sem rota')
        ELSE 'Geral'
      END AS grp,
      CASE WHEN d.pdv_repasse > 0 THEN 1 ELSE 0 END AS flag_rev,
      CASE WHEN d.pdv_repasse = 0 AND d.pdvs_devolvidos > 0 THEN 1 ELSE 0 END AS flag_dev
    FROM devolucoes d
    LEFT JOIN motoristas mot ON mot.codigo = d.motorista
    WHERE
      (p_periodo IS NULL OR d.periodo LIKE p_periodo || '%')
      AND (d.pdvs_devolvidos > 0 OR d.pdv_repasse > 0)
      -- Exclui reattempts sem motivo e sem devolução (evita "Sem motivo" inflado)
      AND NOT (p_agrupamento = 'motivo' AND d.motivo IS NULL AND d.pdvs_devolvidos = 0)
  ),
  agg AS (
    SELECT
      grp,
      SUM(flag_rev)::bigint AS qr,
      SUM(flag_dev)::bigint AS qd
    FROM base
    GROUP BY grp
    HAVING SUM(flag_rev) + SUM(flag_dev) > 0
  )
  SELECT
    grp       AS grupo,
    qr        AS qtd_rev,
    qd        AS qtd_dev,
    (qr + qd) AS total_oportunidades
  FROM agg
  ORDER BY qr DESC, (qr::float / NULLIF(qr + qd, 0)) DESC;
END;
$$;

-- ----------------------------------------------------------------
-- 19. resumo_reversoes_cruzado — motivo × motorista
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_reversoes_cruzado(p_periodo text DEFAULT NULL)
RETURNS TABLE(
  motivo     text,
  motorista  text,
  qtd_rev    bigint,
  qtd_dev    bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(TRIM(d.motivo), 'Sem motivo')                               AS motivo,
    COALESCE(mot.nome, 'cód. ' || d.motorista, 'Sem motorista')          AS motorista,
    SUM(d.pdv_repasse)::bigint                                            AS qtd_rev,
    COUNT(*) FILTER (WHERE d.pdv_repasse = 0 AND d.pdvs_devolvidos > 0)::bigint AS qtd_dev
  FROM devolucoes d
  LEFT JOIN motoristas mot ON mot.codigo = d.motorista
  WHERE
    (p_periodo IS NULL OR d.periodo LIKE p_periodo || '%')
    AND (d.pdvs_devolvidos > 0 OR d.pdv_repasse > 0)
    AND NOT (d.motivo IS NULL AND d.pdvs_devolvidos = 0)
  GROUP BY
    COALESCE(TRIM(d.motivo), 'Sem motivo'),
    COALESCE(mot.nome, 'cód. ' || d.motorista, 'Sem motorista')
  ORDER BY 1, 4 DESC;
$$;


-- 20. resumo_tendencia_reversao_semanal - reversao semanal para pagina Tendencia
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_tendencia_reversao_semanal(p_periodo text DEFAULT NULL)
RETURNS TABLE(semana date, qtd_rev bigint, qtd_dev bigint, pct_reversao numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    date_trunc('week', data_rota::timestamp)::date                            AS semana,
    SUM(pdv_repasse)::bigint                                                  AS qtd_rev,
    COUNT(*) FILTER (WHERE pdvs_devolvidos > 0 AND pdv_repasse = 0)::bigint   AS qtd_dev,
    ROUND(
      SUM(pdv_repasse)::numeric
      / NULLIF(
          SUM(pdv_repasse) + COUNT(*) FILTER (WHERE pdvs_devolvidos > 0 AND pdv_repasse = 0),
          0
        ) * 100,
      2
    )                                                                         AS pct_reversao
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND (pdvs_devolvidos > 0 OR pdv_repasse > 0)
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  GROUP BY 1
  ORDER BY 1;
$$;


-- 21. resumo_calor_classificacao_dia - classificacao x dia da semana (heatmap)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_calor_classificacao_dia(p_periodo text DEFAULT NULL)
RETURNS TABLE(classificacao text, dia_semana int, qtd bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(classificacao_motivo, 'Sem classificacao') AS classificacao,
    EXTRACT(isodow FROM data_rota)::int                 AS dia_semana,
    SUM(pdvs_devolvidos)::bigint                        AS qtd
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND motivo IS NOT NULL
    AND pdvs_devolvidos > 0
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


-- 22. resumo_calor_horario_dia - faixa de horario_finalizacao x dia da semana
-- horario_finalizacao armazenado em UTC (text HH:MM); converte para Brasília (UTC-3)
-- antes de classificar para que os rótulos reflitam o horário local real.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS resumo_calor_horario_dia(text);
CREATE OR REPLACE FUNCTION resumo_calor_horario_dia(p_periodo text DEFAULT NULL)
RETURNS TABLE(faixa text, dia_semana int, qtd bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    CASE
      WHEN horario_finalizacao IS NULL THEN 'Sem horario'
      ELSE (
        CASE
          WHEN (horario_finalizacao::time - INTERVAL '3 hours') < TIME '09:00' THEN 'Ate 9h'
          WHEN (horario_finalizacao::time - INTERVAL '3 hours') < TIME '12:00' THEN '9h - 12h'
          WHEN (horario_finalizacao::time - INTERVAL '3 hours') < TIME '15:00' THEN '12h - 15h'
          WHEN (horario_finalizacao::time - INTERVAL '3 hours') < TIME '18:00' THEN '15h - 18h'
          ELSE '18h ou mais'
        END
      )
    END                                         AS faixa,
    EXTRACT(isodow FROM data_rota)::int         AS dia_semana,
    SUM(pdvs_devolvidos)::bigint                AS qtd
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND pdvs_devolvidos > 0
    AND (p_periodo IS NULL OR periodo LIKE p_periodo || '%')
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


-- PERMISSOES
-- ================================================================

GRANT EXECUTE ON FUNCTION periodos_disponiveis()                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION motivos_disponiveis()                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_dashboard_filtrado(text,date,date,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_por_data_filtrado(text,date,date,text,text)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_por_motivo_filtrado(text,date,date,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_por_motorista_filtrado(text,date,date,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_por_classificacao_filtrado(text,date,date,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_ofensores(text)                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_raio(text)                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_motivos_completo(text)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_pdvs_reincidentes(text)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_reversoes(text)                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_tendencia_semanal(text)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_calor_motivo_dia(text)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_reincidencia(text)                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_ofensores_variacao(text)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_reversoes_mensal(text)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_reversoes_agrupado(text, text)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_reversoes_cruzado(text)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_tendencia_reversao_semanal(text)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_calor_classificacao_dia(text)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_calor_horario_dia(text)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_gatilho_geral(text)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_gatilho_motoristas(text, text)     TO authenticated, service_role;


-- ================================================================
-- 23. resumo_gatilho_geral - % devolucao diaria vs gatilho
-- Retorna media_prev e desvio_prev sem pre-computar gatilho/estouro
-- (o cliente aplica o sigma selecionado). Outliers removidos por P95.
-- ================================================================
DROP FUNCTION IF EXISTS resumo_gatilho_geral(text);
CREATE OR REPLACE FUNCTION resumo_gatilho_geral(p_periodo text DEFAULT NULL)
RETURNS TABLE(
  data_rota    text,
  pdvs_fat     bigint,
  pdvs_dev     bigint,
  pct_dev      numeric,
  media_prev   numeric,
  desvio_prev  numeric,
  periodo_ref  text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mes_atual text;
  v_mes_prev  text;
BEGIN
  v_mes_atual := CASE
    WHEN p_periodo IS NOT NULL AND LENGTH(p_periodo) >= 7 THEN LEFT(p_periodo, 7)
    ELSE TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  END;

  v_mes_prev := TO_CHAR(
    TO_DATE(v_mes_atual || '-01', 'YYYY-MM-DD') - INTERVAL '1 month',
    'YYYY-MM'
  );

  RETURN QUERY
  WITH prev AS (
    SELECT
      d.data_rota,
      SUM(d.pdvs_devolvidos)::numeric / NULLIF(SUM(d.pdvs_faturados)::numeric, 0) * 100 AS pct_dia
    FROM devolucoes d
    WHERE d.periodo = v_mes_prev
    GROUP BY d.data_rota
    HAVING SUM(d.pdvs_faturados) > 0
  ),
  p95 AS (
    SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pct_dia) AS limite
    FROM prev
  ),
  prev_filtrado AS (
    SELECT p.pct_dia
    FROM prev p
    CROSS JOIN p95
    WHERE p.pct_dia > 0              -- exclui dias sem devolucao da media
      AND p.pct_dia <= p95.limite    -- remove outliers (P95)
  ),
  stats AS (
    SELECT
      COALESCE(AVG(pct_dia), 0)         AS media,
      COALESCE(STDDEV_SAMP(pct_dia), 0) AS desvio
    FROM prev_filtrado
  ),
  atual AS (
    SELECT
      d.data_rota,
      SUM(d.pdvs_devolvidos)::numeric AS dev,
      SUM(d.pdvs_faturados)::numeric  AS fat
    FROM devolucoes d
    WHERE d.periodo LIKE v_mes_atual || '%'
    GROUP BY d.data_rota
    HAVING SUM(d.pdvs_faturados) > 0
  )
  SELECT
    a.data_rota::text,
    a.fat::bigint,
    a.dev::bigint,
    ROUND(a.dev / a.fat * 100, 2),
    ROUND(s.media, 2),
    ROUND(s.desvio, 2),
    v_mes_prev
  FROM atual a, stats s
  ORDER BY a.data_rota;
END;
$$;


-- ================================================================
-- 24. resumo_gatilho_motoristas - breakdown diario por motorista (numerico)
-- Retorna 1 linha por (motorista, dia) com contagem absoluta de devoluções.
-- Stats por motorista: media_prev/desvio_prev calculados sobre os dias do
-- mês anterior em que aquele motorista teve dev > 0, excluindo outliers P95
-- individual. Fallback para stats de frota quando o motorista tem < 3 dias
-- de histórico (desvio individual seria não-significativo).
-- ================================================================
DROP FUNCTION IF EXISTS resumo_gatilho_motoristas(text, text);
CREATE OR REPLACE FUNCTION resumo_gatilho_motoristas(
  p_periodo text DEFAULT NULL,
  p_tipo    text DEFAULT 'total'
)
RETURNS TABLE(
  data_rota      text,
  motorista      text,
  nome_motorista text,
  devs_dia       bigint,
  fat_dia        bigint,
  media_prev     numeric,
  desvio_prev    numeric,
  periodo_ref    text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mes_atual text;
  v_mes_prev  text;
BEGIN
  v_mes_atual := CASE
    WHEN p_periodo IS NOT NULL AND LENGTH(p_periodo) >= 7 THEN LEFT(p_periodo, 7)
    ELSE TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  END;

  v_mes_prev := TO_CHAR(
    TO_DATE(v_mes_atual || '-01', 'YYYY-MM-DD') - INTERVAL '1 month',
    'YYYY-MM'
  );

  RETURN QUERY
  WITH prev_raw AS (
    -- Contagem por (motorista, dia) no mês anterior
    SELECT
      d.motorista,
      d.data_rota,
      COUNT(*) FILTER (WHERE d.pdvs_devolvidos > 0)::bigint                             AS dev_total,
      COUNT(*) FILTER (WHERE d.pdvs_devolvidos > 0 AND d.motivo = 'PDV fechado')::bigint AS dev_fechado
    FROM devolucoes d
    WHERE d.periodo = v_mes_prev
      AND d.motorista IS NOT NULL AND d.motorista != ''
    GROUP BY d.motorista, d.data_rota
  ),
  prev_sel AS (
    -- Inclui motorista para permitir cálculo individual; exclui zeros
    SELECT
      pr.motorista,
      CASE WHEN p_tipo = 'pdv_fechado' THEN pr.dev_fechado ELSE pr.dev_total END AS dev_dia
    FROM prev_raw pr
    WHERE (CASE WHEN p_tipo = 'pdv_fechado' THEN pr.dev_fechado ELSE pr.dev_total END) > 0
  ),
  -- ── Stats por motorista ────────────────────────────────────────────────────
  p95_mot AS (
    -- P95 individual (evita que um dia extremo distorca o baseline do motorista)
    -- alias ps2 necessario: RETURNS TABLE cria variavel implicita "motorista"
    SELECT
      ps2.motorista,
      COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ps2.dev_dia), 0) AS limite
    FROM prev_sel ps2
    GROUP BY ps2.motorista
  ),
  prev_filtrado_mot AS (
    SELECT ps.motorista, ps.dev_dia
    FROM prev_sel ps
    JOIN p95_mot pm ON pm.motorista = ps.motorista
    WHERE ps.dev_dia <= pm.limite
  ),
  stats_mot AS (
    SELECT
      pfm.motorista,
      COUNT(*)                            AS n_dias,
      COALESCE(AVG(pfm.dev_dia),         0) AS media,
      COALESCE(STDDEV_SAMP(pfm.dev_dia), 0) AS desvio
    FROM prev_filtrado_mot pfm
    GROUP BY pfm.motorista
  ),
  -- ── Stats de frota (fallback para motoristas com < 3 dias de historico) ───
  fleet_stats AS (
    SELECT
      COALESCE(AVG(pfm2.dev_dia),         0) AS media,
      COALESCE(STDDEV_SAMP(pfm2.dev_dia), 0) AS desvio
    FROM prev_filtrado_mot pfm2
  ),
  -- ── Mês atual ─────────────────────────────────────────────────────────────
  atual_raw AS (
    SELECT
      d.motorista,
      d.data_rota,
      COUNT(*) FILTER (WHERE d.pdvs_devolvidos > 0)::bigint                             AS dev_total,
      COUNT(*) FILTER (WHERE d.pdvs_devolvidos > 0 AND d.motivo = 'PDV fechado')::bigint AS dev_fechado,
      COUNT(*)::bigint                                                                    AS fat
    FROM devolucoes d
    WHERE d.periodo LIKE v_mes_atual || '%'
      AND d.motorista IS NOT NULL AND d.motorista != ''
    GROUP BY d.motorista, d.data_rota
  ),
  atual_sel AS (
    SELECT
      ar.motorista,
      ar.data_rota,
      CASE WHEN p_tipo = 'pdv_fechado' THEN ar.dev_fechado ELSE ar.dev_total END AS dev_dia,
      ar.fat
    FROM atual_raw ar
    WHERE (CASE WHEN p_tipo = 'pdv_fechado' THEN ar.dev_fechado ELSE ar.dev_total END) > 0
  )
  SELECT
    ac.data_rota::text,
    ac.motorista::text,
    COALESCE(m.nome, 'cod. ' || ac.motorista)::text,
    ac.dev_dia,
    ac.fat,
    -- stats individuais se ≥ 3 dias de histórico; fallback para frota
    ROUND(CASE WHEN sm.n_dias >= 3 THEN sm.media  ELSE fs.media  END, 2) AS media_prev,
    ROUND(CASE WHEN sm.n_dias >= 3 THEN sm.desvio ELSE fs.desvio END, 2) AS desvio_prev,
    v_mes_prev
  FROM atual_sel ac
  CROSS JOIN fleet_stats fs
  LEFT JOIN stats_mot    sm ON sm.motorista = ac.motorista
  LEFT JOIN motoristas    m ON  m.codigo    = ac.motorista
  ORDER BY ac.data_rota DESC, ac.dev_dia DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION resumo_gatilho_geral(text)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_gatilho_motoristas(text, text)   TO authenticated, service_role;

-- ================================================================
-- 25. resumo_reversoes_pdv_fechado_diario
-- Abertura dia a dia de reversao para o motivo PDV fechado.
-- Retorna 1 linha por data_rota com QTD REV, QTD DEV e % reversao.
-- ================================================================
DROP FUNCTION IF EXISTS resumo_reversoes_pdv_fechado_diario(text);
CREATE OR REPLACE FUNCTION resumo_reversoes_pdv_fechado_diario(
  p_periodo text DEFAULT NULL
)
RETURNS TABLE(
  data_rota    text,
  qtd_rev      bigint,
  qtd_dev      bigint,
  pct_reversao numeric
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      d.data_rota,
      CASE WHEN d.pdv_repasse > 0 THEN 1 ELSE 0 END AS flag_rev,
      CASE WHEN d.pdv_repasse = 0 AND d.pdvs_devolvidos > 0 THEN 1 ELSE 0 END AS flag_dev
    FROM devolucoes d
    WHERE (p_periodo IS NULL OR d.periodo LIKE p_periodo || '%')
      AND d.status_final != 'tratativa_aberta'
      AND d.motivo = 'PDV fechado'
      AND (d.pdvs_devolvidos > 0 OR d.pdv_repasse > 0)
  ),
  agg AS (
    SELECT
      b.data_rota,
      SUM(b.flag_rev)::bigint AS qr,
      SUM(b.flag_dev)::bigint AS qd
    FROM base b
    GROUP BY b.data_rota
    HAVING SUM(b.flag_rev) + SUM(b.flag_dev) > 0
  )
  SELECT
    a.data_rota::text,
    a.qr,
    a.qd,
    ROUND(a.qr::numeric / NULLIF((a.qr + a.qd)::numeric, 0) * 100, 2)
  FROM agg a
  ORDER BY a.data_rota;
END;
$$;

GRANT EXECUTE ON FUNCTION resumo_reversoes_pdv_fechado_diario(text) TO authenticated, service_role;
