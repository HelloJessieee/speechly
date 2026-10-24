import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { feedbackApi } from './server/feedbackApi'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Refuse to start if a secret was given a VITE_ prefix, which would bundle it
  // into the browser code. Keep keys like ANTHROPIC_API_KEY unprefixed.
  const exposed = Object.keys(loadEnv(mode, process.cwd(), 'VITE_')).filter((name) => /ANTHROPIC|CLAUDE|API_KEY|SECRET/i.test(name))
  if (exposed.length > 0) {
    throw new Error(`Remove the VITE_ prefix from ${exposed.join(', ')} in your .env file — it would expose the value in the browser.`)
  }

  // Server-side values (no VITE_ prefix): never sent to the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.ANTHROPIC_API_KEY?.trim() || undefined

  return {
    plugins: [react(), tailwindcss(), feedbackApi({ apiKey, model: env.CLAUDE_MODEL?.trim() || 'claude-opus-5-5' })],
    server: { host: '127.0.0.1', port: 5173 },
    preview: { host: '127.0.0.1', port: 4173 },
  }
})
