export type StructuralAssertionSeverity = 'minor' | 'major' | 'critical'

export type StructuralAssertionType = 'exists' | 'hasAttribute' | 'attributeEquals' | 'minChildren'

export type StructuralAssertion = {
  id: string
  selector: string
  assertion: StructuralAssertionType
  severity: StructuralAssertionSeverity
  attributeName?: string
  expectedValue?: string
  minChildren?: number
}

export interface HealthSchemaV1 {
  schemaVersion: '1.0.0'
  pageSignature: string
  requiredSelectors: string[]
  optionalSelectors: string[]
  structuralAssertions: StructuralAssertion[]
  featureDependencies: Record<string, string[]>
}

