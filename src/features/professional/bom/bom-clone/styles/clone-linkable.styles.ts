export function buildCloneLinkableStyles(structureModalId: string): string {
  return `
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
`
}
