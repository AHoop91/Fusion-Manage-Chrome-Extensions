# APS Bearer Token Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `credentials: 'include'` on APS API calls with explicit `Authorization: Bearer` tokens fetched from the Fusion Manage `/api/v3/token` endpoint, while leaving PLM session-cookie auth untouched.

**Architecture:** A content script module fetches the token same-origin and relays it to the background worker via `AUTH_TOKEN_SYNC` message; the background stores it in `chrome.storage.session`; all APS fetches in `plm.autodeskDeveloper.ts` call `ensureApsToken()` before constructing headers. PLM calls through `http.ts` are unchanged.

**Tech Stack:** TypeScript, Chrome Extension MV3, `chrome.storage.session`, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/background/apsAuth.ts` | Token storage/retrieval in `chrome.storage.session` |
| Create | `src/background/__tests__/apsAuth.test.ts` | Unit tests for apsAuth |
| Create | `src/extension/background/apsTokenSync.ts` | Content-script token fetch + proactive refresh |
| Create | `src/extension/background/__tests__/apsTokenSync.test.ts` | Unit tests for apsTokenSync |
| Modify | `src/background/index.ts` | Add `AUTH_TOKEN_SYNC` message handler |
| Modify | `src/background/plm.autodeskDeveloper.ts` | Replace `apsSessionFetchInit()` with `ensureApsToken()` |
| Modify | `src/background/__tests__/plm.autodeskDeveloper.mfgGraphql.test.ts` | Update credentials assertion |
| Modify | `src/app/sharedRuntimeBootstrap.ts` | Call `syncApsTokenToBackground()` on page load |

---

## Task 1: Token storage module (`apsAuth.ts`)

**Files:**
- Create: `src/background/__tests__/apsAuth.test.ts`
- Create: `src/background/apsAuth.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/background/__tests__/apsAuth.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest'

function makeSessionMock() {
  const store: Record<string, unknown> = {}
  return {
    get: vi.fn(async (keys: string[]) =>
      Object.fromEntries(keys.map((k) => [k, store[k]]))
    ),
    set: vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(store, values)
    }),
    _store: store
  }
}

