import { isFeatureEnabled } from '../../shared/policy';

/* ============================================================================
   WORKSPACE DEFINITIONS
============================================================================ */

/**
 * Canonical workspace identifiers.
 * This is domain knowledge and should remain stable.
 */
export const WORKSPACES = Object.freeze({
    items: 86,
    pr: 82,
    cr: 83,
    co: 84,
    products: 95,
    assets: 280
});

/**
 * Reverse lookup for workspace ID → workspace name.
 * Enables O(1) resolution.
 */
const WORKSPACE_ID_TO_NAME = Object.freeze(
    Object.fromEntries(
        Object.entries(WORKSPACES).map(([name, id]) => [id, name])
    )
);

/**
 * Resolve workspace name from numeric ID.
 *
 * @param {unknown} workspaceId
 * @returns {string|null}
 */
function resolveWorkspaceName(workspaceId) {
    return typeof workspaceId === 'number'
        ? WORKSPACE_ID_TO_NAME[workspaceId] ?? null
        : null;
}

/* ============================================================================
   ACTION SELECTION
============================================================================ */

/**
 * Determine whether an action applies to the given workspace.
 *
 * @param {Object} action
 * @param {string|null} workspaceName
 * @returns {boolean}
 */
function matchesWorkspace(action, workspaceName) {
    // No workspaces defined → global action
    if (!Array.isArray(action.workspaces) || action.workspaces.length === 0) {
        return true;
    }

    return Boolean(workspaceName && action.workspaces.includes(workspaceName));
}

/**
 * Central selector for extension actions based on context and policy.
 *
 * @param {Object|null} context
 * @param {Object|null} policy
 * @returns {Array<Object>}
 */
export function getButtonsForContext(context, policy) {
    if (!context) return [];

    const workspaceName = resolveWorkspaceName(context.workspaceId);

    return BUTTON_REGISTRY.filter((action) => {
        if (!matchesWorkspace(action, workspaceName)) {
            return false;
        }

        // Enterprise / feature gating
        if (action.feature) {
            return isFeatureEnabled(action.feature, context, policy);
        }

        return true;
    });
}

/* ============================================================================
   ACTION REGISTRY
============================================================================ */

/**
 * Central registry of extension actions.
 *
 * IMPORTANT:
 * - Pure configuration only
 * - No logic
 * - No side effects
 * - Safe to import anywhere
 */
export const BUTTON_REGISTRY = Object.freeze([
    /* =========================================================================
       WORKSPACE ACTIONS
       ========================================================================= */
    {
        id: 'mbom',
        label: 'Manufacturing Bill of Materials Editor',
        icon: '🏭',
        page: 'mbom',
        workspaces: ['items'],
        feature: 'mbom'
    },
    {
        id: 'sbom',
        label: 'Service Bill of Materials Editor',
        icon: '🔩',
        page: 'sbom',
        workspaces: ['products', 'assets'],
        feature: 'sbom'
    },
    {
        id: 'abom',
        label: 'Asset Bill of Materials Editor',
        icon: '🧰',
        page: 'abom',
        workspaces: ['assets'],
        feature: 'abom'
    },
    {
        id: 'cia',
        label: 'Change Impact Analysis',
        icon: '🔄',
        page: 'impact-analysis',
        workspaces: ['pr', 'cr', 'co'],
        feature: 'cia'
    },
    {
        id: 'items-variants',
        label: 'Variants Manager',
        icon: '🧩',
        page: 'variants',
        workspaces: ['items']
    },
    {
        id: 'product-variants',
        label: 'Manage Variants',
        icon: '🧬',
        page: 'variants',
        workspaces: ['products']
    },
    {
        id: 'instances',
        label: 'Instance Editor',
        icon: '🧱',
        page: 'instances',
        workspaces: ['assets']
    },
    {
        id: 'pde',
        label: 'Product Data Explorer',
        icon: '📊',
        page: 'explorer',
        workspaces: ['items']
    },
    {
        id: 'insights-asset',
        label: 'Insights',
        icon: '📈',
        page: 'explorer',
        workspaces: ['assets']
    },
    {
        id: 'class-browser',
        label: 'Browse Class',
        icon: '🏷️',
        page: 'classes',
        workspaces: ['items']
    },
    {
        id: 'service-portal-item',
        label: 'Service Portal',
        icon: '🛠️',
        page: 'service',
        workspaces: ['items']
    },

    /* =========================================================================
       COMMON ACTIONS (global)
       ========================================================================= */
    {
        id: 'portal',
        label: 'Portal',
        icon: '🌐',
        page: 'portal'
    },
    {
        id: 'product-portfolio',
        label: 'Product Portfolio Catalog',
        icon: '📦',
        page: 'product-portfolio'
    },
    {
        id: 'workspace-navigator',
        label: 'Workspace Navigator',
        icon: '🧭',
        page: 'workspace-navigator'
    },
    {
        id: 'reports',
        label: 'Reports Dashboard',
        icon: '📑',
        page: 'reports'
    },
    {
        id: 'projects',
        label: 'Projects Dashboard',
        icon: '📁',
        page: 'projects'
    },
    {
        id: 'problem-reporting',
        label: 'Problem Reporting Dashboard',
        icon: '⚠️',
        page: 'problem-reporting'
    },
    {
        id: 'non-conformance',
        label: 'Non Conformance Dashboard',
        icon: '❗',
        page: 'non-conformance'
    },
    {
        id: 'change-tasks',
        label: 'Change Tasks Dashboard',
        icon: '📋',
        page: 'change-tasks'
    },
    {
        id: 'service-portal',
        label: 'Service Portal',
        icon: '🛠️',
        page: 'service-portal'
    }
]);