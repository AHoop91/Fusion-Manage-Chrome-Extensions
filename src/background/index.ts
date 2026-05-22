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
    .catch((err: unknown) =>
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      })
    )

  return true
})
