import { ensureStyleTag } from '../../../shared/dom/styles'

export const SEARCH_DIALOG_MODAL_STYLE_ID = 'plm-extension-search-dialog-modal-styles'

/**
 * Injected styles for the shared search dialog modal (toolbar, fields, lists, details pane).
 * BOM clone shell chrome remains in `shared/item-selector/styles.ts` (ensureItemSelectorStyles).
 * Classes use the `plm-extension-search-dialog-*` prefix.
 */
export function ensureSearchDialogModalStyles(modalId: string): void {
  ensureStyleTag(`${SEARCH_DIALOG_MODAL_STYLE_ID}-${modalId}`, `#${modalId} .plm-extension-search-dialog-toolbar {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
#${modalId} .plm-extension-search-dialog-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr) 0fr;
  gap: 16px;
  align-items: stretch;
  min-height: 0;
  height: 100%;
  transition: grid-template-columns .2s ease;
}
#${modalId} .plm-extension-search-dialog-layout.has-details {
  grid-template-columns: minmax(0, 0.68fr) minmax(0, 0.88fr) minmax(380px, 0.74fr);
}
#${modalId} .plm-extension-search-dialog-fields {
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
#${modalId} .plm-extension-search-dialog-fields-title {
  margin: 0 0 8px;
  font-size: 12px;
  color: #2a3b50;
  font-weight: 600;
}
#${modalId} .plm-extension-search-dialog-field-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0;
  font-size: 12px;
}
#${modalId} .plm-extension-search-dialog-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  height: 100%;
}
#${modalId} .plm-extension-search-dialog-applied {
  border: 1px solid #d6dce5;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 48vh;
  overflow: auto;
}
#${modalId} .plm-extension-search-dialog-group {
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  padding: 8px;
  background: #fbfcfe;
}
#${modalId} .plm-extension-search-dialog-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
#${modalId} .plm-extension-search-dialog-group-join {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px dashed #c3cfde;
  border-radius: 6px;
  background: #f7fafe;
}
#${modalId} .plm-extension-search-dialog-group-join .plm-extension-search-dialog-input {
  flex: 1 1 auto;
  min-width: 180px;
}
#${modalId} .plm-extension-search-dialog-group-pill {
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
#${modalId} .plm-extension-search-dialog-group-pill-remove {
  appearance: none;
  border: 0;
  background: transparent;
  color: #1b4a73;
  width: 22px;
  height: 22px;
  min-width: 22px;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  opacity: 0.85;
  flex-shrink: 0;
  box-sizing: border-box;
}
#${modalId} .plm-extension-search-dialog-group-pill-remove:hover {
  background: rgba(32, 102, 153, 0.16);
  opacity: 1;
}
#${modalId} .plm-extension-search-dialog-group-pill-remove:focus-visible {
  outline: 2px solid #1f6fb2;
  outline-offset: 1px;
}
#${modalId} .plm-extension-search-dialog-row-action {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}
#${modalId} .plm-extension-search-dialog-join-label {
  font-size: 12px;
  color: #3a4b63;
  min-width: 30px;
  text-align: right;
}
#${modalId} .plm-extension-search-dialog-join-select {
  width: 86px;
  min-width: 86px;
}
#${modalId} .plm-extension-search-dialog-row-remove {
  width: 100%;
  min-height: 32px;
  font-weight: 600;
}
#${modalId} .plm-extension-search-dialog-filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(110px, 0.7fr) minmax(0, 1fr) 128px;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
#${modalId} .plm-extension-search-dialog-filter-row > * {
  min-width: 0;
}
#${modalId} .plm-extension-search-dialog-filter-label {
  font-size: 12px;
  color: #2b3d53;
  font-weight: 600;
}
#${modalId} .plm-extension-search-dialog-select {
  min-height: 32px;
  border: 1px solid #b6c3d1;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  background: #fff;
  width: 100%;
  box-sizing: border-box;
}
#${modalId} .plm-extension-search-dialog-input {
  min-height: 32px;
  padding: 6px 10px;
  border: 1px solid #b6c3d1;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
}
#${modalId} .plm-extension-search-dialog-results {
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
#${modalId} .plm-extension-search-dialog-results-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
#${modalId} .plm-extension-search-dialog-description {
  margin: 0 0 10px;
  font-size: 13px;
  color: #3a4b63;
}
#${modalId} .plm-extension-search-dialog-info-note {
  margin: 0 0 6px;
  padding: 8px 10px;
  border: 1px solid #b8d8f5;
  border-radius: 6px;
  background: #eaf5ff;
  color: #214a74;
  font-size: 12px;
  line-height: 1.35;
}
#${modalId} .plm-extension-search-dialog-query-preview {
  padding: 8px 10px;
  border: 1px dashed #b6c3d1;
  border-radius: 6px;
  background: #f6f9fe;
  font-size: 12px;
  color: #2d4b6f;
}
#${modalId} .plm-extension-search-dialog-table {
  font-size: 12px;
}
#${modalId} .plm-extension-search-dialog-table th,
#${modalId} .plm-extension-search-dialog-table td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid #e4e9f0;
}
#${modalId} .plm-extension-search-dialog-actions-col{
  width:88px;
  min-width:88px;
  max-width:88px;
  text-align:right;
}
#${modalId} .plm-extension-search-dialog-row-action-btn{
  min-height:26px;
  min-width:58px;
  padding:0 8px;
  font:600 11.5px/1 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-search-dialog-row-action-btn:disabled{
  opacity:.65;
}
#${modalId} .plm-extension-search-dialog-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f3f6fa;
}
#${modalId} .plm-extension-search-dialog-table tbody tr.is-selected td {
  background: #e2f1ff;
  color: #1f4f78;
}
#${modalId} .plm-extension-search-dialog-table tbody tr.is-details-active td{
  background:#eef7ff;
}
#${modalId} .plm-extension-search-dialog-results-footer {
  flex: 0 0 auto;
  background: #f9fbff;
  color: #4c637a;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
  padding: 8px 10px;
  border-top: 1px solid #d6dce5;
}
#${modalId} .plm-extension-search-dialog-details-column{
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
#${modalId} .plm-extension-search-dialog-details-column.is-visible{
  opacity:1;
  transform:translateX(0);
  pointer-events:auto;
}
#${modalId} .plm-extension-search-dialog-details{
  border:1px solid #d6dce5;
  border-radius:8px;
  overflow:hidden;
  min-height:0;
  min-height:0;
  background:#fdfefe;
  display:flex;
  flex-direction:column;
}
#${modalId} .plm-extension-search-dialog-attachments{
  min-height:0;
  max-height:180px;
}
#${modalId} .plm-extension-search-dialog-details-header{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding:8px 10px;
  border-bottom:1px solid #dde6f0;
  background:#f3f6fa;
}
#${modalId} .plm-extension-search-dialog-details-title{
  margin:0;
  font:700 12px/1.25 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  color:#243f5a;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
#${modalId} .plm-extension-search-dialog-details-close{
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
#${modalId} .plm-extension-search-dialog-details-close:hover{
  background:#edf5ff;
  border-color:#8fb5da;
}
#${modalId} .plm-extension-search-dialog-details-body{
  flex:1 1 auto;
  min-height:0;
  overflow:auto;
  overflow-x:hidden;
  padding:0;
}
#${modalId} .plm-extension-search-dialog-attachments .plm-extension-search-dialog-details-body{
  overflow:hidden;
  display:flex;
  flex-direction:column;
  gap:8px;
  padding:8px;
}
#${modalId} .plm-extension-search-dialog-attachment-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
}
#${modalId} .plm-extension-search-dialog-attachments-header-meta{
  display:flex;
  align-items:center;
  gap:8px;
}
#${modalId} .plm-extension-search-dialog-attachment-count{
  font:600 12px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  color:#3a556f;
}
#${modalId} .plm-extension-search-dialog-attachment-controls{
  display:flex;
  gap:6px;
}
#${modalId} .plm-extension-search-dialog-attachment-scroll{
  min-width:28px;
  width:28px;
  height:28px;
  padding:0;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
#${modalId} .plm-extension-search-dialog-attachment-scroll .zmdi{
  font-size:16px;
  line-height:1;
}
#${modalId} .plm-extension-search-dialog-attachment-track{
  flex:1 1 auto;
  min-height:0;
  display:flex;
  align-items:center;
  overflow-x:auto;
  overflow-y:hidden;
  scroll-behavior:smooth;
}
#${modalId} .plm-extension-search-dialog-attachment-rail{
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
#${modalId} .plm-extension-search-dialog-attachment-card{
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
#${modalId} .plm-extension-search-dialog-attachment-icon{
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
#${modalId} .plm-extension-search-dialog-attachment-name{
  width:100%;
  text-align:center;
  color:#2a4560;
  font:600 10px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
#${modalId} .plm-extension-search-dialog-attachment-name-link{
  color:#2a4560;
  text-decoration:none;
}
#${modalId} .plm-extension-search-dialog-attachment-name-link:hover{
  color:#0b62a5;
  text-decoration:underline;
}
#${modalId} .plm-extension-search-dialog-attachment-meta{
  width:100%;
  text-align:center;
  color:#55708a;
  font:500 9px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-clone-modal-panel-expanded .plm-extension-search-dialog-attachment-card{
  width:156px;
  min-width:156px;
  padding:8px 7px;
  gap:6px;
}
#${modalId} .plm-extension-clone-modal-panel-expanded .plm-extension-search-dialog-attachment-icon{
  width:54px;
  height:62px;
  font-size:10.5px;
}
#${modalId} .plm-extension-clone-modal-panel-expanded .plm-extension-search-dialog-attachment-name{
  font-size:11.5px;
}
#${modalId} .plm-extension-clone-modal-panel-expanded .plm-extension-search-dialog-attachment-meta{
  font-size:10.5px;
}
#${modalId} .plm-extension-search-dialog-details-note{
  margin:0;
  padding:12px 10px;
  color:#506780;
  font:500 12px/1.35 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-search-dialog-loading-center{
  min-height:120px;
  height:100%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:8px;
}
#${modalId} .plm-extension-search-dialog-loading-center--compact{
  min-height:0;
  width:100%;
  height:auto;
}
#${modalId} .plm-extension-search-dialog-attachments .plm-extension-search-dialog-details-body.is-loading{
  display:grid;
  place-items:center;
  padding:8px;
  overflow:hidden;
}
#${modalId} .plm-extension-search-dialog-attachments .plm-extension-search-dialog-details-body.is-loading .plm-extension-search-dialog-loading-center{
  min-height:auto;
  width:auto;
  height:auto;
  margin:0 auto;
  padding:0;
  transform:translateY(-32px);
}
#${modalId} .plm-extension-search-dialog-attachments .plm-extension-search-dialog-details-body.is-loading .plm-extension-generic-loader__label{
  margin-top:4px;
}
#${modalId} .plm-extension-search-dialog-details-table{
  font:500 11.5px/1.3 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-search-dialog-details-section{
  border-bottom:1px solid #e2e8f1;
}
#${modalId} .plm-extension-search-dialog-details-section:last-child{
  border-bottom:0;
}
#${modalId} .plm-extension-search-dialog-details-section-title{
  list-style:none;
  cursor:pointer;
  padding:8px 10px;
  margin:0;
  background:#f7fbff;
  color:#2a4a69;
  font:700 12px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
  border-bottom:1px solid #e7edf4;
}
#${modalId} .plm-extension-search-dialog-details-section-title::-webkit-details-marker{
  display:none;
}
#${modalId} .plm-extension-search-dialog-details-section-title::before{
  content:'▸';
  display:inline-block;
  margin-right:6px;
  transform:translateY(-1px);
}
#${modalId} .plm-extension-search-dialog-details-section[open] > .plm-extension-search-dialog-details-section-title::before{
  content:'▾';
}
#${modalId} .plm-extension-search-dialog-details-table th,
#${modalId} .plm-extension-search-dialog-details-table td{
  padding:7px 10px;
  border-bottom:1px solid #e7edf4;
  vertical-align:top;
  text-align:left;
}
#${modalId} .plm-extension-search-dialog-details-table th{
  position:sticky;
  top:0;
  z-index:1;
  background:#f7faff;
  color:#334f6b;
  font:700 11.5px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;
}
#${modalId} .plm-extension-search-dialog-details-table td:first-child{
  width:34%;
  color:#35526f;
  min-width:86px;
  white-space:normal;
  word-break:normal;
  overflow-wrap:break-word;
  hyphens:auto;
}
#${modalId} .plm-extension-search-dialog-details-table td:last-child{
  color:#1f364f;
  word-break:break-word;
  overflow-wrap:anywhere;
}
#${modalId} .plm-extension-search-dialog-details-table td:last-child > *{
  max-width:100%;
  box-sizing:border-box;
}
#${modalId} .plm-extension-search-dialog-details-table td:last-child a,
#${modalId} .plm-extension-search-dialog-details-table td:last-child button{
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
#${modalId} .plm-extension-search-dialog-image-preview{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  gap:6px;
}
#${modalId} .plm-extension-search-dialog-image-preview-img{
  display:inline-block;
  border:1px dashed #ccc;
  border-radius:3px;
  width:162px;
  height:162px;
  max-width:95%;
  object-fit:contain;
  background:#fff;
}
.plm-extension-search-dialog-image-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:2147483647;
  display:flex;
  align-items:center;
  justify-content:center;
  background:rgba(15,23,42,0.46);
}
.plm-extension-search-dialog-image-modal-dialog{
  max-height:80%;
  max-width:80%;
  margin:0;
  border-radius:6px;
  background:#fff;
  padding:10px;
  box-shadow:0 16px 40px rgba(0,0,0,0.28);
}
.plm-extension-search-dialog-image-modal-img{
  display:block;
  max-width:100%;
  max-height:calc(80vh - 20px);
  object-fit:contain;
}
#${modalId} .plm-extension-search-dialog-details-table td a{
  color:#0b62a5;
  text-decoration:underline;
}
#${modalId} .plm-extension-search-dialog-rich-html-cell{
  line-height:1.5;
}
#${modalId} .plm-extension-search-dialog-rich-html-cell a{
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
#${modalId} .plm-extension-search-dialog-rich-html-cell a:hover{
  background:#f5f8fb;
  border-color:#aeb9c5;
}
#${modalId} .plm-extension-search-dialog-rich-html-cell td{
  padding-left:0 !important;
}
#${modalId} .plm-extension-search-dialog-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 260px;
}
#${modalId} .plm-extension-search-dialog-pane {
  border: 1px solid #d6dce5;
  border-radius: 8px;
  overflow: auto;
  padding: 8px;
}
`)
}
