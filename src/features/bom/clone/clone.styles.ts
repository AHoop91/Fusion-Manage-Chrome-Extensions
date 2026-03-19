import { buildAttachmentDownloadStyles } from '../downloader/styles'

/**
 * Builds BOM clone feature styles scoped by runtime modal/button ids.
 */
export function buildCloneStyles(cloneButtonId: string, structureModalId: string, attachmentModalId: string): string {
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
#${structureModalId} .plm-extension-bom-clone-content.is-validation-loading{
  align-items:center;
  justify-content:center;
  gap:8px;
}
#${structureModalId}{
  --plm-bom-font-sans:"ArtifaktElement","Segoe UI",Arial,sans-serif;
  --plm-bom-font-symbol:"Segoe UI Symbol","Segoe UI",Arial,sans-serif;
}
#${structureModalId} .plm-extension-bom-structure-content{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  gap:14px;
  min-height:0;
  flex:1 1 auto;
}
#${structureModalId} .plm-extension-bom-structure-content:has(.plm-extension-bom-clone-edit-panel){
  grid-template-columns:minmax(0,1fr) minmax(0,1fr) 320px;
}
#${structureModalId} .plm-extension-bom-structure-content.is-editing{
  grid-template-columns:minmax(0,1fr) clamp(500px, 38vw, 620px);
}
#${structureModalId} .plm-extension-bom-clone-loading-center{
  min-height:120px;
  height:100%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:8px;
}
#${structureModalId} .plm-extension-bom-clone-loading-center--compact{
  min-height:0;
  width:100%;
  height:100%;
  padding:0;
}
#${structureModalId} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body.is-loading{
  display:flex;
  align-items:center;
  justify-content:center;
  padding:0;
  overflow:hidden;
}
#${structureModalId} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body.is-loading .plm-extension-bom-clone-loading-center{
  min-height:0;
  width:100%;
  height:100%;
  margin:0;
  padding:0 12px;
  transform:translateY(-24px);
}
#${structureModalId} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body.is-loading .plm-extension-bom-clone-loading-text{
  margin-top:4px;
  text-align:center;
}
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
#${structureModalId} .plm-extension-bom-clone-content{
  position:relative;
}
#${structureModalId} .plm-extension-bom-structure-pane{
  border:1px solid #d6dce5;
  border-radius:8px;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  min-height:0;
  background:#fdfefe;
}
#${structureModalId} .plm-extension-bom-structure-pane-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:8px 10px;
  border-bottom:1px solid #dde6f0;
  background:#f3f6fa;
  font:700 12px/1.2 var(--plm-bom-font-sans);
  color:#223d58;
}
#${structureModalId} .plm-extension-bom-structure-pane-actions{
  display:inline-flex;
  align-items:center;
  gap:6px;
}
#${structureModalId} .plm-extension-bom-structure-pane-action-group{
  display:inline-flex;
  align-items:center;
  gap:0;
}
#${structureModalId} .plm-extension-bom-structure-pane-action-btn{
  min-height:34px;
  padding:0 14px;
  display:inline-flex;
  align-items:center;
  gap:6px;
  font:600 13px/1.1 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-structure-pane-action-btn.is-active{
  color:#9f1d1d;
  border-color:#d9a5a5;
  background:#fff1f1;
}
#${structureModalId} .plm-extension-bom-structure-pane-action-btn:disabled{
  opacity:.5;
  cursor:not-allowed;
}
#${structureModalId} .plm-extension-bom-structure-pane-action-btn.is-icon{
  width:34px;
  min-width:34px;
  height:34px;
  padding:0;
  justify-content:center;
  gap:0;
}
#${structureModalId} .plm-extension-bom-structure-pane-action-group .plm-extension-bom-structure-pane-action-btn.is-icon{
  border-radius:0;
}
#${structureModalId} .plm-extension-bom-structure-pane-action-group .plm-extension-bom-structure-pane-action-btn.is-icon:first-child{
  border-top-left-radius:4px;
  border-bottom-left-radius:4px;
}
#${structureModalId} .plm-extension-bom-structure-pane-action-group .plm-extension-bom-structure-pane-action-btn.is-icon:last-child{
  border-top-right-radius:4px;
  border-bottom-right-radius:4px;
}
#${structureModalId} .plm-extension-bom-structure-pane-action-group .plm-extension-bom-structure-pane-action-btn.is-icon + .plm-extension-bom-structure-pane-action-btn.is-icon{
  margin-left:-1px;
}
#${structureModalId} .plm-extension-bom-structure-pane-action-btn .zmdi{
  font-size:19px;
}
#${structureModalId} .plm-extension-bom-linkable-overlay{
  position:fixed;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
  background:rgba(16, 24, 36, .45);
  z-index:2147483646;
}
#${structureModalId} .plm-extension-bom-linkable-dialog{
  width:min(1020px, 92vw);
  max-height:min(80vh, 720px);
  background:#fff;
  border:1px solid #cfd9e6;
  border-radius:10px;
  box-shadow:0 20px 60px rgba(0,0,0,.24);
  display:flex;
  flex-direction:column;
  overflow:hidden;
}
#${structureModalId} .plm-extension-bom-linkable-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:10px 12px;
  border-bottom:1px solid #dbe4ef;
  background:#f4f7fb;
  position:sticky;
  top:0;
  z-index:6;
}
#${structureModalId} .plm-extension-bom-linkable-header h4{
  margin:0;
  font:700 16px/1.2 var(--plm-bom-font-sans);
  color:#1e3147;
}
#${structureModalId} .plm-extension-bom-linkable-close{
  border-radius:4px;
  min-width:28px;
  width:28px;
  height:28px;
  padding:0;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
