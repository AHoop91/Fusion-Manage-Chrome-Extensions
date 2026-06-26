export function buildCloneButtonStyles(cloneButtonId: string): string {
  return `
#${cloneButtonId} {
  margin-left: 2px;
  min-width: 145px !important;
  min-height: 34px !important;
  width: 145px !important;
  max-width: 145px !important;
  flex: 0 0 auto !important;
  padding-left: 9px !important;
  padding-right: 8px !important;
}
#${cloneButtonId} .label {
  padding: 0 3px;
}
#${cloneButtonId}.plm-extension-bom-clone-dropdown-trigger{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:1px;
  min-width:145px !important;
  min-height:34px !important;
  width:145px !important;
  max-width:145px !important;
}
#${cloneButtonId} .plm-extension-bom-clone-dropdown-chevron{
  font-size:16px;
  line-height:1;
  margin-right:0;
}
.plm-extension-bom-clone-dropdown{
  --plm-bom-font-sans:"ArtifaktElement","Segoe UI",Arial,sans-serif;
  position:relative;
  display:inline-flex;
  align-items:center;
}
.plm-extension-bom-clone-dropdown.is-open #${cloneButtonId}{
  border-bottom-left-radius:0;
  border-bottom-right-radius:0;
}
.plm-extension-bom-clone-dropdown-menu{
  position:absolute;
  top:calc(100% + 2px);
  right:0;
  min-width:max-content;
  width:max-content;
  max-width:min(320px, calc(100vw - 24px));
  display:none;
  flex-direction:column;
  background:#fff;
  border:1px solid #cfd9e6;
  border-radius:4px;
  box-shadow:0 8px 20px rgba(16, 24, 36, .2);
  z-index:140;
  padding:4px 0;
}
.plm-extension-bom-clone-dropdown.is-open .plm-extension-bom-clone-dropdown-menu{
  display:flex;
}
.plm-extension-bom-clone-dropdown-item{
  border:0;
  background:transparent;
  text-align:left;
  padding:8px 12px;
  font:600 13px/1.2 var(--plm-bom-font-sans);
  color:#203a56;
  cursor:pointer;
  white-space:nowrap;
}
.plm-extension-bom-clone-dropdown-item:hover,
.plm-extension-bom-clone-dropdown-item:focus-visible{
  background:#eef6ff;
  outline:none;
}
`
}