describe('apsAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('setApsToken stores normalized token and computes expiresAt', async () => {
    const session = makeSessionMock()
    vi.stubGlobal('chrome', { storage: { session } })
    const { setApsToken } = await import('../apsAuth')

    const before = Date.now()
    await setApsToken('eyJabc', 3600)
    const after = Date.now()

    expect(session.set).toHaveBeenCalledTimes(1)
    const stored = session.set.mock.calls[0][0]
    expect(stored.apsAccessToken).toBe('eyJabc')
    expect(stored.apsAccessTokenMeta.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000)
    expect(stored.apsAccessTokenMeta.expiresAt).toBeLessThanOrEqual(after + 3600 * 1000)
  })

  it('setApsToken strips "Bearer " prefix', async () => {
    const session = makeSessionMock()
    vi.stubGlobal('chrome', { storage: { session } })
    const { setApsToken } = await import('../apsAuth')

    await setApsToken('Bearer my.token.here', 3600)

    const stored = session.set.mock.calls[0][0]
    expect(stored.apsAccessToken).toBe('my.token.here')
  })

  it('ensureApsToken returns token when valid', async () => {
    const session = makeSessionMock()
    session._store['apsAccessToken'] = 'valid.token'
    session._store['apsAccessTokenMeta'] = {
      expiresAt: Date.now() + 3_600_000,
      updatedAt: Date.now()
    }
    vi.stubGlobal('chrome', { storage: { session } })
    const { ensureApsToken } = await import('../apsAuth')

    const token = await ensureApsToken()
    expect(token).toBe('valid.token')
  })

  it('ensureApsToken throws when token is missing', async () => {
    const session = makeSessionMock()
    vi.stubGlobal('chrome', { storage: { session } })
    const { ensureApsToken } = await import('../apsAuth')

    await expect(ensureApsToken()).rejects.toThrow('No APS token — open a Fusion Manage tab')
  })

  it('ensureApsToken throws when token is expired', async () => {
    const session = makeSessionMock()
    session._store['apsAccessToken'] = 'old.token'
    session._store['apsAccessTokenMeta'] = {
      expiresAt: Date.now() - 1000,
      updatedAt: Date.now() - 4000
    }
    vi.stubGlobal('chrome', { storage: { session } })
    const { ensureApsToken } = await import('../apsAuth')

    await expect(ensureApsToken()).rejects.toThrow(
      'APS token expired — switch to a Fusion Manage tab to refresh'
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --reporter=verbose src/background/__tests__/apsAuth.test.ts
```

Expected: 5 failures — `Cannot find module '../apsAuth'`

- [ ] **Step 3: Implement `src/background/apsAuth.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm test -- --reporter=verbose src/background/__tests__/apsAuth.test.ts
```

Expected: 5 passing

- [ ] **Step 5: Commit**

```bash
git add src/background/apsAuth.ts src/background/__tests__/apsAuth.test.ts
git commit -m "feat: add apsAuth token storage module for chrome.storage.session"
```

---

## Task 2: Content-script token sync module (`apsTokenSync.ts`)

**Files:**
- Create: `src/extension/background/__tests__/apsTokenSync.test.ts`
- Create: `src/extension/background/apsTokenSync.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/extension/background/__tests__/apsTokenSync.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function makeChromeMock(sendMessage = vi.fn()) {
  return {
    runtime: { id: 'test-ext-id', sendMessage, lastError: undefined }
  }
}

describe('syncApsTokenToBackground', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('fetches /api/v3/token with credentials same-origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock())

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v3/token',
      expect.objectContaining({ credentials: 'same-origin' })
    )
  })

  it('sends AUTH_TOKEN_SYNC message with token and expiresIn', async () => {
    const sendMessage = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'my.tok', expiresIn: 3600 }), { status: 200 })
      )
    )
    vi.stubGlobal('chrome', makeChromeMock(sendMessage))

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'AUTH_TOKEN_SYNC',
      payload: { token: 'my.tok', expiresIn: 3600 }
    })
  })

  it('schedules refresh at (expiresIn - 300) * 1000 ms', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock())

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3_300_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not send message when fetch throws', async () => {
    const sendMessage = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    vi.stubGlobal('chrome', makeChromeMock(sendMessage))

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('does not send message when fetch returns non-200', async () => {
    const sendMessage = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    )
    vi.stubGlobal('chrome', makeChromeMock(sendMessage))

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(sendMessage).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --reporter=verbose src/extension/background/__tests__/apsTokenSync.test.ts
```

Expected: 5 failures — `Cannot find module '../apsTokenSync'`

- [ ] **Step 3: Implement `src/extension/background/apsTokenSync.ts`**

```typescript
import { sendRuntimeMessageFireAndForget } from '../messaging/runtimeClient'

export async function syncApsTokenToBackground(): Promise<void> {
  try {
    const res = await fetch('/api/v3/token', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) return

    const data = (await res.json()) as { accessToken?: unknown; expiresIn?: unknown }
    const token = typeof data.accessToken === 'string' ? data.accessToken : ''
    const expiresIn = typeof data.expiresIn === 'number' ? data.expiresIn : 3600
    if (!token) return

    sendRuntimeMessageFireAndForget({
      type: 'AUTH_TOKEN_SYNC',
      payload: { token, expiresIn }
    })

    const refreshAfterMs = Math.max(0, (expiresIn - 300) * 1000)
    setTimeout(syncApsTokenToBackground, refreshAfterMs)
  } catch {
    // Silent: no token sync on failure; retry on next navigation
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm test -- --reporter=verbose src/extension/background/__tests__/apsTokenSync.test.ts
```

Expected: 5 passing

- [ ] **Step 5: Commit**

```bash
git add src/extension/background/apsTokenSync.ts src/extension/background/__tests__/apsTokenSync.test.ts
git commit -m "feat: add apsTokenSync content-script module for bearer token refresh"
```

---

## Task 3: AUTH_TOKEN_SYNC handler in background index

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 1: Update `src/background/index.ts`**

Replace the entire file with:

```typescript
import { setApsToken } from './apsAuth'
import { updateActionForTab } from './helper'
import * as plm from './plm'
import { ALLOWED_PLM_ACTIONS_BY_SCOPE } from './plmActionAllowlist'

const ITEM_PAGE_PATH_RE = /^\/plm\/workspaces\/\d+\/items(?:\/|$)/i
const ADMIN_PAGE_PATH_RE = /^\/admin(?:\b|\/|$)/i
type HttpRequestSenderScope = keyof typeof ALLOWED_PLM_ACTIONS_BY_SCOPE

function getSenderScope(urlString?: string): 'extension' | 'item-page' | 'admin-page' | null {
  if (typeof urlString !== 'string' || !urlString.trim()) return null

  try {
    const url = new URL(urlString)
    if (url.protocol === 'chrome-extension:') return 'extension'
    if (url.protocol !== 'https:' || !url.hostname.toLowerCase().endsWith('autodeskplm360.net')) return null
    if (ITEM_PAGE_PATH_RE.test(url.pathname)) return 'item-page'
    if (ADMIN_PAGE_PATH_RE.test(url.pathname)) return 'admin-page'
    return null
  } catch {
    return null
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isAllowedHttpRequestSender(sender: chrome.runtime.MessageSender): HttpRequestSenderScope | null {
  if (sender?.id && sender.id !== chrome.runtime.id) return null
  const scope = getSenderScope(sender?.url) || getSenderScope(sender?.tab?.url)
  if (scope === 'extension' || scope === 'item-page') return scope
  return null
}

function isAllowedActionForSenderScope(action: string, senderScope: HttpRequestSenderScope | null): boolean {
  if (!senderScope) return false
  return ALLOWED_PLM_ACTIONS_BY_SCOPE[senderScope].has(action)
}

function isTrustedPlmSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender?.id && sender.id !== chrome.runtime.id) return false
  const scope = getSenderScope(sender?.url) || getSenderScope(sender?.tab?.url)
  return scope === 'item-page' || scope === 'admin-page'
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab?.url) return
  void updateActionForTab(tabId, tab.url)
})

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId)
  await updateActionForTab(tabId, tab.url)
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return

  const message = msg as { type?: string; payload?: unknown }

  if (message.type === 'AUTH_TOKEN_SYNC') {
    if (!isTrustedPlmSender(sender)) {
      sendResponse({ ok: false, error: 'Untrusted sender' })
      return
    }
    const tokenPayload = message.payload as { token?: unknown; expiresIn?: unknown } | undefined
    if (typeof tokenPayload?.token !== 'string' || typeof tokenPayload?.expiresIn !== 'number') {
      sendResponse({ ok: false, error: 'Invalid AUTH_TOKEN_SYNC payload' })
      return
    }
    void setApsToken(tokenPayload.token, tokenPayload.expiresIn)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) })
      )
    return true
  }

  if (message.type !== 'HTTP_REQUEST') return

  const httpMessage = message as {
    type: 'HTTP_REQUEST'
    payload?: { action?: string; payload?: unknown }
  }

  const senderScope = isAllowedHttpRequestSender(sender)
  if (!senderScope) {
    sendResponse({ ok: false, error: 'Unauthorized request sender' })
    return
  }

  const action = httpMessage.payload?.action
  const payload = httpMessage.payload?.payload ?? {}

  if (!action || typeof action !== 'string') {
    sendResponse({ ok: false, error: 'Invalid HTTP_REQUEST payload' })
    return
  }

  if (!isAllowedActionForSenderScope(action, senderScope)) {
    sendResponse({ ok: false, error: `Disallowed PLM action for sender scope: ${action}` })
    return
  }

  if (!isPlainObject(payload)) {
    sendResponse({ ok: false, error: 'Invalid HTTP_REQUEST payload body' })
    return
  }

  const fn = (plm as unknown as Record<string, (input: Record<string, unknown>) => Promise<unknown>>)[action]
  if (!fn) {
    sendResponse({ ok: false, error: `Unknown PLM action: ${action}` })
    return
  }

  void fn(payload)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err: unknown) =>
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      })
    )

  return true
})
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```
npm test
```

