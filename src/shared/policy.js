/**
 * Generic enterprise feature gate.
 *
 * @param {string} featureName
 * @param {Object|null} ctx
 * @param {Object|null} policy
 * @returns {boolean}
 */
export function isFeatureEnabled(featureName, ctx, policy) {
    // const feature = policy?.features?.[featureName];
    //
    // if (!feature?.enabled) return false;
    //
    // if (Array.isArray(feature.tenants) && feature.tenants.length > 0) {
    //     if (!ctx?.tenant || !feature.tenants.includes(ctx.tenant)) {
    //         return false;
    //     }
    // }
    //
    // if (Array.isArray(feature.workspaces) && feature.workspaces.length > 0) {
    //     if (!ctx?.workspaceId || !feature.workspaces.includes(ctx.workspaceId)) {
    //         return false;
    //     }
    // }
    //
    // if (Array.isArray(feature.tabs) && feature.tabs.length > 0) {
    //     if (!ctx?.itemTab || !feature.tabs.includes(ctx.itemTab)) {
    //         return false;
    //     }
    // }

    return true;
}
