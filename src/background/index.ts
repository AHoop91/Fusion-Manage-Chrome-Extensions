import { updateActionForTab } from './helper'
import * as plm from './plm'
import { ALLOWED_PLM_ACTIONS } from './plmActionAllowlist'

let managedPolicy: Record<string, unknown> = {}
const ITEM_PAGE_PATH_RE = /^\/plm\/workspaces\/\d+\/items\/.+/i
const ADMIN_PAGE_PATH_RE = /^\/admin(?:\b|\/|$)/i
const HTTP_REQUEST_ALLOWED_SCOPES = new Set(['extension', 'item-page'])

function enableSessionStorageForContentScripts(): void {
  try {
    if (chrome?.storage?.session?.setAccessLevel) {
      chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
      })
    }
  } catch {
    // Ignore access-level failures; popup/runtime fallback still works.
  }
}

enableSessionStorageForContentScripts()

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

function isAllowedHttpRequestSender(sender: chrome.runtime.MessageSender): string | null {
  if (sender?.id && sender.id !== chrome.runtime.id) return null
  return getSenderScope(sender?.url) || getSenderScope(sender?.tab?.url)
}

function isAllowedActionForSenderScope(action: string, senderScope: string | null): boolean {
  if (!senderScope || !HTTP_REQUEST_ALLOWED_SCOPES.has(senderScope)) return false
  return ALLOWED_PLM_ACTIONS.has(action)
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'managed') return

  for (const key in changes) {
    managedPolicy[key] = changes[key].newValue
  }
})

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

  const message = msg as {
    type?: string
    payload?: {
      action?: string
      payload?: unknown
    }
  }

  if (message.type === 'HEALTH_DIAGNOSTIC_EVENT') {
    const tabId = sender?.tab?.id
    const tabUrl = sender?.tab?.url

    if (typeof tabId === 'number' && typeof tabUrl === 'string') {
      void updateActionForTab(tabId, tabUrl, message.payload || null)
        .then(() => sendResponse({ ok: true }))
        .catch((err: any) => sendResponse({ ok: false, error: err?.message || 'Failed to update action state' }))
      return true
    }

    sendResponse({ ok: true })
    return
  }

  if (message.type !== 'HTTP_REQUEST') return

  const senderScope = isAllowedHttpRequestSender(sender)
  if (!senderScope) {
    sendResponse({
      ok: false,
      error: 'Unauthorized request sender'
    })
    return
  }

  const action = message.payload?.action
  const payload = message.payload?.payload ?? {}

  if (!action || typeof action !== 'string') {
    sendResponse({
      ok: false,
      error: 'Invalid HTTP_REQUEST payload'
    })
    return
  }

  if (!isAllowedActionForSenderScope(action, senderScope)) {
    sendResponse({
      ok: false,
      error: `Disallowed PLM action for sender scope: ${action}`
    })
    return
  }

  if (!isPlainObject(payload)) {
    sendResponse({
      ok: false,
      error: 'Invalid HTTP_REQUEST payload body'
    })
    return
  }

  const fn = (plm as unknown as Record<string, (input: Record<string, unknown>) => Promise<unknown>>)[action]
  if (!fn) {
    sendResponse({
      ok: false,
      error: `Unknown PLM action: ${action}`
    })
    return
  }

  void fn(payload)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err: any) => sendResponse({
      ok: false,
      error: err?.message || String(err)
    }))

  return true
})
