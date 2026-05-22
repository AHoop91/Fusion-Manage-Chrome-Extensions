/**
 * Context-specific overrides for shared GenericLoader inside BOM modals.
 * Base loader animation/layout lives in genericLoader.styles.ts.
 */
export function buildBomLoaderScopeStyles(scopeSelector: string): string {
  return `
${scopeSelector} .plm-extension-bom-clone-content.is-validation-loading{
  align-items:center;
  justify-content:center;
  gap:8px;
}
${scopeSelector} .plm-extension-generic-loader{
  min-height:120px;
  height:100%;
}
${scopeSelector} .plm-extension-generic-loader.plm-extension-generic-loader--compact{
  min-height:0;
  width:100%;
  height:100%;
  padding:0;
}
${scopeSelector} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body.is-loading{
  display:flex;
  align-items:center;
  justify-content:center;
  padding:0;
  overflow:hidden;
}
${scopeSelector} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body.is-loading .plm-extension-generic-loader{
  min-height:0;
  width:100%;
  height:100%;
  margin:0;
  padding:0 12px;
  transform:translateY(-24px);
}
${scopeSelector} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body.is-loading .plm-extension-generic-loader__label{
  margin-top:4px;
  text-align:center;
}
${scopeSelector} .plm-extension-bom-linkable-dialog-loading .plm-extension-generic-loader{
  min-height:0;
  width:auto;
  height:auto;
  padding:0;
}
${scopeSelector} .plm-extension-bom-linkable-empty .plm-extension-generic-loader{
  min-height:220px;
  display:flex;
  align-items:center;
  justify-content:center;
}
${scopeSelector} .plm-extension-bom-attachment-download-preview .plm-extension-generic-loader,
${scopeSelector} .plm-extension-bom-attachment-download-empty .plm-extension-generic-loader{
  min-height:220px;
  width:100%;
  height:100%;
}
`
}
