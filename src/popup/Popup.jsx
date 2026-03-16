import { useEffect, useMemo, useState } from 'react';
import { getFusionContextFromUrl } from './utils/fusionContext';

const HEALTH_DIAGNOSTIC_STORAGE_KEY = 'plmExtension.healthDiagnostic';
const HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY = 'plmExtension.healthDiagnosticByPageSignature';

function getHashTab(url) {
    const hash = String(url.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    return String(hashParams.get('tab') || '').toLowerCase();
}

function isSameRouteFamily(urlA, urlB) {
    try {
        const a = new URL(String(urlA || ''));
        const b = new URL(String(urlB || ''));
        const aTab = String(a.searchParams.get('tab') || '').toLowerCase();
        const bTab = String(b.searchParams.get('tab') || '').toLowerCase();
        const aHashTab = getHashTab(a);
        const bHashTab = getHashTab(b);

        return (
            a.origin === b.origin &&
            a.pathname === b.pathname &&
            aTab === bTab &&
            aHashTab === bHashTab
        );
    } catch {
        return false;
    }
}

function getDiagnosticSignatureCandidates(activeUrl) {
    try {
        const url = new URL(String(activeUrl || ''));
        const pathname = url.pathname.toLowerCase();
        const tab = String(url.searchParams.get('tab') || '').toLowerCase();
        const hashTab = getHashTab(url);

        if (pathname.includes('/items/itemdetails') || pathname.includes('/items/additem')) {
            return ['runtime-baseline:item-details'];
        }
        if (pathname.includes('/items/grid')) {
            return ['runtime-baseline:grid'];
        }
        if (pathname.includes('/items/bom/nested') && tab === 'bom') {
            return ['bom.clone', 'runtime-baseline:bom'];
        }
        if (pathname.includes('/admin') || tab === 'users' || hashTab === 'users' || tab === 'groups' || tab === 'roles') {
            return ['runtime-baseline:security-users'];
        }
    } catch {
        // Ignore parse failures.
    }
    return [];
}

function getActiveTab() {
    return new Promise((resolve) => {
        if (!chrome?.tabs) return resolve(null);
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab ?? null));
    });
}

const ITEM_DETAILS_FEATURES = ['itemDetails.relatedLinks', 'itemDetails.options', 'itemDetails.search'];
const GRID_FEATURES = ['grid.filters', 'grid.advancedEditor', 'grid.export'];
const BOM_FEATURES = ['bom.clone'];

const FEATURE_LABELS = {
    itemDetails: 'Item Details',
    'itemDetails.relatedLinks': 'Related Links',
    'itemDetails.options': 'Options',
    'itemDetails.search': 'Search',
    grid: 'Grid',
    'grid.filters': 'Grid Filters',
    'grid.advancedEditor': 'Grid Advanced Editor',
    'grid.export': 'Grid Export',
    'bom.clone': 'BOM Clone',
    securityUsersFilter: 'Users Filters'
};

function toFeatureLabel(featureKey) {
    return FEATURE_LABELS[featureKey] || featureKey;
}

function isFeatureDisabled(featureKey, disabledFeatures) {
    if (disabledFeatures.includes(featureKey)) return true;
    if (featureKey.startsWith('itemDetails.') && disabledFeatures.includes('itemDetails')) return true;
    if (featureKey.startsWith('grid.') && disabledFeatures.includes('grid')) return true;
    if (featureKey.startsWith('bom.') && disabledFeatures.includes('bom')) return true;
    return false;
}

function getExpectedFeatures(context) {
    if (!context?.isFusionManage) return [];
    const path = String(context.pathname || '').toLowerCase();
    const tab = String(context.itemTab || '').toLowerCase();
    const fullUrl = String(context.fullUrl || '').toLowerCase();
    const hash = fullUrl.includes('#') ? fullUrl.slice(fullUrl.indexOf('#') + 1) : '';
    const hashParams = new URLSearchParams(hash);
    const hashTab = String(hashParams.get('tab') || '').toLowerCase();

    if (path.includes('/items/itemdetails') || path.includes('/items/additem')) return ITEM_DETAILS_FEATURES;
    if (path.includes('/items/grid')) return GRID_FEATURES;
    if (path.includes('/items/bom/nested') && tab === 'bom') return BOM_FEATURES;
    if (tab === 'users' || hashTab === 'users') return ['securityUsersFilter'];
    return [];
}