#${structureModalId} .plm-extension-bom-linkable-dialog-loading{
  flex:1 1 auto;
  min-height:220px;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px 16px 28px;
  background:#fff;
}
#${structureModalId} .plm-extension-bom-linkable-dialog-loading .plm-extension-bom-clone-loading-center{
  min-height:0;
  width:auto;
  height:auto;
  padding:0;
}
#${structureModalId} .plm-extension-bom-linkable-search{
  padding:10px 12px;
  display:flex;
  flex-direction:column;
  gap:6px;
  border-bottom:1px solid #e3eaf3;
  position:sticky;
  top:49px;
  background:#fff;
  z-index:5;
}
#${structureModalId} .plm-extension-bom-linkable-selected-tools{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
}
#${structureModalId} .plm-extension-bom-linkable-selected-actions{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}
#${structureModalId} .plm-extension-bom-linkable-action-btn{
  min-height:34px;
  padding:0 14px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font:600 13px/1.1 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-linkable-action-btn:disabled{
  opacity:.6;
}
#${structureModalId} .plm-extension-bom-linkable-search-title{
  color:#304960;
  font:700 12px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-linkable-search input{
  flex:1 1 auto;
  min-width:0;
  height:34px;
  border:1px solid #b8c7d8;
  border-radius:4px;
  padding:0 10px;
  font:400 14px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-linkable-table-wrap{
  flex:1 1 auto;
  min-height:236px;
  overflow-y:auto;
  overflow-x:auto;
  position:relative;
}
#${structureModalId} .plm-extension-bom-linkable-table{
  min-width:100%;
  table-layout:fixed;
}
#${structureModalId} .plm-extension-bom-linkable-table th,
#${structureModalId} .plm-extension-bom-linkable-table td{
  border-bottom:1px solid #e6edf5;
  padding:9px 10px;
  font:400 14px/1.25 var(--plm-bom-font-sans);
  color:#2d435a;
  text-align:left;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
