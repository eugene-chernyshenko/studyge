// Copies just the flags the world set actually references into public/flags/.
// Importing flag-icons' stylesheet instead would push ~430 KB of CSS and every
// flag in the world into the initial bundle; as plain <img> they load on demand.
import { mkdir, copyFile, readFile, readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const SRC = resolve(import.meta.dirname, '../node_modules/flag-icons/flags/4x3')
const OUT = resolve(import.meta.dirname, '../public/flags')
const WORLD = resolve(import.meta.dirname, '../public/data/world-countries.json')

const topo = JSON.parse(await readFile(WORLD, 'utf8'))
const wanted = new Set(
  topo.objects.regions.geometries.map((g) => g.properties.iso2).filter(Boolean),
)

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

const available = new Set(await readdir(SRC))
let copied = 0
const missing = []
for (const iso of wanted) {
  const file = `${iso}.svg`
  if (!available.has(file)) {
    missing.push(iso)
    continue
  }
  await copyFile(resolve(SRC, file), resolve(OUT, file))
  copied++
}

console.log(`флаги: скопировано ${copied} из ${wanted.size}`)
if (missing.length) console.log(`  нет файла для: ${missing.join(', ')}`)