function resolveDiagnosticForUrl(activeUrl, localResult) {
    if (!activeUrl) return null;
    const byPageSignature = localResult?.[HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY] || {};
    const candidates = getDiagnosticSignatureCandidates(activeUrl);
    for (const candidate of candidates) {
        const exact = byPageSignature?.[candidate] || null;
        if (exact) return exact;
        const prefixed = Object.values(byPageSignature).find(
            (entry) => {
                const scope = String(entry?.pageScope || '');
                const signature = String(entry?.pageSignature || '');
                return scope === candidate
                    || scope.startsWith(`${candidate}:`)
                    || signature === candidate
                    || signature.startsWith(`${candidate}:`);
            }
        );
        if (prefixed) return prefixed;
    }

    const latest = localResult?.[HEALTH_DIAGNOSTIC_STORAGE_KEY] || null;
    if (!latest) return null;
    if (candidates.some((candidate) => {
        const scope = String(latest.pageScope || '');
        const signature = String(latest.pageSignature || '');
        return scope === candidate
            || scope.startsWith(`${candidate}:`)
            || signature === candidate
            || signature.startsWith(`${candidate}:`);
    })) return latest;
    return null;
}

function getFeatureRows(expectedFeatures, diagnostic) {
    if (expectedFeatures.length === 0) return [];
    if (!diagnostic) {
        return expectedFeatures.map((featureKey) => ({
            featureKey,
            featureName: toFeatureLabel(featureKey),
            status: 'Unknown'
        }));
    }
    const disabled = Array.isArray(diagnostic?.disabledFeatures) ? diagnostic.disabledFeatures : [];
    return expectedFeatures.map((featureKey) => ({
        featureKey,
        featureName: toFeatureLabel(featureKey),
        status: isFeatureDisabled(featureKey, disabled) ? 'Disabled' : 'Enabled'
    }));
}

function getConnectionState(isActive, diagnostic, expectedFeatures, featureRows) {
    if (!isActive || expectedFeatures.length === 0) {
        return { label: 'Not connected', badge: 'INACTIVE', mode: 'not', tone: 'down' };
    }
    if (!diagnostic) {
        return { label: 'Not connected', badge: 'INACTIVE', mode: 'not', tone: 'down' };
    }

    const status = String(diagnostic.status || '');
    const enabledCount = featureRows.filter((row) => row.status === 'Enabled').length;
    const allEnabled = enabledCount === expectedFeatures.length;
    const hasDisabled = featureRows.some((row) => row.status === 'Disabled');
    const hasUnknown = featureRows.some((row) => row.status === 'Unknown');
    const hasIssues = status === 'PARTIAL_FAILURE' || status === 'CRITICAL_FAILURE' || hasDisabled;

    if (enabledCount === 0 || status === 'CRITICAL_FAILURE') {
        return { label: 'Not connected', badge: 'INACTIVE', mode: 'not', tone: 'down' };
    }

    if (status === 'HEALTHY' && allEnabled && !hasIssues && !hasUnknown) {
        return { label: 'Connected', badge: 'ACTIVE', mode: 'connected', tone: 'healthy' };
    }

    return { label: 'Partially connected (issues found)', badge: 'PARTIAL', mode: 'partial', tone: 'partial' };
}

function getHealthBadgeClass(status) {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'HEALTHY') return '';
    if (normalized === 'CRITICAL_FAILURE') return 'status-badge--red';
    if (normalized === 'DEGRADED' || normalized === 'PARTIAL_FAILURE') return 'status-badge--partial';
    return 'status-badge--partial';
}

function getFeatureBadgeClass(status) {
    if (status === 'Enabled') return '';
    if (status === 'Disabled') return 'status-badge--red';
    return 'status-badge--partial';
}

export default function Popup() {
    const [context, setContext] = useState(null);
    const [activeUrl, setActiveUrl] = useState('');
    const [diagnostic, setDiagnostic] = useState(null);

    useEffect(() => {
        let mounted = true;

        void (async () => {
            const tab = await getActiveTab();
            if (!mounted || !tab?.url) return;
            setActiveUrl(tab.url);
            setContext(getFusionContextFromUrl(tab.url));
        })();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!activeUrl) return undefined;
        let mounted = true;

        const refreshDiagnostic = () => {
            chrome.storage.session.get(
                [HEALTH_DIAGNOSTIC_STORAGE_KEY, HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY],
                (localResult) => {
                    if (chrome?.runtime?.lastError) {
                        if (!mounted) return;
                        setDiagnostic(null);
                        return;
                    }
                    if (!mounted) return;
                    setDiagnostic(resolveDiagnosticForUrl(activeUrl, localResult));
                }
            );
        };

        refreshDiagnostic();

        const onStorageChanged = (changes, areaName) => {
            const sessionChanged =
                areaName === 'session' &&
                (changes?.[HEALTH_DIAGNOSTIC_STORAGE_KEY] || changes?.[HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY]);
            if (!sessionChanged) return;
            refreshDiagnostic();
        };

        chrome.storage.onChanged.addListener(onStorageChanged);
        return () => {
            mounted = false;
            chrome.storage.onChanged.removeListener(onStorageChanged);
        };
    }, [activeUrl]);

    const isExtensionActive = Boolean(context?.isFusionManage);
    const expectedFeatures = useMemo(() => getExpectedFeatures(context), [context]);
    const featureRows = useMemo(() => getFeatureRows(expectedFeatures, diagnostic), [expectedFeatures, diagnostic]);
    const missingSelectors = useMemo(
        () => (Array.isArray(diagnostic?.missingSelectors) ? diagnostic.missingSelectors : []),
        [diagnostic]
    );
    const hasFeatureScope = expectedFeatures.length > 0;
    const connection = useMemo(
        () => getConnectionState(isExtensionActive, diagnostic, expectedFeatures, featureRows),
        [isExtensionActive, diagnostic, expectedFeatures, featureRows]
    );

    return (
        <div className={isExtensionActive ? 'container' : 'inactive-container'}>
            <Header tenant={context?.tenant} />

            <div className="actions">
                {!isExtensionActive || !hasFeatureScope ? (
                    <DisabledPageMessage isFusionManage={isExtensionActive} />
                ) : (
                    <HealthDashboard
                        diagnostic={diagnostic}
                        expectedFeatures={expectedFeatures}
                        featureRows={featureRows}
                        missingSelectors={missingSelectors}
                    />
                )}
            </div>

            <Footer connection={connection} />
        </div>
    );
}

