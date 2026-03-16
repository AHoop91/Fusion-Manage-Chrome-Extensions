export type SecurityState = {
  mounted: boolean
}

export function createSecurityState(): SecurityState {
  return {
    mounted: false
  }
}
