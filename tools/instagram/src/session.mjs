// Navegador persistente. El login lo haces TÚ a mano una sola vez: la sesión queda
// guardada en data/chrome-profile/ y las siguientes ejecuciones ya entran logueadas.
// No tocamos credenciales en ningún momento.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DATA = join(ROOT, 'data')
export const PROFILE = join(DATA, 'chrome-profile')

export function openBrowser () {
  mkdirSync(PROFILE, { recursive: true })
  return chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: null,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    args: ['--disable-blink-features=AutomationControlled', '--window-size=1400,950'],
  })
}

export async function isLoggedIn (ctx) {
  const cookies = await ctx.cookies('https://www.instagram.com')
  return cookies.some(c => c.name === 'sessionid' && c.value)
}

export function ask (question) {
  return new Promise(resolve => {
    process.stdout.write(question)
    process.stdin.resume()
    process.stdin.once('data', d => { process.stdin.pause(); resolve(String(d).trim()) })
  })
}
