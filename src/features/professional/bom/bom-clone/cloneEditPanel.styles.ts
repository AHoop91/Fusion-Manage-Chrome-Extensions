/**
 * BOM clone edit-panel layout overrides (grid-form fields).
 * Loaded when the edit panel opens.
 */
export function buildCloneEditPanelStyles(structureModalId: string): string {
  return `
#${structureModalId} .plm-extension-bom-clone-edit-panel{
  display:flex;
  flex-direction:column;
  border:1px solid #d6dce5;
  border-radius:8px;
  overflow:hidden;
  background:#fff;
  min-height:0;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create{
  background:#fdfefe;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-main{
  flex:0 0 auto;
  min-height:auto;
  overflow:visible;
  padding:12px 22px 14px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-main{
  padding:0;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-fields-header{
  padding:10px 20px 8px;
  border-bottom:1px solid #d7e3ef;
  background:#f7f9fc;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-fields-header{
  padding:8px 10px;
  border-bottom:1px solid #dde6f0;
  background:#f3f6fa;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-fields-controls{
  padding:8px 20px 6px;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:14px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-header-actions{
  display:inline-flex;
  align-items:center;
  gap:8px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-dirty-indicator{
  display:none;
  color:#9a6400;
  font:600 12px/1.1 var(--plm-bom-font-sans);
  margin-right:2px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-dirty-indicator.is-visible{
  display:inline-block;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-details-cancel,
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-details-save{
  min-height:30px;
  padding:0 12px;
  font:600 12px/1 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-details-save:disabled{
  opacity:.5;
  cursor:not-allowed;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-fields-controls{
  padding:8px 10px;
  border-bottom:1px solid #e7edf4;
  background:#fff;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-filter{
  display:inline-flex;
  align-items:center;
  gap:6px;
  color:#3e556d;
  font:600 12px/1.1 var(--plm-bom-font-sans);
  cursor:pointer;
  user-select:none;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-filter input[type="checkbox"]{
  width:14px;
  height:14px;
  margin:0;
  accent-color:#149cd8;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-operation-temp-name-note{
  margin:0 10px 6px;
  color:#c62828;
  font:600 11.5px/1.35 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-operation-temp-name-validation{
  display:none;
  margin:0 10px 6px;
  color:#c62828;
  font:600 11.5px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-operation-temp-name-validation.is-visible{
  display:block;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-filters-divider{
  margin:0 20px 8px;
  border-top:1px solid #e4e9f0;
  padding-top:4px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-bom-clone-edit-filters-divider{
  display:none;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-details-body{
  display:flex;
  flex-direction:column;
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  overflow-x:hidden;
  scrollbar-gutter:stable;
  padding:0;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-table-head{
  display:grid;
  grid-template-columns:34% 66%;
  align-items:stretch;
  border-bottom:1px solid #e7edf4;
  background:#f7faff;
  color:#334f6b;
  font:700 11.5px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-table-head > span{
  padding:7px 10px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-bom-clone-edit-table-head > span:first-child{
  border-right:1px solid #e7edf4;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-row{
  min-width:0;
  padding-right:0;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-row{
  display:grid;
  grid-template-columns:34% 66%;
  border-bottom:1px solid #e7edf4;
  min-width:0;
  padding-right:0;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-label{
  min-width:0;
  padding:7px 10px;
  border-right:1px solid #e7edf4;
  justify-content:center;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-value{
  min-width:0;
  padding:7px 14px 7px 10px;
  overflow:visible;
  position:relative;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-label-main{
  min-height:auto;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-label,
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-label-main{
  min-width:0;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-label-text{
  display:block;
  white-space:normal;
  overflow-wrap:anywhere;
  word-break:break-word;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel #plm-bom-clone-edit-fields-root{
  padding:2px 18px 8px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create #plm-bom-clone-edit-fields-root{
  padding:0;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-value > .plm-extension-grid-form-control:not(.plm-extension-grid-form-control--checkbox),
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-value > .plm-extension-grid-form-control-wrap,
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-value > .plm-extension-grid-form-lookup-wrap,
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-value > .plm-extension-grid-form-radio-dropdown{
  width:100%;
  max-width:100%;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-value > .plm-extension-grid-form-control:not(.plm-extension-grid-form-control--checkbox),
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-value > .plm-extension-grid-form-control-wrap,
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-value > .plm-extension-grid-form-lookup-wrap,
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-value > .plm-extension-grid-form-radio-dropdown{
  width:calc(100% - 18px);
  max-width:calc(100% - 18px);
}
#${structureModalId} .plm-extension-bom-clone-edit-panel.is-operation-create .plm-extension-grid-form-value > .plm-extension-grid-form-value-clear-wrap{
  width:calc(100% - 18px);
  max-width:calc(100% - 18px);
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-value-clear-wrap.is-date.has-custom-date-picker > .plm-extension-grid-form-control[type="date"]{
  padding-right:84px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-value-clear-wrap.is-date.has-native-date-picker > .plm-extension-grid-form-control[type="date"]{
  padding-right:60px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-value-clear.is-date{
  right:5px;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-date-picker-btn{
  position:absolute;
  top:50%;
  right:33px;
  transform:translateY(-50%);
  min-width:24px;
  width:24px;
  height:24px;
  padding:0;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-date-picker-btn .zmdi{
  font-size:14px;
  line-height:1;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-date-picker-btn:disabled{
  opacity:.45;
  cursor:not-allowed;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-value-clear-wrap.is-date.has-custom-date-picker > .plm-extension-grid-form-control[type="date"]::-webkit-calendar-picker-indicator{
  opacity:0;
  pointer-events:none;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-value-clear-wrap.is-date.has-native-date-picker > .plm-extension-grid-form-control[type="date"]::-webkit-calendar-picker-indicator{
  margin-right:28px;
  cursor:pointer;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-lookup-wrap.is-open{
  z-index:120;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-lookup-menu{
  z-index:130;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-control,
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-control-prefix{
  font:500 13px/1.3 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-control{
  color:#111827;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-control::placeholder{
  color:#6b7280;
  opacity:1;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-control-prefix{
  color:#6b7280;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-control--formula{
  min-height:0;
  height:auto;
  margin:0;
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
  box-shadow:none;
  min-inline-size:0;
  color:#1f2937;
  font:500 13px/1.35 var(--plm-bom-font-sans);
  white-space:normal;
  overflow-wrap:anywhere;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-control--formula > :first-child{
  margin-top:0;
}
#${structureModalId} .plm-extension-bom-clone-edit-panel .plm-extension-grid-form-control--formula > :last-child{
  margin-bottom:0;
}
`
}