Expected: all existing tests pass

- [ ] **Step 3: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: handle AUTH_TOKEN_SYNC message in background service worker"
```

---

## Task 4: Replace `apsSessionFetchInit` with bearer token in APS calls

**Files:**
- Modify: `src/background/plm.autodeskDeveloper.ts`
- Modify: `src/background/__tests__/plm.autodeskDeveloper.mfgGraphql.test.ts`

- [ ] **Step 1: Write the updated test first**

In `src/background/__tests__/plm.autodeskDeveloper.mfgGraphql.test.ts`, replace the `'posts the built-in query with session cookies'` test with:

```typescript
it('posts the built-in query with Authorization bearer header', async () => {
  const session = {
    get: vi.fn().mockResolvedValue({
      apsAccessToken: 'test-bearer-token',
      apsAccessTokenMeta: { expiresAt: Date.now() + 3_600_000, updatedAt: Date.now() }
    }),
    set: vi.fn().mockResolvedValue(undefined)
  }
  vi.stubGlobal('chrome', { storage: { session } })

  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: { model: { id: 'm1' } } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  )
  vi.stubGlobal('fetch', fetchMock)

  const { fetchMfgGraphQL } = await import('../plm.autodeskDeveloper')
  const out = await fetchMfgGraphQL({
    operation: 'getModelSourceFile',
    variables: { modelId: '  model-xyz  ' }
  })

  expect(out).toEqual({ data: { model: { id: 'm1' } } })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [, init] = fetchMock.mock.calls[0]
  expect((init as RequestInit).credentials).toBeUndefined()
  expect((init as RequestInit & { headers: Record<string, string> }).headers['Authorization']).toBe(
    'Bearer test-bearer-token'
  )
  expect((init as RequestInit & { headers: Record<string, string> }).headers['Content-Type']).toBe(
    'application/json'
  )
  const body = JSON.parse(String((init as RequestInit).body))
  expect(body.variables).toEqual({ modelId: 'model-xyz' })
  expect(String(body.query)).toContain('GetModelSourceFile')
  expect(String(body.query)).toContain('$modelId: ID!')
})
```

Also add `vi.stubGlobal` and `vi.resetModules` setup to the existing `afterEach` if not already there — the file already has `vi.unstubAllGlobals()` and `vi.resetModules()` in its `afterEach`.

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --reporter=verbose src/background/__tests__/plm.autodeskDeveloper.mfgGraphql.test.ts
```

