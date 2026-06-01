-- Criar tabela metas se não existir
CREATE TABLE IF NOT EXISTS public.metas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador       text NOT NULL,
  valor_meta      numeric NOT NULL,
  cdd             text NOT NULL DEFAULT '*',
  vigencia_inicio date,
  vigencia_fim    date,
  criado_em       timestamptz DEFAULT now()
);

-- Unique constraint necessária para o upsert funcionar
ALTER TABLE public.metas
  DROP CONSTRAINT IF EXISTS metas_indicador_cdd_key;

ALTER TABLE public.metas
  ADD CONSTRAINT metas_indicador_cdd_key UNIQUE (indicador, cdd);

-- RLS
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.metas;
CREATE POLICY "auth_all" ON public.metas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO authenticated, service_role;
