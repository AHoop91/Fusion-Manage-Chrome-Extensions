import { DomAdapter } from '../../dom/DomAdapter'
import { HealthState, HealthStatus, type HealthSnapshot } from './healthState'
import { computePageSignature } from './pageSignature'
import type { HealthSchemaV1, StructuralAssertion } from './contracts/HealthSchema.v1'

type AssertionResult = { ok: true } | { ok: false; failureId: string; severity: StructuralAssertion['severity'] }

function evaluateAssertion(adapter: DomAdapter, assertion: StructuralAssertion): AssertionResult {
  const result = adapter.query<Element>(assertion.selector)
  if (!result.ok) {
    return assertion.assertion === 'exists'
      ? { ok: false, failureId: assertion.id, severity: assertion.severity }
      : { ok: false, failureId: assertion.id, severity: assertion.severity }
  }

  const element = result.value
  switch (assertion.assertion) {
    case 'exists':
      return { ok: true }
    case 'hasAttribute': {
      const hasAttribute = Boolean(assertion.attributeName && element.hasAttribute(assertion.attributeName))
      return hasAttribute ? { ok: true } : { ok: false, failureId: assertion.id, severity: assertion.severity }
    }
    case 'attributeEquals': {
      const actual = assertion.attributeName ? element.getAttribute(assertion.attributeName) || '' : ''
      return actual === (assertion.expectedValue || '')
        ? { ok: true }
        : { ok: false, failureId: assertion.id, severity: assertion.severity }
    }
    case 'minChildren': {
      const minChildren = assertion.minChildren ?? 0
      return element.children.length >= minChildren
        ? { ok: true }
        : { ok: false, failureId: assertion.id, severity: assertion.severity }
    }
    default:
      return { ok: true }
  }
}

function nextStatusFromFailures(
  missingRequired: string[],
  failedAssertions: Array<{ id: string; severity: StructuralAssertion['severity'] }>
): HealthStatus {
  if (missingRequired.length > 0) return HealthStatus.PARTIAL_FAILURE
  if (failedAssertions.some((item) => item.severity === 'critical')) return HealthStatus.CRITICAL_FAILURE
  if (failedAssertions.some((item) => item.severity === 'major')) return HealthStatus.PARTIAL_FAILURE
  if (failedAssertions.some((item) => item.severity === 'minor')) return HealthStatus.DEGRADED
  return HealthStatus.HEALTHY
}

function isSignatureMismatch(schema: HealthSchemaV1, currentSignature: string): boolean {
  const signatureRule = schema.pageSignature || ''
  if (!signatureRule || signatureRule === 'runtime-baseline') return false

  if (signatureRule.startsWith('runtime-baseline:')) {
    const key = signatureRule
    const baseline = HealthState.getBaselineSignature(key)
    if (!baseline) {
      HealthState.setBaselineSignature(key, currentSignature)
      return false
    }
    return baseline !== currentSignature
  }

  if (signatureRule.startsWith('re:')) {
    try {
      return !(new RegExp(signatureRule.slice(3)).test(currentSignature))
    } catch {
      return false
    }
  }

  return signatureRule !== currentSignature
}

export function evaluateHealth(schema: HealthSchemaV1, adapter: DomAdapter): HealthSnapshot {
  const required = adapter.hasAll(schema.requiredSelectors)
  const optional = adapter.hasAll(schema.optionalSelectors)

  const assertionFailures = schema.structuralAssertions
    .map((assertion) => evaluateAssertion(adapter, assertion))
    .filter((result): result is { ok: false; failureId: string; severity: StructuralAssertion['severity'] } => !result.ok)
  const computedSignature = computePageSignature(schema, adapter)
  const unstable = isSignatureMismatch(schema, computedSignature)

  const status = nextStatusFromFailures(required.missingSelectors, assertionFailures.map((item) => ({
    id: item.failureId,
    severity: item.severity
  })))

  return {
    status,
    schema,
    pageSignature: computedSignature,
    missingSelectors: [...required.missingSelectors, ...optional.missingSelectors],
    failedAssertions: assertionFailures.map((item) => item.failureId),
    disabledFeatures: [],
    unstable,
    timestamp: Date.now()
  }
}