Expected: `posts the built-in query with Authorization bearer header` fails — `credentials: 'include'` assertion fails because the old code still sets it.

- [ ] **Step 3: Update `src/background/plm.autodeskDeveloper.ts`**

Add the import at the top of the file and replace `apsSessionFetchInit`. The full updated file is below — only the `apsSessionFetchInit` function and its call sites change; all other code is identical.

Add this import at line 1:

```typescript
import { ensureApsToken } from './apsAuth'
```

Delete the `apsSessionFetchInit` function (lines 105–112):

```typescript
// DELETE this entire function:
function apsSessionFetchInit(headers: Record<string, string> = {}): RequestInit {
  return {
    credentials: 'include',
    headers: {
      ...headers
    }
  }
}
```

Replace each call site:

**`downloadModelDerivativeThumbnail` (around line 163):**
```typescript
// Before:
const res = await fetch(
  `${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/thumbnail${query}`,
  { method: 'GET', ...apsSessionFetchInit() }
)

// After:
const token = await ensureApsToken()
const res = await fetch(
  `${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/thumbnail${query}`,
  { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
)
```

**`downloadModelDerivativeAsset` (around line 197):**
```typescript
// Before:
const res = await fetch(url, {
  method: 'GET',
  ...apsSessionFetchInit()
})

// After:
const token = await ensureApsToken()
const res = await fetch(url, {
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` }
})
```

**`submitModelDerivativeJob` (around line 236):**
```typescript
// Before:
const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/job`, {
  method: 'POST',
  ...apsSessionFetchInit({
    ...APS_JSON_HEADERS,
    ...(forceRetranslate ? { 'x-ads-force': 'true' } : {}),
    'x-ads-derivative-format': 'latest'
  }),
  body: JSON.stringify({
    input: { urn, checkReferences: true },
    output: { formats: [buildOutputFormat(outputType, advancedOptions)] }
  })
})

// After:
const token = await ensureApsToken()
const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/job`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    ...APS_JSON_HEADERS,
    ...(forceRetranslate ? { 'x-ads-force': 'true' } : {}),
    'x-ads-derivative-format': 'latest'
  },
  body: JSON.stringify({
    input: { urn, checkReferences: true },
    output: { formats: [buildOutputFormat(outputType, advancedOptions)] }
  })
})
```

**`getModelDerivativeManifest` (around line 259):**
```typescript
// Before:
const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/manifest`, {
  method: 'GET',
  ...apsSessionFetchInit()
})

// After:
const token = await ensureApsToken()
const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/manifest`, {
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` }
})
```

**`getModelDerivativeFormats` (around line 281):**
```typescript
// Before:
const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/formats`, {
  method: 'GET',
  ...apsSessionFetchInit()
})

