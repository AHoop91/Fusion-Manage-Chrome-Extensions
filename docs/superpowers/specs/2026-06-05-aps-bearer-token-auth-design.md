# APS Bearer Token Auth Strategy — Design Spec

**Date:** 2026-06-05
**Branch:** feature/model-derivative
**Status:** Approved, ready for implementation

---

## Overview

Introduce explicit OAuth2 bearer token authentication for all Autodesk Platform Services (APS) API calls (`developer.api.autodesk.com`). Fusion Manage PLM API calls (`*.autodeskplm360.net`) continue using the existing browser session cookie approach (`credentials: 'include'`).

The token is acquired from the same-origin `/api/v3/token` endpoint on the PLM page by the content script, relayed to the background service worker via a new `AUTH_TOKEN_SYNC` message, stored in `chrome.storage.session`, and injected as `Authorization: Bearer <token>` on every APS fetch.

### Scope decisions

- **Only current tenants supported** — no localStorage fallback for older tenants.
- **Proactive token refresh** — content script re-fetches the token 5 minutes before expiry and resyncs. Keeps long-running sessions alive without polling.
- **Split auth strategy** — APS calls use bearer token; PLM calls keep session cookies. Routing is a simple condition, not an abstraction.

---

## Architecture

```
PLM page (content script — apsTokenSync.ts)
  │
  ├── on page load: fetch GET /api/v3/token (credentials: same-origin)
  ├── send AUTH_TOKEN_SYNC → background index.ts
  └── setTimeout(syncApsTokenToBackground, (expiresIn - 300) * 1000)

Background service worker
  │
  ├── index.ts: receives AUTH_TOKEN_SYNC, validates PLM sender, calls apsAuth.ts
  ├── apsAuth.ts: stores { token, expiresAt } in chrome.storage.session
  │
  └── plm.autodeskDeveloper.ts: APS API calls
        ├── calls ensureApsToken() → reads from storage, throws if missing/expired
        └── injects Authorization: Bearer <token> header

PLM API calls (http.ts / plm.ts)
  └── unchanged — continue using credentials: 'include'
```

---

## Token Source

```
GET https://{tenant}.autodeskplm360.net/api/v3/token
```

- Same-origin request from the content script — browser sends `JSESSIONID` automatically.
- Response: `{ accessToken: string, expiresIn: number, tokenType: "Bearer" }`
- `expiresIn` is typically ~3600 seconds.

---

## New Files

### `src/background/apsAuth.ts`

Owns the token in `chrome.storage.session`. No other module writes to these storage keys.

**Storage keys:**
- `apsAccessToken` — the raw token string
- `apsAccessTokenMeta` — `{ expiresAt: number, updatedAt: number }`

**Exports:**
```typescript
export async function setApsToken(token: string, expiresIn: number): Promise<void>
// Strips leading "Bearer " prefix before storing.
// Computes expiresAt = Date.now() + expiresIn * 1000.

export async function ensureApsToken(): Promise<string>
// Returns token if present and not expired.
// Throws 'No APS token — open a Fusion Manage tab' if missing.
// Throws 'APS token expired — switch to a Fusion Manage tab to refresh' if past expiresAt.
```

`chrome.storage.session` is memory-only: survives MV3 service worker restarts, wiped on browser restart. The manifest already has the `storage` permission.

---

### `src/extension/background/apsTokenSync.ts`

Runs in the content script context. Fetches the token and keeps it alive.

**Export:**
```typescript
export async function syncApsTokenToBackground(): Promise<void>
// 1. fetch('/api/v3/token', { credentials: 'same-origin' })
// 2. sendRuntimeMessageFireAndForget({ type: 'AUTH_TOKEN_SYNC', payload: { token, expiresIn } })
// 3. setTimeout(syncApsTokenToBackground, (expiresIn - 300) * 1000)
```

Called once on page load, hooked into the existing navigation/route entry point. Self-reschedules — no external polling needed.

If the fetch fails, the error is logged and no message is sent. The previously stored token (if any) is retained.

---

## Changes to Existing Files

### `src/background/index.ts`

Add `AUTH_TOKEN_SYNC` handler alongside the existing `HTTP_REQUEST` handler:

```typescript
if (msg.type === 'AUTH_TOKEN_SYNC') {
  if (!isTrustedPlmSender(sender)) {
    sendResponse({ ok: false, error: 'Untrusted sender' })
    return
  }
  setApsToken(msg.payload.token, msg.payload.expiresIn)
    .then(() => sendResponse({ ok: true }))
    .catch(err => sendResponse({ ok: false, error: err.message }))
  return true
}
```

Sender validation accepts only `https://*.autodeskplm360.net/plm/*` — reuses existing scope-detection logic.

---

### `src/background/plm.autodeskDeveloper.ts`

Remove `apsSessionFetchInit()`. All APS fetch calls become async and inject the bearer token:

```typescript
// Before:
const init = apsSessionFetchInit({ 'Content-Type': 'application/json' })
const res = await fetch(url, init)

// After:
const token = await ensureApsToken()
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
})
```

`credentials: 'include'` is removed from APS calls. From the background worker's `chrome-extension://` origin, it carried no PLM session cookies for `developer.api.autodesk.com` — this is cleanup, not a behaviour change.

---

### Content script entry point

`syncApsTokenToBackground()` is called once on page load, alongside the existing navigation/route patching. Exact hook point confirmed during implementation.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `GET /api/v3/token` returns non-200 or network error | Log error, do not send `AUTH_TOKEN_SYNC`. Retain previously stored token. Retry on next scheduled refresh or navigation. |
| APS call made with missing token | `ensureApsToken` throws → propagates as `{ ok: false, error: '...' }` from the background broker → `requestPlmAction` throws in the content script → existing UI error handling covers it. |
| APS call made with expired token | Same as above. |
| Browser restart / service worker wakes with empty storage | First APS call fails. Resolves on next PLM page navigation. Acceptable — browser restart requires reloading Fusion Manage. |

---

## Testing

### `src/background/__tests__/apsAuth.test.ts` (new)

- `setApsToken` stores token and computes `expiresAt` correctly
- `ensureApsToken` returns token when valid
- `ensureApsToken` throws when token is missing
- `ensureApsToken` throws when token is expired
- `setApsToken` strips leading `"Bearer "` prefix

### `src/extension/background/__tests__/apsTokenSync.test.ts` (new)

- Fetches `/api/v3/token` with `credentials: 'same-origin'`
- Sends `AUTH_TOKEN_SYNC` message with correct token and `expiresIn`
- Schedules refresh at `(expiresIn - 300) * 1000` ms
- Does not send message if fetch fails

### `src/background/__tests__/plm.autodeskDeveloper.test.ts` (extend existing)

- APS calls inject `Authorization: Bearer <token>` header
- APS calls propagate `ensureApsToken` error when token is missing

---

## What Does Not Change

- `manifest.json` — `storage` permission already present, no new host permissions needed
- `src/background/http.ts` — PLM calls unchanged
- `src/background/plmActionAllowlist.ts` — auth is transparent to action routing
- `src/extension/background/actions.ts` — `requestPlmAction` interface unchanged
- Content script invocation pattern — fully backward compatible