#${structureModalId} .plm-extension-bom-linkable-table th:nth-child(2),
#${structureModalId} .plm-extension-bom-linkable-table td:nth-child(2){
  width:auto;
}
#${structureModalId} .plm-extension-bom-linkable-table th{
  font-weight:700;
  position:sticky;
  top:0;
  background:#f5f8fc;
  z-index:4;
  position:relative;
}
#${structureModalId} .plm-extension-bom-linkable-table td:first-child:not(.plm-extension-bom-linkable-empty){
  display:flex;
  align-items:center;
  gap:6px;
}
#${structureModalId} .plm-extension-bom-linkable-table td input[type="checkbox"]{
  width:18px;
  height:18px;
  flex-shrink:0;
  cursor:pointer;
}
#${structureModalId} .plm-extension-bom-linkable-col-resizer{
  position:absolute;
  top:0;
  right:-2px;
  width:6px;
  height:100%;
  cursor:col-resize;
  z-index:2;
}
#${structureModalId} .plm-extension-bom-linkable-col-resizer::after{
  content:'';
  position:absolute;
  top:20%;
  left:2px;
  width:1px;
  height:60%;
  background:#b5c5d6;
}
#${structureModalId} .plm-extension-bom-linkable-table tr.is-selected{
  background:#e9f4ff;
}
#${structureModalId} .plm-extension-bom-linkable-table tr.is-on-target-bom{
  opacity:.45;
  cursor:default;
  pointer-events:none;
}
#${structureModalId} .plm-extension-bom-linkable-duplicate-warn{
  display:inline-block;
  color:#d38617;
  font-size:18px;
  flex-shrink:0;
  cursor:default;
  line-height:1;
}
#${structureModalId} .plm-extension-bom-linkable-row-error{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:16px;
  height:16px;
  border-radius:999px;
  background:#d64545;
  color:#ffffff;
  font:700 11px/1 var(--plm-bom-font-sans);
  flex-shrink:0;
  cursor:help;
}
#${structureModalId} .plm-extension-bom-linkable-empty{
  color:#5c738d;
  text-align:center;
  height:280px;
  vertical-align:middle;
}
#${structureModalId} .plm-extension-bom-linkable-footer{
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:0;
  padding:0;
  border-top:none;
  background:#f5f8fc;
  color:#4a6480;
  font:500 12px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-linkable-footer-bar{
  width:100%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  background:#f5f8fc;
  border-top:1px solid #d6e0ec;
  border-radius:0;
  padding:10px 12px;
  box-sizing:border-box;
}
#${structureModalId} .plm-extension-bom-linkable-footer-count{
  color:#2d435a;
  font:700 14px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-linkable-footer-selected{
  color:#2d435a;
  font:700 14px/1.2 var(--plm-bom-font-sans);
  white-space:nowrap;
}
#${structureModalId} .plm-extension-bom-linkable-actions{
  display:flex;
  justify-content:flex-end;
  gap:8px;
  padding:10px 12px 12px 12px;
  background:#fff;
}
#${structureModalId} .plm-extension-bom-linkable-progress-wrap{
  padding:8px 12px 0 12px;
  background:#fff;
}
#${structureModalId} .plm-extension-bom-linkable-progress-text{
  color:#2d435a;
  font:600 12px/1.2 var(--plm-bom-font-sans);
  margin:0 0 6px 0;
}
#${structureModalId} .plm-extension-bom-linkable-progress-track{
  width:100%;
  height:8px;
  border-radius:999px;
  background:#dce7f2;
  overflow:hidden;
}
#${structureModalId} .plm-extension-bom-linkable-progress-fill{
  height:100%;
  background:linear-gradient(90deg, #149cd8 0%, #0f8ac0 100%);
  transition:width .2s ease;
}
#${structureModalId} .plm-extension-bom-linkable-actions button,
#${structureModalId} .plm-extension-bom-linkable-footer button,
#${structureModalId} .plm-extension-bom-linkable-search button{
  font-family:var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-linkable-empty .plm-extension-bom-clone-loading-center{
  min-height:220px;
  display:flex;
  align-items:center;
  justify-content:center;
}
#${structureModalId} .plm-extension-bom-structure-pane-body{
  flex:1 1 auto;
  overflow-y:auto;
  overflow-x:hidden;
  min-height:0;
  min-width:0;
  box-sizing:border-box;
  padding-bottom:10px;
}
#${structureModalId} .plm-extension-bom-structure-source-footer{
  display:flex;
  align-items:center;
  gap:10px;
  border-top:1px solid #d7e1ec;
  background:#f6f9fc;
  padding:8px 10px;
}
#${structureModalId} .plm-extension-bom-structure-source-progress{
  flex:1 1 auto;
  min-width:120px;
  height:14px;
  border:1px solid #c8d5e3;
  border-radius:2px;
  overflow:hidden;
  display:flex;
  align-items:stretch;
  background:#edf3f9;
}
#${structureModalId} .plm-extension-bom-structure-source-progress-segment{
  border:none;
  padding:0;
  margin:0;
  min-width:0;
  cursor:pointer;
  transition:filter .15s ease;
}
#${structureModalId} .plm-extension-bom-structure-source-progress-segment:disabled{
  cursor:default;
  opacity:.45;
}
#${structureModalId} .plm-extension-bom-structure-source-progress-segment:hover:not(:disabled){
  filter:brightness(1.14) saturate(1.05);
  box-shadow:inset 0 0 0 2px rgba(15,34,54,0.24);
}
#${structureModalId} .plm-extension-bom-structure-source-progress-segment.is-active{
  box-shadow:inset 0 0 0 2px rgba(15,34,54,0.28);
}
#${structureModalId} .plm-extension-bom-structure-source-progress-segment.is-not-added{
  background:#d14747;
}
#${structureModalId} .plm-extension-bom-structure-source-progress-segment.is-modified{
  background:#d38617;
}
#${structureModalId} .plm-extension-bom-structure-source-progress-segment.is-added{
  background:#3f9b4f;
}
#${structureModalId} .plm-extension-bom-structure-chevron,
#${structureModalId} .plm-extension-bom-structure-chevron-spacer{
  width:20px;
  min-width:20px;
  height:20px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
