// Writes the lesson data from src/data/lessons.ts to the iOS app's bundle so
// both apps share one source of lesson content. Run: npm run export:lessons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { lessons } = await import(resolve(root, 'src/data/lessons.ts'))
const out = resolve(root, 'ios/MouthCoach/Resources/lessons.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(lessons, null, 2) + '\n')
console.log(`Wrote ${lessons.length} lessons to ${out.slice(root.length + 1)}`)
