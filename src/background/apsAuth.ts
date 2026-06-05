const TOKEN_KEY = 'apsAccessToken'
const TOKEN_META_KEY = 'apsAccessTokenMeta'

type ApsTokenMeta = { expiresAt: number; updatedAt: number }

export async function setApsToken(token: string, expiresIn: number): Promise<void> {
  const normalized = token.replace(/^Bearer\s+/i, '')
  const now = Date.now()
  await chrome.storage.session.set({
    [TOKEN_KEY]: normalized,
    [TOKEN_META_KEY]: { expiresAt: now + expiresIn * 1000, updatedAt: now }
  })
}

export async function ensureApsToken(): Promise<string> {
  const result = (await chrome.storage.session.get([TOKEN_KEY, TOKEN_META_KEY])) as {
    [TOKEN_KEY]?: string
    [TOKEN_META_KEY]?: ApsTokenMeta
  }
  const token = result[TOKEN_KEY]
  const meta = result[TOKEN_META_KEY]

  if (!token) {
    throw new Error('No APS token — open a Fusion Manage tab')
  }
  if (meta?.expiresAt && Date.now() > meta.expiresAt) {
    throw new Error('APS token expired — switch to a Fusion Manage tab to refresh')
  }
  return token
}