#${structureModalId} .plm-extension-bom-structure-chevron{
  border:none;
  background:transparent;
  color:#1d334b;
  cursor:pointer;
  padding:0;
}
#${structureModalId} .plm-extension-bom-structure-chevron.is-placeholder{
  color:#5a6f84;
  cursor:default;
  opacity:.9;
}
#${structureModalId} .plm-extension-bom-structure-chevron.is-loading{
  cursor:wait;
  opacity:.9;
}
#${structureModalId} .plm-extension-bom-structure-chevron .zmdi{
  font-size:20px;
  line-height:1;
}
#${structureModalId} .plm-extension-bom-structure-drag-handle{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:24px;
  min-width:24px;
  height:24px;
  border-radius:6px;
  color:#5b7086;
  cursor:grab;
  user-select:none;
  -webkit-user-select:none;
  touch-action:none;
}
#${structureModalId} .plm-extension-bom-structure-drag-handle .zmdi{
  font-size:18px;
  line-height:1;
}
#${structureModalId} .plm-extension-bom-structure-drag-handle:hover{
  background:#eef3f8;
  color:#1f3349;
}
#${structureModalId} .plm-extension-bom-structure-drag-handle:active{
  cursor:grabbing;
}
#${structureModalId} .plm-extension-bom-structure-number{
  display:flex;
  align-items:center;
  gap:4px;
  min-height:32px;
}
#${structureModalId} .plm-extension-bom-structure-row-manufacturing .plm-extension-bom-structure-number:not(.is-process-selector-row){
  display:grid;
  grid-template-columns:
    var(--plm-bom-structure-selector-col-width, 34px)
    var(--plm-bom-structure-selector-col-width, 34px)
    24px
    auto;
  align-items:center;
  column-gap:0;
}
#${structureModalId} .plm-extension-bom-structure-row-manufacturing .plm-extension-bom-structure-number:not(.is-process-selector-row) > .plm-extension-bom-structure-chevron,
#${structureModalId} .plm-extension-bom-structure-row-manufacturing .plm-extension-bom-structure-number:not(.is-process-selector-row) > .plm-extension-bom-structure-chevron-spacer{
  width:var(--plm-bom-structure-selector-col-width, 34px);
  min-width:var(--plm-bom-structure-selector-col-width, 34px);
  height:32px;
  justify-content:center;
  align-items:center;
}
#${structureModalId} .plm-extension-bom-structure-row-manufacturing .plm-extension-bom-structure-number:not(.is-process-selector-row) > .plm-extension-bom-structure-number-value{
  margin-left:0;
}
#${structureModalId} .plm-extension-bom-structure-number.is-process-selector-row{
  display:grid;
  grid-template-columns:
    var(--plm-bom-structure-selector-col-width, 34px)
    var(--plm-bom-structure-selector-col-width, 34px)
    24px
    auto;
  align-items:center;
  column-gap:0;
}
#${structureModalId} .plm-extension-bom-structure-number.is-process-selector-row .plm-extension-bom-structure-number-value{
  margin-left:6px;
  margin-right:0;
}
#${structureModalId} .plm-extension-bom-structure-operation-radio{
  width:17px;
  height:17px;
  margin:0;
  cursor:pointer;
  accent-color:#111827;
}
#${structureModalId} .plm-extension-bom-structure-root-radio{
  margin:0;
  width:17px;
  height:17px;
  accent-color:#111827;
}
#${structureModalId} .plm-extension-bom-structure-edit-input{
  width:100%;
  min-height:24px;
  padding:2px 6px;
  border:1px solid #b8c7d8;
  border-radius:4px;
  background:#fff;
  color:#2a3e56;
  font:600 13px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-structure-edit-input.is-qty-modified{
  color:#c96b00;
  border-color:#e0ad66;
}
#${structureModalId} .plm-extension-bom-structure-table td.is-qty-modified{
  color:#c96b00;
  font-weight:700;
}
#${structureModalId} .plm-extension-bom-structure-edit-input:focus{
  outline:none;
  border-color:#4f93d0;
  box-shadow:0 0 0 2px rgba(79,147,208,.15);
}
#${structureModalId} .plm-extension-bom-structure-drop-zone{
  min-height:100%;
}
#${structureModalId} .plm-extension-bom-structure-target-draggable{
  cursor:default;
  transition:none;
}
#${structureModalId} .plm-extension-bom-structure-target-draggable.is-dragging{
  opacity:.85;
}
#${structureModalId} .plm-extension-bom-structure-target-draggable.is-dragging .plm-extension-bom-structure-drag-handle{
  cursor:grabbing;
}
#${structureModalId} .plm-extension-bom-structure-target-drop-row.is-over-before{
  box-shadow: inset 0 3px 0 #6f7b87;
  background:#f8f9fa;
}
#${structureModalId} .plm-extension-bom-structure-target-drop-row.is-over-after{
  box-shadow: inset 0 -3px 0 #6f7b87;
  background:#f8f9fa;
}
#${structureModalId} .plm-extension-bom-structure-target-drop-row.is-over-inside{
  box-shadow: inset 0 0 0 2px #6f7b87;
  background:#f8f9fa;
}
#${structureModalId} .plm-extension-bom-structure-target-drop-row.is-dropped{
  animation:plm-extension-bom-structure-row-drop .18s ease-out;
}
#${structureModalId} .plm-extension-bom-structure-drop-zone.is-over{
  background:#f4f6f8;
}
#${structureModalId} .plm-extension-bom-structure-pane-target .plm-extension-bom-structure-drop-zone.is-over{
  background:#f1f1f1;
}
#${structureModalId} .plm-extension-bom-structure-pane-target .plm-extension-bom-structure-drop-zone.is-over-top{
  box-shadow: inset 0 4px 0 #6f7b87;
}
#${structureModalId} .plm-extension-bom-structure-pane-target .plm-extension-bom-structure-drop-zone.is-over-bottom{
  box-shadow: inset 0 -4px 0 #6f7b87;
}
#${structureModalId} .plm-extension-bom-structure-summary{
  display:flex;
  align-items:center;
  gap:10px;
  margin-top:8px;
  color:#2d435a;
  font:700 12px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-structure-summary-pills{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:8px;
}
#${structureModalId} .plm-extension-bom-structure-summary-pill{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:24px;
  padding:0 10px;
  border-radius:0;
  border:1px solid transparent;
  font:700 12px/1 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-structure-summary-pill.is-delete{
  background:#fce8e8;
  border-color:#f3b5b5;
  color:#a63030;
}
#${structureModalId} .plm-extension-bom-structure-summary-pill.is-update{
  background:#fff4dc;
  border-color:#f3d38d;
  color:#8a621a;
}
#${structureModalId} .plm-extension-bom-structure-summary-pill.is-new{
  background:#e6f5ea;
  border-color:#b8dfc3;
  color:#1f6f3a;
}
#${structureModalId} .plm-extension-bom-structure-summary-pill.is-add{
  background:#e7f2ff;
  border-color:#b9d8ff;
  color:#2b64a8;
}
#${structureModalId} .plm-extension-bom-clone-footer{
  display:flex;
  align-items:center;
  gap:12px;
  margin-top:12px;
  flex:0 0 auto;
}
#${structureModalId} .plm-extension-bom-clone-footer--with-summary{
  justify-content:flex-start;
}
#${structureModalId} .plm-extension-bom-clone-footer-actions{
  margin-left:auto;
  display:inline-flex;
  align-items:center;
  justify-content:flex-end;
  gap:8px;
  flex:0 0 auto;
}
#${structureModalId} .plm-extension-bom-clone-footer--with-summary .plm-extension-bom-structure-summary{
  margin-top:0;
  margin-right:0;
  flex:1 1 auto;
  min-width:0;
}
#${structureModalId} .plm-extension-bom-commit-overlay{
  position:fixed;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  background:rgba(17, 24, 39, .28);
  padding:24px;
  z-index:2147483645;
}
#${structureModalId} .plm-extension-bom-commit-panel{
  width:min(520px, 90vw);
  background:#fff;
  border:1px solid #d5dde7;
  border-radius:8px;
  box-shadow:0 18px 48px rgba(0,0,0,.22);
  padding:14px 14px 12px 14px;
}
#${structureModalId} .plm-extension-bom-commit-title{
  margin:0;
  color:#243a52;
  font:700 15px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-commit-message{
  margin:6px 0 10px 0;
  color:#4d647d;
  font:600 12px/1.2 var(--plm-bom-font-sans);
}
#${structureModalId} .plm-extension-bom-commit-operations-title{
  margin:2px 0 6px 0;
  color:#2f435a;
  font:700 12px/1.1 var(--plm-bom-font-sans);
  text-transform:uppercase;
}
#${structureModalId} .plm-extension-bom-commit-rows{
  margin-top:4px;
  display:flex;
  flex-direction:column;
  gap:8px;
}
#${structureModalId} .plm-extension-bom-commit-row{
  display:grid;
  grid-template-columns:72px 1fr auto;
  gap:10px;
  align-items:center;
}
#${structureModalId} .plm-extension-bom-commit-row-label{
  color:#2f435a;
  font:700 12px/1 var(--plm-bom-font-sans);
  text-transform:uppercase;
}
#${structureModalId} .plm-extension-bom-commit-row-track{
  display:block;
  height:14px;
  border-radius:999px;
  background:#edf2f7;
  overflow:hidden;
}
#${structureModalId} .plm-extension-bom-commit-row-fill{
  display:block;
  height:100%;
  width:0;
  transition:width .2s ease;
}
#${structureModalId} .plm-extension-bom-commit-row.is-delete .plm-extension-bom-commit-row-fill{
  background:#d14747;
}
#${structureModalId} .plm-extension-bom-commit-row.is-update .plm-extension-bom-commit-row-fill{
  background:#d38617;
}
#${structureModalId} .plm-extension-bom-commit-row.is-new .plm-extension-bom-commit-row-fill{
  background:#3f9b4f;
}
#${structureModalId} .plm-extension-bom-commit-row.is-add .plm-extension-bom-commit-row-fill{
  background:#6fb5ff;
}
#${structureModalId} .plm-extension-bom-commit-row-value{
  color:#49627a;
  font:700 11px/1 var(--plm-bom-font-sans);
  min-width:18px;
  text-align:right;
}
#${structureModalId} .plm-extension-bom-structure-table{
  width:100%;
  min-width:100%;
  table-layout:fixed;
  border-collapse:collapse;
  border-spacing:0;
}
#${structureModalId} .plm-extension-bom-structure-table th,
#${structureModalId} .plm-extension-bom-structure-table td{
  text-align:left;
  padding:0 6px;
  height:32px;
  line-height:1.2;
  vertical-align:middle;
  border-bottom:1px solid #e7edf4;
  font-size:14px;
  font-weight:400;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
