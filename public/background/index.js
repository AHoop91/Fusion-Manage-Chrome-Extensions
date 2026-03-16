import { updateActionForTab } from "./helper.js";
import * as plm from './plm.js';
import { ALLOWED_PLM_ACTIONS } from './plmActionAllowlist.js';

let managedPolicy = {};
const ITEM_PAGE_PATH_RE = /^\/plm\/workspaces\/\d+\/items\/.+/i;
const ADMIN_PAGE_PATH_RE = /^\/admin(?:\b|\/|$)/i;
const HTTP_REQUEST_ALLOWED_SCOPES = new Set(['extension', 'item-page']);

function enableSessionStorageForContentScripts() {
    try {
        if (chrome?.storage?.session?.setAccessLevel) {
            chrome.storage.session.setAccessLevel({
                accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
            });
        }
    } catch {
        // Ignore access-level failures; popup/runtime fallback still works.
    }
}

enableSessionStorageForContentScripts();

function getSenderScope(urlString) {
    if (typeof urlString !== 'string' || !urlString.trim()) return null;

    try {
        const url = new URL(urlString);
        if (url.protocol === 'chrome-extension:') return 'extension';
        if (url.protocol !== 'https:' || !url.hostname.toLowerCase().endsWith('autodeskplm360.net')) return null;
        if (ITEM_PAGE_PATH_RE.test(url.pathname)) return 'item-page';
        if (ADMIN_PAGE_PATH_RE.test(url.pathname)) return 'admin-page';
        return null;
    } catch {
        return null;
    }
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isAllowedHttpRequestSender(sender) {
    if (sender?.id && sender.id !== chrome.runtime.id) return null;
    return getSenderScope(sender?.url) || getSenderScope(sender?.tab?.url);
}

function isAllowedActionForSenderScope(action, senderScope) {
    if (!senderScope || !HTTP_REQUEST_ALLOWED_SCOPES.has(senderScope)) return false;
    return ALLOWED_PLM_ACTIONS.has(action);
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'managed') return;

    for (const key in changes) {
        managedPolicy[key] = changes[key].newValue;
    }
});

/**
 * Fired whenever a tab finishes navigating to a new URL.
 * This ensures the extension action (badge/icon) reflects
 * the current page after navigation completes.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !tab?.url) return;
    updateActionForTab(tabId, tab.url);
});

/**
 * Fired when the user switches between browser tabs.
 * Required because Chrome action state (badge/icon) is
 * maintained per-tab and does not automatically update
 * when changing the active tab.
 */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId);
    updateActionForTab(tabId, tab.url);
});


/**
 * Background message router for extension HTTP actions.
 *
 * This listener acts as a thin dispatch layer between the UI and
 * domain-specific background logic (PLM actions).
 *
 * Responsibilities:
 * - Accept a single, generic message type: `HTTP_REQUEST`
 * - Route the request to a named PLM action (e.g. fetchChanges, fetchQuotes)
 * - Execute the action inside the background context
 * - Return a normalized success/error response to the caller
 *
 * Important design constraints:
 * - The UI never performs authenticated HTTP requests directly
 * - Background requests rely on the active Fusion Manage browser session
 * - No Express / session semantics are recreated here
 * - All business logic lives in `plm.js`, not in this router
 *
 * Message contract:
 * {
 *   type: 'HTTP_REQUEST',
 *   payload: {
 *     action: string,     // Name of exported PLM function
 *     payload: object     // Parameters passed to the action
 *   }
 * }
 *
 * Response contract:
 * {
 *   ok: boolean,
 *   data?: any,
 *   error?: string
 * }
 *
 * Note:
 * Returning `true` keeps the message channel open for async responses,
 * which is required when performing network requests in MV3.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'HEALTH_DIAGNOSTIC_EVENT') {
        const tabId = sender?.tab?.id;
        const tabUrl = sender?.tab?.url;

        if (typeof tabId === 'number' && typeof tabUrl === 'string') {
            updateActionForTab(tabId, tabUrl, msg.payload || null)
                .then(() => sendResponse({ ok: true }))
                .catch((err) => sendResponse({ ok: false, error: err?.message || 'Failed to update action state' }));
            return true;
        }

        sendResponse({ ok: true });
        return;
    }

    if (msg.type !== 'HTTP_REQUEST') return;

    const senderScope = isAllowedHttpRequestSender(sender);
    if (!senderScope) {
        sendResponse({
            ok: false,
            error: 'Unauthorized request sender'
        });
        return;
    }

    const action = msg.payload?.action;
    const payload = msg.payload?.payload ?? {};

    if (!action || typeof action !== 'string') {
        sendResponse({
            ok: false,
            error: 'Invalid HTTP_REQUEST payload'
        });
        return;
    }

    if (!isAllowedActionForSenderScope(action, senderScope)) {
        sendResponse({
            ok: false,
            error: `Disallowed PLM action for sender scope: ${action}`
        });
        return;
    }

    if (!isPlainObject(payload)) {
        sendResponse({
            ok: false,
            error: 'Invalid HTTP_REQUEST payload body'
        });
        return;
    }

    const fn = plm[action];
    if (!fn) {
        sendResponse({
            ok: false,
            error: `Unknown PLM action: ${action}`
        });
        return;
    }

    fn(payload)
        .then((data) =>
            sendResponse({ ok: true, data })
        )
        .catch((err) =>
            sendResponse({
                ok: false,
                error: err.message
            })
        );

    return true;
});
