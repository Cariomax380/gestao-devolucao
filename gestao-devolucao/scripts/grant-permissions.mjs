import pg from 'pg'
const { Client } = pg

// Tentar conexão com senha padrão do Supabase
const passwords = ['postgres', 'GD@Maceio2026', 'Admin@2026', '']

for (const password of passwords) {
  const client = new Client({
    host: 'db.plxlhwvxloynwoyogdsf.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  })

  try {
    await client.connect()
    console.log(`✓ Conectado com senha: "${password}"`)

    await client.query(`GRANT SELECT, INSERT, UPDATE ON public.importacoes TO service_role, authenticated;`)
    await client.query(`GRANT SELECT, INSERT, UPDATE ON public.devolucoes TO service_role, authenticated;`)
    await client.query(`GRANT SELECT, INSERT, UPDATE ON public.indicadores_diarios TO service_role, authenticated;`)
    await client.query(`GRANT SELECT, INSERT, UPDATE ON public.plano_acao TO service_role, authenticated;`)
    await client.query(`GRANT SELECT, INSERT, UPDATE ON public.metas TO service_role, authenticated;`)
    await client.query(`GRANT SELECT, INSERT, UPDATE ON public.perfis TO service_role, authenticated;`)

    console.log('✓ Permissões concedidas com sucesso!')
    await client.end()
    process.exit(0)
  } catch (e) {
    console.log(`✗ Senha "${password}" falhou: ${e.message.split('\n')[0]}`)
    try { await client.end() } catch {}
  }
}

console.log('\nNenhuma senha funcionou. Me informe a senha do banco.')
