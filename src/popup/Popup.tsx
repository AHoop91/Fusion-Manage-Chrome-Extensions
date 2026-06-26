import { useCallback, useEffect, useMemo, useState, type CSSProperties, type JSX } from 'react'
import { FEATURES, type FeatureFlags } from '../build/featureFlags'
import type { FeatureFlagKey } from '../build/featureFlagKeys'
import { mergeBuildWithRuntimeOverrides } from '../extension/runtime/effectiveFeatures'
import {
  clearRuntimeFeatureStorage,
  getRuntimeFeatureOverridesFromStorage,
  persistRuntimeFeatureToggle,
  RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY
} from '../extension/runtime/runtimeFeatureStorage'
import { FeatureIcon } from './featureIcons'
import { getFusionContextFromUrl } from './fusionContext'
import { RUNTIME_TOGGLE_ROWS, isFlagInBuild, type RuntimeToggleRow } from './runtimeToggleDefs'

function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    if (!chrome?.tabs) return resolve(null)
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab ?? null))
  })
}

export default function Popup(): JSX.Element {
  const [tenant, setTenant] = useState<string | null>(null)
  const [effectiveMerged, setEffectiveMerged] = useState(() => mergeBuildWithRuntimeOverrides(FEATURES, {}))
  const [statusNote, setStatusNote] = useState('')

  const shippedRows = useMemo(
    () => RUNTIME_TOGGLE_ROWS.filter((row) => isFlagInBuild(row, FEATURES)),
    []
  )

  const refreshFromStorage = useCallback(async () => {
    const overrides = await getRuntimeFeatureOverridesFromStorage()
    setEffectiveMerged(mergeBuildWithRuntimeOverrides(FEATURES, overrides))
  }, [])

  useEffect(() => {
    let mounted = true
    void (async () => {
      const tab = await getActiveTab()
      if (!mounted || !tab?.url) return
      const ctx = getFusionContextFromUrl(tab.url)
      setTenant(ctx.tenant)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    void refreshFromStorage()
  }, [refreshFromStorage])

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return undefined
    const handler = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: 'sync' | 'local' | 'managed' | 'session'
    ) => {
      if (area !== 'local') return
      if (!changes[RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY]) return
      void refreshFromStorage()
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }, [refreshFromStorage])

  const onToggleFlag = useCallback(
    async (key: FeatureFlagKey, nextOn: boolean) => {
      await persistRuntimeFeatureToggle(key, nextOn)
      await refreshFromStorage()
    },
    [refreshFromStorage]
  )

  const onResetRuntime = useCallback(async () => {
    await clearRuntimeFeatureStorage()
    await refreshFromStorage()
    setStatusNote('Runtime choices cleared. Tabs refresh on next navigation.')
    window.setTimeout(() => setStatusNote(''), 6000)
  }, [refreshFromStorage])

  return (
    <div className="container">
      <Header tenant={tenant} />
      <FeaturesPanel
        effective={effectiveMerged}
        shippedRows={shippedRows}
        onToggle={onToggleFlag}
        onReset={onResetRuntime}
        statusNote={statusNote}
      />
    </div>
  )
}

function Header({ tenant }: { tenant: string | null }): JSX.Element {
  return (
    <div className="header">
      <img src={chrome.runtime.getURL('icon-48.png')} alt="Fusion Manage Chromium Extensions" className="header-logo" />
      <div className="header-content">
        <h1>Fusion Manage Chromium Extensions</h1>
        {tenant ? <p className="tenant-badge">{tenant}</p> : <p className="tenant-badge inactive-badge">NO TENANT</p>}
      </div>
    </div>
  )
}

type FeaturesPanelProps = {
  effective: FeatureFlags
  shippedRows: RuntimeToggleRow[]
  onToggle: (key: FeatureFlagKey, nextOn: boolean) => void | Promise<void>
  onReset: () => void | Promise<void>
  statusNote: string
}

function FeaturesPanel({ effective, shippedRows, onToggle, onReset, statusNote }: FeaturesPanelProps): JSX.Element {
  const shippedCount = shippedRows.length

  return (
    <section className="features-section" aria-labelledby="features-panel-heading">
      <div className="features-section-head">
        <div className="features-section-head-text">
          <h2 id="features-panel-heading" className="features-heading">
            Features
          </h2>
        </div>
        {shippedCount > 0 ? (
          <span className="features-count" title="Capabilities shipped in this build">
            {shippedCount}
          </span>
        ) : null}
      </div>
      <div className="features-toolbar">
        <button type="button" className="features-reset-btn" onClick={() => void onReset()}>
          Reset browser overrides
        </button>
      </div>
      {statusNote ? (
        <p className="features-status" role="status">
          {statusNote}
        </p>
      ) : null}
      {shippedCount === 0 ? (
        <p className="features-empty">No features are enabled in this build profile.</p>
      ) : (
        <ul className="features-list">
          {shippedRows.map((row) => {
            const checked = Boolean(effective[row.flagKey])

            return (
              <li
                key={row.id}
                className="feature-line feature-line--toggle"
                style={{ '--feature-accent': row.accent } as CSSProperties}
              >
                <div className="feature-line-toggle-main">
                  <div className="feature-line-icon-wrap feature-line-icon-wrap--compact" aria-hidden>
                    <FeatureIcon name={row.icon} />
                  </div>
                  <div className="feature-line-body">
                    <div className="feature-line-title-row">
                      <div className="feature-line-title">{row.title}</div>
                      {row.pill === 'premium' ? <span className="feature-premium-pill">Paid Tier API</span> : null}
                    </div>
                    <p className="feature-line-detail">{row.detail}</p>
                  </div>
                </div>
                <label className="toggle" title="Toggle for this browser">
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-label={`${row.title} on this browser`}
                    onChange={(e) => {
                      void onToggle(row.flagKey, e.target.checked)
                    }}
                  />
                  <span className="toggle-track" aria-hidden>
                    <span className="toggle-thumb" />
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
