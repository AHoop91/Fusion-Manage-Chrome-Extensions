import { ensureStyleTag } from '../../../shared/dom/styles'

export const GENERIC_LOADER_STYLE_ID = 'plm-extension-generic-loader-style'

const GENERIC_LOADER_CSS = `
.plm-extension-generic-loader{
  min-height:120px;
  height:100%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:8px;
  text-align:center;
}
.plm-extension-generic-loader--compact{
  min-height:0;
  width:100%;
  height:auto;
}
.plm-extension-generic-loader--inline{
  min-height:0;
  height:auto;
  display:inline-flex;
  flex-direction:row;
  gap:8px;
  padding:0;
  text-align:left;
}
.plm-extension-generic-loader__dots{
  width:72px;
  text-align:center;
  line-height:1;
  flex:0 0 auto;
}
.plm-extension-generic-loader--inline .plm-extension-generic-loader__dots{
  width:auto;
  min-width:44px;
}
.plm-extension-generic-loader__dot{
  display:inline-block;
  width:16px;
  height:16px;
  margin:0 3px;
  background:#149cd8;
  border-radius:100%;
  animation:plm-extension-generic-loader-bounce 1.4s infinite ease-in-out both;
}
.plm-extension-generic-loader--inline .plm-extension-generic-loader__dot{
  width:8px;
  height:8px;
  margin:0 2px;
}
.plm-extension-generic-loader__dot:nth-child(1){
  animation-delay:-0.32s;
}
.plm-extension-generic-loader__dot:nth-child(2){
  animation-delay:-0.16s;
}
.plm-extension-generic-loader__label{
  color:#4b637a;
  font:600 12px/1.25 var(--plm-extension-loader-font, "ArtifaktElement","Segoe UI",Arial,sans-serif);
}
@keyframes plm-extension-generic-loader-bounce{
  0%,80%,100%{transform:scale(0);}
  40%{transform:scale(1);}
}
`

export function ensureGenericLoaderStyles(): void {
  if (typeof document === 'undefined') return
  ensureStyleTag(GENERIC_LOADER_STYLE_ID, GENERIC_LOADER_CSS)
}
