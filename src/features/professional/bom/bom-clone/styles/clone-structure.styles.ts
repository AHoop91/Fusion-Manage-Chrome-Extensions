export function buildCloneStructureStyles(structureModalId: string): string {
  return `
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
`
}
