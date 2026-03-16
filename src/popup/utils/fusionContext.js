/**
 * Fusion Manage URL context extracted from a page URL.
 *
 * @typedef {Object} FusionContext
 * @property {boolean} isFusionManage
 * @property {string|null} tenant
 * @property {number|null} workspaceId
 * @property {number|null} dmsId
 * @property {string|null} itemTab
 * @property {string|null} pathname
 * @property {string} fullUrl
 */

const FUSION_HOST_SUFFIX = 'autodeskplm360.net';

/**
 * Matches:
 *   https://TENANT.autodeskplm360.net/...
 */
const TENANT_HOST_RE = /^(?:https?:\/\/)?(?<tenant>[^.]+)\.autodeskplm360\.net/i;

/**
 * Matches:
 *   /plm/workspaces/86
 */
const WORKSPACE_PATH_RE = /\/plm\/workspaces\/(?<workspaceId>\d+)\b/i;

/* ============================================================================
   PRIMITIVES
============================================================================ */

/**
 * Safely parse a positive integer from a string.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
function parseIntOrNull(value) {
    if (typeof value !== 'string' || value.trim() === '') return null;
    if (!/^\d+$/.test(value)) return null;

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Extract workspaceId and dmsId from the `itemId` query parameter.
 *
 * Example:
 *   urn`adsk.plm`tenant,workspace,item`TENANT_NAME,86,11710
 *
 * We intentionally rely on the final two comma-separated segments.
 *
 * @param {string|null} itemIdParam
 * @returns {{ workspaceId: number|null, dmsId: number|null }}
 */
function parseItemIdParam(itemIdParam) {
    if (typeof itemIdParam !== 'string' || itemIdParam.length === 0) {
        return { workspaceId: null, dmsId: null };
    }

    const parts = itemIdParam.split(',');
    return {
        workspaceId: parseIntOrNull(parts.at(-2)),
        dmsId: parseIntOrNull(parts.at(-1)),
    };
}

/* ============================================================================
   MAIN PARSER
============================================================================ */

/**
 * Extract tenant, workspaceId, item dmsId, and item tab (if present)
 * from a Fusion Manage URL.
 *
 * @param {string} urlString
 * @returns {FusionContext}
 */
export function getFusionContextFromUrl(urlString) {
    let url;

    try {
        url = new URL(urlString);
    } catch {
        return {
            isFusionManage: false,
            tenant: null,
            workspaceId: null,
            dmsId: null,
            itemTab: null,
            pathname: null,
            fullUrl: urlString,
        };
    }

    const hostname = url.hostname.toLowerCase();
    const isFusionHost = hostname.endsWith(FUSION_HOST_SUFFIX);
    const tenantMatch = TENANT_HOST_RE.exec(url.origin);
    const tenant = tenantMatch?.groups?.tenant ?? null;
    const isFusionManage = isFusionHost && tenant !== null;
    const workspaceFromPath = parseIntOrNull(
        WORKSPACE_PATH_RE.exec(url.pathname)?.groups?.workspaceId
    );

    const { workspaceId: workspaceFromParam, dmsId } =
        parseItemIdParam(url.searchParams.get('itemId'));

    return {
        isFusionManage,
        tenant,
        workspaceId: workspaceFromPath ?? workspaceFromParam,
        dmsId,
        itemTab: url.searchParams.get('tab'),
        pathname: url.pathname,
        fullUrl: urlString,
    };
}