// After:
const token = await ensureApsToken()
const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/formats`, {
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` }
})
```

**`getModelDerivativeMetadata` (around line 297):**
```typescript
// Before:
const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/metadata`, {
  method: 'GET',
  ...apsSessionFetchInit()
})

// After:
const token = await ensureApsToken()
const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/metadata`, {
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` }
})
```

**`fetchMfgGraphQL` (around line 326):**
```typescript
// Before:
const res = await fetch(MFG_GRAPHQL_PUBLIC_URL, {
  method: 'POST',
  ...apsSessionFetchInit(APS_JSON_HEADERS),
  body: JSON.stringify({ query: MFG_GRAPHQL_GET_MODEL_SOURCE_FILE, variables })
})

// After:
const token = await ensureApsToken()
const res = await fetch(MFG_GRAPHQL_PUBLIC_URL, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, ...APS_JSON_HEADERS },
  body: JSON.stringify({ query: MFG_GRAPHQL_GET_MODEL_SOURCE_FILE, variables })
})
```

- [ ] **Step 4: Run all tests to confirm they pass**

```
npm test
```

Expected: all tests pass including the updated mfgGraphql test

- [ ] **Step 5: Commit**

```bash
git add src/background/plm.autodeskDeveloper.ts src/background/__tests__/plm.autodeskDeveloper.mfgGraphql.test.ts
git commit -m "feat: inject APS bearer token on all APS fetch calls"
```

---

## Task 5: Call `syncApsTokenToBackground` on page load

**Files:**
- Modify: `src/app/sharedRuntimeBootstrap.ts`

- [ ] **Step 1: Update `src/app/sharedRuntimeBootstrap.ts`**

Add the import alongside the existing imports:

```typescript
import { syncApsTokenToBackground } from '../extension/background/apsTokenSync'
```

Add the call at the end of the IIFE, after `window.__plmExt = runtime`:

```typescript
  window.__plmExt = runtime

  void syncApsTokenToBackground()
})()
```

The full updated file:

```typescript
import { findByIdDeep } from '../shared/dom/deepLookup'
import { ensureStyleTag } from '../shared/dom/styles'
import { createModalController } from '../shared/ui/modal/modalController'
import { requestPlmAction } from '../extension/background/actions'
import { syncApsTokenToBackground } from '../extension/background/apsTokenSync'
import { createNavigationPatcher } from '../extension/runtime/navigation'
import { getLocalOptions, setLocalOptions } from '../extension/storage/localStorage'
import type { PageModule, PlmExtRuntime } from '../shared/runtime/types'
import '../shared/runtime/types'
import { isAddItemPage, isFusionHost, isItemDetailsPage } from '../shared/url/parse'
import baseCss from '../styles/base.css?raw'

(() => {
  if (window.__plmExt) return
  ensureStyleTag('plm-extension-base-styles', baseCss)

  const pages: PageModule[] = []
  const ensureNavPatched = createNavigationPatcher()
  const { closeModal, openModal } = createModalController()

  function registerPage(page: PageModule): void {
    pages.push({
      ...page,
      __active: false
    })
  }

  const runtime: PlmExtRuntime = {
    pages,
    registerPage,
    ensureNavPatched,
    findByIdDeep,
    isFusionHost,
    isItemDetailsPage,
    isAddItemPage,
    closeModal,
    openModal,
    getLocalOptions,
    setLocalOptions,
    requestPlmAction
  }

  window.__plmExt = runtime

  void syncApsTokenToBackground()
})()

export {}
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/sharedRuntimeBootstrap.ts
git commit -m "feat: sync APS bearer token to background on content-script load"
```

---

## Done

All five tasks complete. The full token flow is:

1. `sharedRuntimeBootstrap.ts` calls `syncApsTokenToBackground()` on every PLM page load
2. `apsTokenSync.ts` fetches `/api/v3/token`, sends `AUTH_TOKEN_SYNC`, self-schedules refresh 5 min before expiry
3. `index.ts` validates the PLM sender and stores via `apsAuth.ts`
4. Every APS call in `plm.autodeskDeveloper.ts` calls `ensureApsToken()` and injects `Authorization: Bearer`
5. PLM calls through `http.ts` are completely unchanged
