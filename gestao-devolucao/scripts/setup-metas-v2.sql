-- Adicionar coluna periodo à tabela metas
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS periodo text NOT NULL DEFAULT 'global';

-- Remover constraint antiga e criar nova incluindo periodo
ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_indicador_cdd_key;
ALTER TABLE public.metas DROP CONSTRAINT IF EXISTS metas_indicador_cdd_periodo_key;
ALTER TABLE public.metas ADD CONSTRAINT metas_indicador_cdd_periodo_key UNIQUE (indicador, cdd, periodo);

-- Criar tabela motoristas
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
