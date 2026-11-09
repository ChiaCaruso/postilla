// Genera src/styles/tokens.css da docs/design/tokens.json.
// Uso: npm run tokens  (da rilanciare dopo ogni modifica ai token)
import { readFileSync, writeFileSync } from 'node:fs'

const t = JSON.parse(readFileSync(new URL('../docs/design/tokens.json', import.meta.url), 'utf8'))
const px = (n) => `${n}px`
const out = [
  '/* Generato da scripts/tokens.mjs a partire da docs/design/tokens.json. Non modificare a mano. */',
  '@theme {',
  '  /* Solo i colori dei token: la tavolozza predefinita di Tailwind è disattivata. */',
  '  --color-*: initial;',
  '  --color-transparent: transparent;',
  '  --color-current: currentColor;',
]
for (const [k, v] of Object.entries(t.color)) out.push(`  --color-${k}: ${v};`)
out.push(`  --font-sans: ${t.font.sans};`, `  --font-mono: ${t.font.mono};`)
for (const [k, v] of Object.entries(t.type)) {
  out.push(`  --text-${k}: ${px(v.size)};`, `  --text-${k}--line-height: ${px(v.line)};`, `  --text-${k}--font-weight: ${v.weight};`)
}
out.push('  --spacing: 4px;')
for (const [k, v] of Object.entries(t.radius)) out.push(`  --radius-${k}: ${px(v)};`)
for (const [k, v] of Object.entries(t.shadow)) out.push(`  --shadow-${k}: ${v};`)
out.push(`  --ease-standard: ${t.motion.ease};`, `  --default-transition-duration: ${t.motion.fast};`, `  --default-transition-timing-function: ${t.motion.ease};`)
out.push('  --breakpoint-*: initial;')
for (const [k, v] of Object.entries(t.layout.breakpoints)) out.push(`  --breakpoint-${k}: ${px(v)};`)
out.push('}', '', ':root {')
for (const [k, v] of Object.entries(t.layout)) if (typeof v === 'number') out.push(`  --layout-${k}: ${px(v)};`)
out.push(`  --motion-base: ${t.motion.base};`, '}', '')
writeFileSync(new URL('../src/styles/tokens.css', import.meta.url), out.join('\n'))
console.log('tokens.css aggiornato')
