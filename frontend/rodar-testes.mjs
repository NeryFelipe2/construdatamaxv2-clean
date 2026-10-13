// Roda os testes `node:test` escritos em TypeScript.
//
// O tsx precisa do tsconfig.app.json para resolver o alias `@/` — o tsconfig.json da raiz
// só tem project references, sem "paths". Por isso o TSX_TSCONFIG_PATH, e por isso um .mjs
// em vez de variável de ambiente no package.json (o npm no Windows roda os scripts no cmd).
//
// ⚠️ Módulo testado não pode importar store, `supabase` ou `api.ts`: eles leem
// `import.meta.env`, que não existe fora do Vite.
import { spawnSync } from 'node:child_process'

const alvos = process.argv.slice(2)
const r = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...(alvos.length ? alvos : ['src/**/*.test.ts'])],
  { stdio: 'inherit', env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.app.json' } },
)
process.exit(r.status ?? 1)