function Header({ tenant }) {
    return (
        <div className="header">
            <img src={chrome.runtime.getURL('icon-48.png')} alt="Fusion Manage Chromium Extensions" className="header-logo" />
            <div className="header-content">
                <h1>Fusion Manage Chromium Extensions</h1>
                {tenant ? <p className="tenant-badge">{tenant}</p> : <p className="tenant-badge inactive-badge">NO TENANT</p>}
            </div>
        </div>
    );
}

function HealthDashboard({ diagnostic, expectedFeatures, featureRows, missingSelectors }) {
    const status = diagnostic?.status || 'UNKNOWN';
    const schemaVersion = diagnostic?.schemaVersion || '-';
    const extensionVersion = diagnostic?.extensionVersion || '-';

    return (
        <div className="health-card">
            <div className="health-card-header">
                <span className="health-card-title">Health Dashboard</span>
                <span className={`status-badge health-status-badge ${getHealthBadgeClass(status)}`}>{status}</span>
            </div>

            <div className="health-card-grid health-card-grid--meta">
                <HealthRow label="Schema" value={schemaVersion} />
                <HealthRow label="Extension" value={extensionVersion} />
            </div>

            <div className="health-metric-cards">
                <MetricCard label="Expected Features" value={String(expectedFeatures.length)} />
                <MetricCard label="Missing Selectors" value={String(missingSelectors.length)} />
            </div>

            <div className="health-table-wrap">
                <table className="health-table">
                    <thead>
                        <tr>
                            <th>Feature Name</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {featureRows.length === 0 ? (
                            <tr>
                                <td colSpan="2" className="health-table-empty">No feature scope for this page.</td>
                            </tr>
                        ) : (
                            featureRows.map((row) => (
                                <tr key={row.featureKey}>
                                    <td>{row.featureName}</td>
                                    <td>
                                        <span
                                            className={`status-badge health-feature-status ${getFeatureBadgeClass(row.status)}`}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function HealthRow({ label, value }) {
    return (
        <div className="health-row">
            <span className="health-row-label">{label}</span>
            <span className="health-row-value">{value}</span>
        </div>
    );
}

function MetricCard({ label, value }) {
    return (
        <div className="health-metric-card">
            <span className="health-metric-card-label">{label}</span>
            <span className="health-metric-card-value">{value}</span>
        </div>
    );
}

function DisabledPageMessage({ isFusionManage }) {
    return (
        <div className="unsupported-page-card">
            <div className="unsupported-page-title">Extension Disabled On This Page</div>
            <div className="unsupported-page-icon" aria-hidden="true">✖</div>
            <p className="unsupported-page-text">
                {isFusionManage
                    ? 'This page is not currently supported by Fusion Manage Chromium Extensions.'
                    : 'Fusion Manage Chromium Extensions only runs on supported Autodesk Fusion Manage pages.'}
            </p>
        </div>
    );
}

function Footer({ connection }) {
    const tone = connection?.tone || 'down';
    const statusClass = tone === 'healthy' ? '' : tone === 'partial' ? 'status-dot--partial' : 'status-dot--red';
    const badgeClass = tone === 'healthy' ? '' : tone === 'partial' ? 'status-badge--partial' : 'status-badge--red';

    return (
        <div className="footer">
            <div className="footer-status">
                <span className={`status-dot ${statusClass}`} />
                <span>{connection.label}</span>
            </div>
            <span className={`status-badge ${badgeClass}`}>{connection.badge}</span>
        </div>
    );
}
