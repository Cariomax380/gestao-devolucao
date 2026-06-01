-- ============================================================
-- RPCs do dashboard com filtros completos
-- Aceita: periodo (YYYY-MM), data_inicio, data_fim, motorista, motivo
-- ============================================================

-- Helper interno de filtro (evita repetição)
-- As funções abaixo usam o mesmo WHERE clause

-- 1. KPIs gerais
CREATE OR REPLACE FUNCTION resumo_dashboard_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE (
  pdvs_faturados   bigint,
  pdvs_devolvidos  bigint,
  pdv_repasse      bigint,
  vol_faturado     numeric,
  vol_devolvido    numeric,
  revertidas       bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    SUM(pdvs_faturados)::bigint,
    SUM(pdvs_devolvidos)::bigint,
    SUM(pdv_repasse)::bigint,
    SUM(volume_faturado_hl),
    SUM(volume_devolvido_hl),
    SUM(devolucoes_revertidas)::bigint
  FROM devolucoes
  WHERE
    (p_periodo     IS NULL OR to_char(data_rota, 'YYYY-MM') = p_periodo)
    AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR motorista = p_motorista)
    AND (p_motivo      IS NULL OR motivo = p_motivo);
$$;

-- 2. Por data (% devolução por dia)
CREATE OR REPLACE FUNCTION resumo_por_data_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE (
  data_rota  date,
  fat        bigint,
  dev        bigint,
  pct        numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    data_rota,
    SUM(pdvs_faturados)::bigint  AS fat,
    SUM(pdvs_devolvidos)::bigint AS dev,
    CASE WHEN SUM(pdvs_faturados) > 0
      THEN ROUND(SUM(pdvs_devolvidos)::numeric / SUM(pdvs_faturados) * 100, 2)
      ELSE 0
    END AS pct
  FROM devolucoes
  WHERE
    data_rota IS NOT NULL
    AND (p_periodo     IS NULL OR to_char(data_rota, 'YYYY-MM') = p_periodo)
    AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR motorista = p_motorista)
    AND (p_motivo      IS NULL OR motivo = p_motivo)
  GROUP BY data_rota
  ORDER BY data_rota;
$$;

-- 3. Por motivo
CREATE OR REPLACE FUNCTION resumo_por_motivo_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE (
  motivo  text,
  qtd     bigint,
  pct     numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH total AS (
    SELECT SUM(pdvs_devolvidos) AS t
    FROM devolucoes
    WHERE
      pdvs_devolvidos > 0
      AND (p_periodo     IS NULL OR to_char(data_rota, 'YYYY-MM') = p_periodo)
      AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
      AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
      AND (p_motorista   IS NULL OR motorista = p_motorista)
      AND (p_motivo      IS NULL OR motivo = p_motivo)
  )
  SELECT
    COALESCE(d.motivo, 'Não informado') AS motivo,
    SUM(d.pdvs_devolvidos)::bigint      AS qtd,
    CASE WHEN (SELECT t FROM total) > 0
      THEN ROUND(SUM(d.pdvs_devolvidos)::numeric / (SELECT t FROM total) * 100, 2)
      ELSE 0
    END AS pct
  FROM devolucoes d
  WHERE
    d.pdvs_devolvidos > 0
    AND (p_periodo     IS NULL OR to_char(d.data_rota, 'YYYY-MM') = p_periodo)
    AND (p_data_inicio IS NULL OR d.data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR d.data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR d.motorista = p_motorista)
    AND (p_motivo      IS NULL OR d.motivo = p_motivo)
  GROUP BY d.motivo
  ORDER BY qtd DESC;
$$;

-- 4. Por motorista
CREATE OR REPLACE FUNCTION resumo_por_motorista_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE (
  motorista  text,
  fat        bigint,
  dev        bigint,
  pct        numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    motorista,
    SUM(pdvs_faturados)::bigint  AS fat,
    SUM(pdvs_devolvidos)::bigint AS dev,
    CASE WHEN SUM(pdvs_faturados) > 0
      THEN ROUND(SUM(pdvs_devolvidos)::numeric / SUM(pdvs_faturados) * 100, 2)
      ELSE 0
    END AS pct
  FROM devolucoes
  WHERE
    motorista IS NOT NULL
    AND (p_periodo     IS NULL OR to_char(data_rota, 'YYYY-MM') = p_periodo)
    AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR motorista = p_motorista)
    AND (p_motivo      IS NULL OR motivo = p_motivo)
  GROUP BY motorista
  HAVING SUM(pdvs_faturados) >= 5
  ORDER BY pct DESC;
$$;

-- 5. Por classificação
CREATE OR REPLACE FUNCTION resumo_por_classificacao_filtrado(
  p_periodo      text DEFAULT NULL,
  p_data_inicio  date DEFAULT NULL,
  p_data_fim     date DEFAULT NULL,
  p_motorista    text DEFAULT NULL,
  p_motivo       text DEFAULT NULL
)
RETURNS TABLE (
  classificacao  text,
  dev            bigint,
  pct            numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH total AS (
    SELECT SUM(pdvs_devolvidos) AS t
    FROM devolucoes
    WHERE
      pdvs_devolvidos > 0
      AND (p_periodo     IS NULL OR to_char(data_rota, 'YYYY-MM') = p_periodo)
      AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
      AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
      AND (p_motorista   IS NULL OR motorista = p_motorista)
      AND (p_motivo      IS NULL OR motivo = p_motivo)
  )
  SELECT
    COALESCE(classificacao_motivo, 'Não classificado') AS classificacao,
    SUM(pdvs_devolvidos)::bigint AS dev,
    CASE WHEN (SELECT t FROM total) > 0
      THEN ROUND(SUM(pdvs_devolvidos)::numeric / (SELECT t FROM total) * 100, 2)
      ELSE 0
    END AS pct
  FROM devolucoes
  WHERE
    pdvs_devolvidos > 0
    AND (p_periodo     IS NULL OR to_char(data_rota, 'YYYY-MM') = p_periodo)
    AND (p_data_inicio IS NULL OR data_rota >= p_data_inicio)
    AND (p_data_fim    IS NULL OR data_rota <= p_data_fim)
    AND (p_motorista   IS NULL OR motorista = p_motorista)
    AND (p_motivo      IS NULL OR motivo = p_motivo)
  GROUP BY classificacao_motivo
  ORDER BY dev DESC;
$$;

-- 6. Motivos disponíveis (para o filtro dropdown)
CREATE OR REPLACE FUNCTION motivos_disponiveis()
RETURNS TABLE (motivo text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT motivo
  FROM devolucoes
  WHERE motivo IS NOT NULL
  ORDER BY motivo;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION resumo_dashboard_filtrado       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_por_data_filtrado        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_por_motivo_filtrado      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_por_motorista_filtrado   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resumo_por_classificacao_filtrado TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION motivos_disponiveis             TO authenticated, service_role;
