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
DROP POLICY IF EXISTS "auth_all" ON public.importacoes;
CREATE POLICY "auth_all" ON public.importacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
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
  status_final              text        CHECK (status_final IN ('entregue','devolvido','devolvido_parcial','reagendado','tratativa_aberta')),
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
DROP POLICY IF EXISTS "auth_all" ON public.devolucoes;
CREATE POLICY "auth_all" ON public.devolucoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
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
  criado_em           timestamptz DEFAULT now(),
  atualizado_em       timestamptz
);

ALTER TABLE public.plano_acao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON public.plano_acao;
CREATE POLICY "auth_all" ON public.plano_acao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_acao TO authenticated, service_role;


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
    -- QTD DEV = registros com pdvs_devolvidos > 0 (DEFINITELY_RETURNED + PARTIAL_DELIVERY + IN_TREATMENT)
    -- NOT_STARTED (tratativa_aberta) tem pdvs_devolvidos=0 e NÃO entra aqui
    COUNT(*) FILTER (WHERE pdvs_devolvidos > 0)::bigint,
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
    COUNT(*) FILTER (WHERE pdvs_devolvidos > 0)::bigint AS qtd_dev,
    ROUND(
      SUM(pdv_repasse)::numeric
      / NULLIF(SUM(pdv_repasse) + COUNT(*) FILTER (WHERE pdvs_devolvidos > 0), 0) * 100, 2
    ) AS pct_reversao
  FROM public.devolucoes
  WHERE status_final != 'tratativa_aberta'
    AND (p_periodo IS NULL OR periodo LIKE SUBSTRING(p_periodo, 1, 4) || '%')
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
      1 AS flag_dev
    FROM devolucoes d
    LEFT JOIN motoristas mot ON mot.codigo = d.motorista
    WHERE
      (p_periodo IS NULL OR d.periodo LIKE p_periodo || '%')
      AND d.pdvs_devolvidos > 0
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
    COUNT(*)::bigint                                                       AS qtd_dev
  FROM devolucoes d
  LEFT JOIN motoristas mot ON mot.codigo = d.motorista
  WHERE
    (p_periodo IS NULL OR d.periodo LIKE p_periodo || '%')
    AND d.pdvs_devolvidos > 0
  GROUP BY
    COALESCE(TRIM(d.motivo), 'Sem motivo'),
    COALESCE(mot.nome, 'cód. ' || d.motorista, 'Sem motorista')
  ORDER BY 1, 4 DESC;
$$;


-- PERMISSÕES
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