#${structureModalId} .plm-extension-bom-structure-table th{
  font-weight:700;
  color:#2d435a;
  background:#f5f8fc;
}
#${structureModalId} .plm-extension-bom-structure-source-tr{
  cursor:grab;
  user-select:none;
}
#${structureModalId} .plm-extension-bom-structure-source-tr:hover{
  background:#eef6ff;
}
#${structureModalId} .plm-extension-bom-structure-table col.plm-extension-bom-structure-col-number{
  width:var(--plm-bom-structure-number-col-width, 82px);
}
#${structureModalId} .plm-extension-bom-structure-table col.plm-extension-bom-structure-col-qty{
  width:var(--plm-bom-structure-qty-col-width, 66px);
}
#${structureModalId} .plm-extension-bom-structure-table col.plm-extension-bom-structure-col-actions{
  width:var(--plm-bom-structure-action-col-width, 120px);
}
#${structureModalId} .plm-extension-bom-structure-number-descriptor-merged-cell{
  padding-left:6px;
  padding-right:6px;
  min-width:0;
}
#${structureModalId} .plm-extension-bom-structure-number-descriptor-merged-wrap{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
  width:100%;
}
#${structureModalId} .plm-extension-bom-structure-number-descriptor-merged-wrap .plm-extension-bom-structure-number{
  flex:0 0 auto;
}
#${structureModalId} .plm-extension-bom-structure-number-descriptor-merged-wrap .plm-extension-bom-structure-descriptor-scroll{
  flex:1 1 auto;
  min-width:0;
}
#${structureModalId} .plm-extension-bom-structure-descriptor-scroll{
  display:block;
  width:100%;
  max-width:100%;
  overflow:hidden;
  white-space:nowrap;
  text-overflow:ellipsis;
}
#${structureModalId} .plm-extension-bom-structure-descriptor-scroll.is-draggable,
#${structureModalId} .plm-extension-bom-structure-number-value.is-draggable{
  cursor:grab;
  user-select:none;
  -webkit-user-select:none;
}
#${structureModalId} .plm-extension-bom-structure-descriptor-scroll.is-draggable:active,
#${structureModalId} .plm-extension-bom-structure-number-value.is-draggable:active{
  cursor:grabbing;
}
#${structureModalId} .plm-extension-bom-structure-qty-cell{
  justify-content:flex-end;
  text-align:right;
  padding-left:4px;
  padding-right:0;
}
#${structureModalId} .plm-extension-bom-structure-root-row > td.plm-extension-bom-structure-root-merged-cell{
  width:auto !important;
  min-width:0 !important;
  max-width:none !important;
  position:static !important;
  background:transparent;
  border-bottom:1px solid #e7edf4;
  padding:0 8px 0 6px;
}
#${structureModalId} .plm-extension-bom-structure-root-wrap{
  display:flex;
  align-items:center;
  gap:8px;
  min-height:32px;
}
#${structureModalId} .plm-extension-bom-structure-root-prefix-box,
#${structureModalId} .plm-extension-bom-structure-operation-radio-box,
#${structureModalId} .plm-extension-bom-structure-part-icon-box,
#${structureModalId} .plm-extension-bom-structure-assembly-icon-box,
#${structureModalId} .plm-extension-bom-structure-root-icon-box{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:var(--plm-bom-structure-selector-col-width, 34px);
  min-width:var(--plm-bom-structure-selector-col-width, 34px);
  height:32px;
  border:1px solid #c8d4e2;
  border-radius:0;
  background:#eef2f6;
}
#${structureModalId} .plm-extension-bom-structure-root-prefix-box{
  border-right:3px solid #149cd8;
}
#${structureModalId} .plm-extension-bom-structure-root-prefix-host{
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
#${structureModalId} .plm-extension-bom-structure-operation-radio-box{
  border-right:3px solid #149cd8;
}
#${structureModalId} .plm-extension-bom-structure-part-icon-box{
  border-right:3px solid #111827;
  color:#5b6e83;
}
#${structureModalId} .plm-extension-bom-structure-assembly-icon-box{
  border-right:3px solid #2d79c7;
  color:#2d79c7;
}
#${structureModalId} .plm-extension-bom-structure-part-glyph{
  display:block;
  width:20px;
  height:20px;
  color:#111827;
}
#${structureModalId} .plm-extension-bom-structure-part-glyph.is-assembly-badge{
  width:18px;
  height:18px;
  color:#2d79c7;
}
#${structureModalId} .plm-extension-bom-structure-number.is-process-selector-row > .plm-extension-bom-structure-chevron,
#${structureModalId} .plm-extension-bom-structure-number.is-process-selector-row > .plm-extension-bom-structure-chevron-spacer{
  width:var(--plm-bom-structure-selector-col-width, 34px);
  min-width:var(--plm-bom-structure-selector-col-width, 34px);
  height:32px;
  justify-content:center;
  align-items:center;
}
#${structureModalId} tr.plm-extension-bom-structure-process-selector-row
  .plm-extension-bom-structure-number > .plm-extension-bom-structure-chevron .zmdi{
  transform:translateX(1px);
}
#${structureModalId} .plm-extension-bom-structure-root-wrap .plm-extension-bom-structure-descriptor-scroll{
  display:flex;
  align-items:center;
  min-height:100%;
}
#${structureModalId} .plm-extension-bom-structure-root-prefix{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:16px;
  min-width:16px;
  color:#5c7085;
  font-size:14px;
}
#${structureModalId} .plm-extension-bom-structure-root-icon-box{
  border-right:3px solid #1f334a;
  color:#101820;
}
#${structureModalId} .plm-extension-bom-structure-root-assembly-icon{
  font-size:18px;
  line-height:1;
  color:#1f334a;
}
#${structureModalId} .plm-extension-bom-structure-qty-input{
  max-width:68px;
  display:block;
  margin-left:auto;
}
#${structureModalId} .plm-extension-bom-structure-number-value{
  font-weight:700;
  display:inline-flex;
  align-items:center;
  min-height:24px;
  padding-left:12px;
}
#${structureModalId} .plm-extension-bom-structure-number-value.is-commit-failed{
  color:#c62828 !important;
  font-weight:800;
}
#${structureModalId} .plm-extension-bom-structure-required-indicator{
  min-height:28px;
  width:28px;
  min-width:28px;
  border:none;
  background:transparent;
  border-radius:0;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size:16px;
  font-weight:700;
  line-height:1;
  font-family:var(--plm-bom-font-symbol);
  margin:0;
}
#${structureModalId} .plm-extension-bom-structure-required-indicator.is-missing{
  color:#c98500;
}
#${structureModalId} .plm-extension-bom-structure-required-indicator.is-complete{
  background:transparent;
  color:#2f9e44;
}
#${structureModalId} .plm-extension-bom-structure-status-rail{
  width:4px;
  min-width:4px;
  height:24px;
  display:inline-block;
  position:static;
  margin:0 2px 0 0;
  border-radius:0;
  background:#d14747;
}
#${structureModalId} .plm-extension-bom-structure-status-rail.is-added{
  background:#3f9b4f;
}
#${structureModalId} .plm-extension-bom-structure-status-rail.is-modified{
  background:#d38617;
}
#${structureModalId} .plm-extension-bom-structure-source-discrepancy{
  min-width:18px;
  width:18px;
  height:18px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  margin-right:2px;
}
#${structureModalId} .plm-extension-bom-structure-source-discrepancy .zmdi{
  font-size:16px;
  line-height:1;
}
#${structureModalId} .plm-extension-bom-structure-source-discrepancy.is-under{
  color:#d38617;
}
#${structureModalId} .plm-extension-bom-structure-source-discrepancy.is-over{
  color:#d14747;
}
#${structureModalId} .plm-extension-bom-structure-empty{
  padding:14px 10px;
  color:#5f7891;
  font-size:12px;
}
#${structureModalId} .plm-extension-bom-structure-action-cell{
  position:sticky;
  right:0;
  vertical-align:middle;
  padding:0 6px;
  background:transparent;
  z-index:2;
}
#${structureModalId} .plm-extension-bom-structure-pane-target .plm-extension-bom-structure-action-cell{
  padding:0 2px 0 0;
}
#${structureModalId} .plm-extension-bom-structure-action-wrap{
  position:relative;
  width:100%;
  min-height:100%;
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:6px;
  padding-left:8px;
  padding-right:2px;
}
#${structureModalId} .plm-extension-bom-structure-pane-target .plm-extension-bom-structure-action-wrap{
  padding-left:0;
  padding-right:0;
}
#${structureModalId} .plm-extension-bom-structure-action-cell .plm-extension-bom-structure-action-btn{
  margin:0;
  align-self:center;
}
#${structureModalId} .plm-extension-bom-structure-action-tooltip-host{
  display:inline-flex;
  align-items:center;
}
#${structureModalId} .plm-extension-bom-structure-action-btn{
  min-height:28px;
  width:28px;
  min-width:28px;
  padding:0;
  border-radius:8px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
