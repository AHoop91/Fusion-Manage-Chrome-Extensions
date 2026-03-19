export function buildBomScopeStyles(scopeId: string, options?: { includeSymbolFont?: boolean }): string {
  return `
#${scopeId}{
  --plm-bom-font-sans:"ArtifaktElement","Segoe UI",Arial,sans-serif;
${options?.includeSymbolFont ? '  --plm-bom-font-symbol:"Segoe UI Symbol","Segoe UI",Arial,sans-serif;\n' : ''}}
`
}
