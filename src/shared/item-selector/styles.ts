import { ensureStyleTag } from '../../dom/styles'

const DEFAULT_MODAL_ID = 'plm-extension-bom-clone-modal'
const DEFAULT_STYLE_ID = 'plm-extension-search-styles'

// Shared style injector for the search/select/details UI used by BOM clone and other selectors.
// Keeps search-phase presentation logic out of capability-specific DOM adapters.
export function ensureItemSelectorStyles(
  modalId = DEFAULT_MODAL_ID,
  styleId = DEFAULT_STYLE_ID
): void {
  ensureStyleTag(styleId, `
#${modalId} .plm-extension-bom-clone-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  font-family: "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-bom-clone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}
#${modalId} .plm-extension-bom-clone-expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid #c5d2df;
  border-radius: 4px;
  background: #fff;
  color: #33506d;
  cursor: pointer;
}
#${modalId} .plm-extension-bom-clone-expand-btn:hover {
  background: #f0f6fc;
}
#${modalId} .plm-extension-bom-clone-toolbar {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
#${modalId} .plm-extension-bom-clone-search-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr) 0fr;
  gap: 16px;
  align-items: stretch;
  min-height: 0;
  height: 100%;
  transition: grid-template-columns .2s ease;
}
#${modalId} .plm-extension-bom-clone-search-layout.has-details {
  grid-template-columns: minmax(0, 0.68fr) minmax(0, 0.88fr) minmax(380px, 0.74fr);
}
#${modalId} .plm-extension-bom-clone-fields {
  border: 1px solid #d6dce5;
  border-radius: 8px;
  overflow-y: hidden;
  overflow-x: hidden;
  padding: 12px;
  background: #f9fbff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
#${modalId} .plm-extension-bom-clone-fields-title {
  margin: 0 0 8px;
  font-size: 12px;
  color: #2a3b50;
  font-weight: 600;
}
#${modalId} .plm-extension-bom-clone-field-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0;
  font-size: 12px;
}
#${modalId} .plm-extension-bom-clone-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  height: 100%;
}
#${modalId} .plm-extension-bom-clone-applied {
  border: 1px solid #d6dce5;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 48vh;
  overflow: auto;
}
#${modalId} .plm-extension-bom-clone-group {
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  padding: 8px;
  background: #fbfcfe;
}
#${modalId} .plm-extension-bom-clone-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
#${modalId} .plm-extension-bom-clone-filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(110px, 0.7fr) minmax(0, 1fr) 128px;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
#${modalId} .plm-extension-bom-clone-filter-row > * {
  min-width: 0;
}
#${modalId} .plm-extension-bom-clone-filter-label {
  font-size: 12px;
  color: #2b3d53;
  font-weight: 600;
}
#${modalId} .plm-extension-bom-clone-select {
  min-height: 32px;
  border: 1px solid #b6c3d1;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  background: #fff;
  width: 100%;
  box-sizing: border-box;
}
#${modalId} .plm-extension-bom-clone-input {
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid #b6c3d1;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
}
#${modalId} .plm-extension-bom-clone-results {
  border: 1px solid #d6dce5;
  border-radius: 8px;
  overflow: hidden;
  min-height: 0;
  flex: 1 1 auto;
  height: 100%;
  max-height: none;
  display: flex;
  flex-direction: column;
}
#${modalId} .plm-extension-bom-clone-results-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
#${modalId} .plm-extension-bom-clone-description {
  margin: 0 0 10px;
  font-size: 13px;
  color: #3a4b63;
}
#${modalId} .plm-extension-bom-clone-info-note {
  margin: 0 0 6px;
  padding: 8px 10px;
  border: 1px solid #b8d8f5;
  border-radius: 6px;
  background: #eaf5ff;
  color: #214a74;
  font-size: 12px;
  line-height: 1.35;
}
#${modalId} .plm-extension-bom-clone-query-preview {
  padding: 8px 10px;
  border: 1px dashed #b6c3d1;
  border-radius: 6px;
  background: #f6f9fe;
  font-size: 12px;
  color: #2d4b6f;
}
#${modalId} .plm-extension-bom-clone-table {
  font-size: 12px;
}
#${modalId} .plm-extension-bom-clone-table th,
#${modalId} .plm-extension-bom-clone-table td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid #e4e9f0;
}
#${modalId} .plm-extension-bom-clone-actions-col{
  width:88px;
  min-width:88px;
  max-width:88px;
  text-align:right;
}
#${modalId} .plm-extension-bom-clone-row-action-btn{
  min-height:26px;
  min-width:58px;
  padding:0 8px;
  font:600 11.5px/1 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-bom-clone-row-action-btn:disabled{
  opacity:.65;
}
#${modalId} .plm-extension-bom-clone-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f3f6fa;
}
#${modalId} .plm-extension-bom-clone-table tbody tr.is-selected td {
  background: #e2f1ff;
  color: #1f4f78;
}
#${modalId} .plm-extension-bom-clone-table tbody tr.is-details-active td{
  background:#eef7ff;
}
#${modalId} .plm-extension-bom-clone-results-footer {
  flex: 0 0 auto;
  background: #f9fbff;
  color: #4c637a;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
  padding: 8px 10px;
  border-top: 1px solid #d6dce5;
}
#${modalId} .plm-extension-bom-clone-details-column{
  min-height:0;
  height:100%;
  display:grid;
  grid-template-rows:minmax(0, 1fr) minmax(142px, 180px);
  gap:8px;
  opacity:0;
  transform:translateX(20px);
  pointer-events:none;
  transition:opacity .2s ease, transform .2s ease;
}
#${modalId} .plm-extension-bom-clone-details-column.is-visible{
  opacity:1;
  transform:translateX(0);
  pointer-events:auto;
}
#${modalId} .plm-extension-bom-clone-details{
  border:1px solid #d6dce5;
  border-radius:8px;
  overflow:hidden;
  min-height:0;
  min-height:0;
  background:#fdfefe;
  display:flex;
  flex-direction:column;
}
#${modalId} .plm-extension-bom-clone-attachments{
  min-height:0;
  max-height:180px;
}
#${modalId} .plm-extension-bom-clone-details-header{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding:8px 10px;
  border-bottom:1px solid #dde6f0;
  background:#f3f6fa;
}
#${modalId} .plm-extension-bom-clone-details-title{
  margin:0;
  font:700 12px/1.25 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  color:#243f5a;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
#${modalId} .plm-extension-bom-clone-details-close{
  width:22px;
  height:22px;
  border:1px solid #b8c7d8;
  border-radius:4px;
  background:#fff;
  color:#395874;
  font:700 13px/1 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  cursor:pointer;
  padding:0;
}
#${modalId} .plm-extension-bom-clone-details-close:hover{
  background:#edf5ff;
  border-color:#8fb5da;
}
#${modalId} .plm-extension-bom-clone-details-body{
  flex:1 1 auto;
  min-height:0;
  overflow:auto;
  overflow-x:hidden;
  padding:0;
}
#${modalId} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body{
  overflow:hidden;
  display:flex;
  flex-direction:column;
  gap:8px;
  padding:8px;
}
#${modalId} .plm-extension-bom-clone-attachment-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
}
#${modalId} .plm-extension-bom-clone-attachments-header-meta{
  display:flex;
  align-items:center;
  gap:8px;
}
#${modalId} .plm-extension-bom-clone-attachment-count{
  font:600 12px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  color:#3a556f;
}
#${modalId} .plm-extension-bom-clone-attachment-controls{
  display:flex;
  gap:6px;
}
#${modalId} .plm-extension-bom-clone-attachment-scroll{
  min-width:28px;
  width:28px;
  height:28px;
  padding:0;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
#${modalId} .plm-extension-bom-clone-attachment-scroll .zmdi{
  font-size:16px;
  line-height:1;
}
#${modalId} .plm-extension-bom-clone-attachment-track{
  flex:1 1 auto;
  min-height:0;
  display:flex;
  align-items:center;
  overflow-x:auto;
  overflow-y:hidden;
  scroll-behavior:smooth;
}
#${modalId} .plm-extension-bom-clone-attachment-rail{
  display:flex;
  gap:10px;
  align-items:flex-start;
  justify-content:flex-start;
  min-height:0;
  width:max-content;
  min-width:100%;
  padding:0 6px 4px;
  box-sizing:border-box;
}
#${modalId} .plm-extension-bom-clone-attachment-card{
  width:122px;
  min-width:122px;
  border:1px solid #d2deea;
  border-radius:8px;
  background:#f8fbff;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:flex-start;
  gap:5px;
  padding:7px 6px;
}
#${modalId} .plm-extension-bom-clone-attachment-icon{
  width:44px;
  height:50px;
  border:1px solid #a9bfd5;
  border-radius:6px;
  background:#ffffff;
  color:#1d4b77;
  display:flex;
  align-items:center;
  justify-content:center;
  font:700 9px/1.1 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  text-transform:uppercase;
  letter-spacing:.05em;
}
#${modalId} .plm-extension-bom-clone-attachment-name{
  width:100%;
  text-align:center;
  color:#2a4560;
  font:600 10px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
#${modalId} .plm-extension-bom-clone-attachment-name-link{
  color:#2a4560;
  text-decoration:none;
}
#${modalId} .plm-extension-bom-clone-attachment-name-link:hover{
  color:#0b62a5;
  text-decoration:underline;
}
#${modalId} .plm-extension-bom-clone-attachment-meta{
  width:100%;
  text-align:center;
  color:#55708a;
  font:500 9px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId}.plm-extension-bom-clone-panel-expanded .plm-extension-bom-clone-attachment-card{
  width:156px;
  min-width:156px;
  padding:8px 7px;
  gap:6px;
}
#${modalId}.plm-extension-bom-clone-panel-expanded .plm-extension-bom-clone-attachment-icon{
  width:54px;
  height:62px;
  font-size:10.5px;
}
#${modalId}.plm-extension-bom-clone-panel-expanded .plm-extension-bom-clone-attachment-name{
  font-size:11.5px;
}
#${modalId}.plm-extension-bom-clone-panel-expanded .plm-extension-bom-clone-attachment-meta{
  font-size:10.5px;
}
#${modalId} .plm-extension-bom-clone-details-note{
  margin:0;
  padding:12px 10px;
  color:#506780;
  font:500 12px/1.35 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-bom-clone-loading-center{
  min-height:120px;
  height:100%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:8px;
}
#${modalId} .plm-extension-bom-clone-loading-center--compact{
  min-height:0;
  width:100%;
  height:auto;
}
#${modalId} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body.is-loading{
  display:grid;
  place-items:center;
  padding:8px;
  overflow:hidden;
}
#${modalId} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body.is-loading .plm-extension-bom-clone-loading-center{
  min-height:auto;
  width:auto;
  height:auto;
  margin:0 auto;
  padding:0;
  transform:translateY(-32px);
}
#${modalId} .plm-extension-bom-clone-attachments .plm-extension-bom-clone-details-body.is-loading .plm-extension-bom-clone-loading-text{
  margin-top:4px;
}
#${modalId} .plm-extension-bom-clone-loading-center .generic-loader{
  width:72px;
  text-align:center;
}
#${modalId} .plm-extension-bom-clone-loading-center .generic-loader > div{
  width:16px;
  height:16px;
  background-color:#149cd8;
  border-radius:100%;
  display:inline-block;
  animation:plm-extension-bom-clone-bouncedelay 1.4s infinite ease-in-out both;
  margin:0 3px;
}
#${modalId} .plm-extension-bom-clone-loading-center .generic-loader .bounce1{
  animation-delay:-0.32s;
}
#${modalId} .plm-extension-bom-clone-loading-center .generic-loader .bounce2{
  animation-delay:-0.16s;
}
#${modalId} .plm-extension-bom-clone-loading-text{
  color:#4b637a;
  font:600 12px/1.25 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
@keyframes plm-extension-bom-clone-bouncedelay{
  0%,80%,100%{
    transform:scale(0);
  }
  40%{
    transform:scale(1);
  }
}
#${modalId} .plm-extension-bom-clone-details-table{
  font:500 11.5px/1.3 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-bom-clone-details-section{
  border-bottom:1px solid #e2e8f1;
}
#${modalId} .plm-extension-bom-clone-details-section:last-child{
  border-bottom:0;
}
#${modalId} .plm-extension-bom-clone-details-section-title{
  list-style:none;
  cursor:pointer;
  padding:8px 10px;
  margin:0;
  background:#f7fbff;
  color:#2a4a69;
  font:700 12px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  border-bottom:1px solid #e7edf4;
}
#${modalId} .plm-extension-bom-clone-details-section-title::-webkit-details-marker{
  display:none;
}
#${modalId} .plm-extension-bom-clone-details-section-title::before{
  content:'▸';
  display:inline-block;
  margin-right:6px;
  transform:translateY(-1px);
}
#${modalId} .plm-extension-bom-clone-details-section[open] > .plm-extension-bom-clone-details-section-title::before{
  content:'▾';
}
#${modalId} .plm-extension-bom-clone-details-table th,
#${modalId} .plm-extension-bom-clone-details-table td{
  padding:7px 10px;
  border-bottom:1px solid #e7edf4;
  vertical-align:top;
  text-align:left;
}
#${modalId} .plm-extension-bom-clone-details-table th{
  position:sticky;
  top:0;
  z-index:1;
  background:#f7faff;
  color:#334f6b;
  font:700 11.5px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-bom-clone-details-table td:first-child{
  width:34%;
  color:#35526f;
  min-width:86px;
  white-space:normal;
  word-break:normal;
  overflow-wrap:break-word;
  hyphens:auto;
}
#${modalId} .plm-extension-bom-clone-details-table td:last-child{
  color:#1f364f;
  word-break:break-word;
  overflow-wrap:anywhere;
}
#${modalId} .plm-extension-bom-clone-details-table td:last-child > *{
  max-width:100%;
  box-sizing:border-box;
}
#${modalId} .plm-extension-bom-clone-details-table td:last-child a,
#${modalId} .plm-extension-bom-clone-details-table td:last-child button{
  display:inline-flex;
  align-items:center;
  max-width:100%;
  white-space:nowrap !important;
  word-break:normal !important;
  overflow-wrap:normal !important;
  vertical-align:top;
  min-height:0 !important;
  height:auto !important;
  line-height:1.3 !important;
  font-size:12px !important;
  padding-top:4px !important;
  padding-bottom:4px !important;
}
#${modalId} .plm-extension-bom-clone-image-preview{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  gap:6px;
}
#${modalId} .plm-extension-bom-clone-image-preview-img{
  display:inline-block;
  border:1px dashed #ccc;
  border-radius:3px;
  width:162px;
  height:162px;
  max-width:95%;
  object-fit:contain;
  background:#fff;
}
.plm-extension-bom-clone-image-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:2147483647;
  display:flex;
  align-items:center;
  justify-content:center;
  background:rgba(15,23,42,0.46);
}
.plm-extension-bom-clone-image-modal-dialog{
  max-height:80%;
  max-width:80%;
  margin:0;
  border-radius:6px;
  background:#fff;
  padding:10px;
  box-shadow:0 16px 40px rgba(0,0,0,0.28);
}
.plm-extension-bom-clone-image-modal-img{
  display:block;
  max-width:100%;
  max-height:calc(80vh - 20px);
  object-fit:contain;
}
#${modalId} .plm-extension-bom-clone-details-table td a{
  color:#0b62a5;
  text-decoration:underline;
}
#${modalId} .plm-extension-bom-clone-rich-html-cell{
  line-height:1.5;
}
#${modalId} .plm-extension-bom-clone-rich-html-cell a{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:32px;
  padding:0 16px;
  margin:0 8px 8px 0;
  border:1px solid #bec8d2;
  border-radius:3px;
  background:#fff;
  color:#0a131c;
  font-weight:600;
  text-decoration:none !important;
  white-space:nowrap;
}
#${modalId} .plm-extension-bom-clone-rich-html-cell a:hover{
  background:#f5f8fb;
  border-color:#aeb9c5;
}
#${modalId} .plm-extension-bom-clone-rich-html-cell td{
  padding-left:0 !important;
}
#${modalId} .plm-extension-bom-clone-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 260px;
}
#${modalId} .plm-extension-bom-clone-pane {
  border: 1px solid #d6dce5;
  border-radius: 8px;
  overflow: auto;
  padding: 8px;
}
#${modalId} .plm-extension-bom-clone-error {
  color: #be321d;
  font-size: 12px;
}
#${modalId} .plm-extension-bom-clone-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  flex: 0 0 auto;
}
#${modalId} .plm-extension-bom-clone-footer--with-summary {
  justify-content: space-between;
  align-items: center;
}
#${modalId} .plm-extension-bom-clone-footer--with-summary .plm-extension-bom-structure-summary {
  margin-top: 0;
  margin-right: auto;
}
#${modalId} .plm-extension-bom-clone-btn {
  min-height: 32px;
  padding: 0 14px;
}
#${modalId} .plm-extension-bom-clone-btn:disabled {
  opacity: 0.6;
}
#${modalId} .plm-extension-bom-clone-mode-toggle {
  display: inline-grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 1px solid #b6c3d1;
  border-radius: 8px;
  overflow: hidden;
  width: 340px;
  min-width: 340px;
  margin: 0 0 8px;
  background: #f5f7fa;
  flex: 0 0 auto;
}
#${modalId} .plm-extension-bom-clone-mode-btn {
  appearance: none;
  border: 0;
  border-right: 1px solid #b6c3d1;
  border-radius: 0;
  background: #f5f7fa;
  min-width: 0;
  width: 100%;
  min-width: 0;
  height: 36px;
  margin: 0;
  padding: 0 14px;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.1;
  color: #1f2f43;
  cursor: pointer;
  box-sizing: border-box;
  white-space: nowrap;
}
#${modalId} .plm-extension-bom-clone-mode-btn:last-child {
  border-right: 0;
}
#${modalId} .plm-extension-bom-clone-mode-btn.is-active {
  background: #009fe3;
  color: #ffffff;
}
#${modalId} .plm-extension-bom-clone-group-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #83bee8;
  background: #dff0ff;
  color: #1f4f78;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
}
#${modalId} .plm-extension-bom-clone-group-pill-remove {
  appearance: none;
  border: 0;
  background: transparent;
  color: #1b4a73;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 50%;
  line-height: 1;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  opacity: 0.85;
}
#${modalId} .plm-extension-bom-clone-group-pill-remove:hover {
  background: rgba(32, 102, 153, 0.16);
  opacity: 1;
}
#${modalId} .plm-extension-bom-clone-group-pill-remove:focus-visible {
  outline: 2px solid #1f6fb2;
  outline-offset: 1px;
}
#${modalId} .plm-extension-bom-clone-mode-btn:focus-visible {
  outline: 2px solid #1f6fb2;
  outline-offset: -2px;
}
#${modalId} .plm-extension-bom-clone-group-join {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px dashed #c3cfde;
  border-radius: 6px;
  background: #f7fafe;
}
#${modalId} .plm-extension-bom-clone-group-join .plm-extension-bom-clone-input,
#${modalId} .plm-extension-bom-clone-group-join .plm-extension-bom-clone-select {
  flex: 1 1 auto;
  min-width: 180px;
}
#${modalId} .plm-extension-bom-clone-row-action {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}
#${modalId} .plm-extension-bom-clone-join-label {
  font-size: 12px;
  color: #3a4b63;
  min-width: 30px;
  text-align: right;
}
#${modalId} .plm-extension-bom-clone-join-select {
  width: 86px;
  min-width: 86px;
}
#${modalId} .plm-extension-bom-clone-row-remove {
  width: 100%;
  min-height: 32px;
  font-weight: 600;
}
#${modalId} .plm-extension-bom-node {
  margin: 4px 0;
}
#${modalId} .plm-extension-bom-node-children {
  margin-left: 16px;
}
`)
}