#${structureModalId} .plm-extension-bom-structure-action-btn .zmdi{
  font-size:16px;
  line-height:1;
}
#${structureModalId} .plm-extension-bom-structure-action-icon-host{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  line-height:0;
}
#${structureModalId} .plm-extension-bom-structure-list-add-glyph{
  width:20px;
  height:20px;
  display:block;
}
#${structureModalId} .plm-extension-bom-structure-action-btn.is-add .plm-extension-bom-structure-list-add-glyph{
  width:21px;
  height:21px;
}
#${structureModalId} .plm-extension-bom-structure-split-glyph{
  width:20px;
  height:20px;
  display:block;
}
#${structureModalId} .plm-extension-bom-structure-action-btn.is-edit.is-active{
  box-shadow:inset 0 0 0 2px currentColor;
  font-weight:700;
}
#${structureModalId} .plm-extension-bom-structure-action-spacer{
  min-height:28px;
  min-width:28px;
  visibility:hidden;
  display:inline-flex;
}
#${structureModalId} .plm-extension-bom-structure-action-btn:disabled{
  opacity:.55;
}
#${structureModalId} .plm-extension-bom-structure-row-marked-delete td{
  color:#b23a3a !important;
}
#${structureModalId} .plm-extension-bom-structure-row-marked-delete td.plm-extension-bom-structure-number-descriptor-merged-cell,
#${structureModalId} .plm-extension-bom-structure-row-marked-delete td.plm-extension-bom-structure-qty-cell{
  text-decoration:line-through;
}
@keyframes plm-extension-bom-structure-row-drop{
  0%{ transform:translateY(-3px); }
  100%{ transform:translateY(0); }
}
${buildAttachmentDownloadStyles(attachmentModalId)}
`
}
