import { buildBomScopeStyles } from '../shared/styles'

export function buildAttachmentDownloadStyles(attachmentModalId: string): string {
  return `
${buildBomScopeStyles(attachmentModalId)}
#${attachmentModalId} .plm-extension-bom-attachment-download-shell{
  display:flex;
  flex-direction:column;
  gap:14px;
  color:#1f2d3d;
  font-family:var(--plm-bom-font-sans);
  min-height:0;
  height:100%;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-layout{
  display:grid;
  grid-template-columns:minmax(300px, 0.72fr) minmax(700px, 1.55fr);
  gap:14px;
  min-height:0;
  flex:1 1 auto;
  overflow:hidden;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-config,
#${attachmentModalId} .plm-extension-bom-attachment-download-preview{
  min-height:0;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-config{
  display:flex;
  flex-direction:column;
  gap:12px;
  overflow:auto;
  padding-right:2px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-section{
  display:flex;
  flex-direction:column;
  gap:10px;
  padding:0 0 12px;
  border-bottom:1px solid #e3ebf3;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-section-header{
  display:flex;
  align-items:center;
  gap:6px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-section-title{
  margin:0;
  font:700 12.5px/1.2 var(--plm-bom-font-sans);
  color:#1c3348;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-section-info{
  color:#7890a7;
  font-size:14px;
  line-height:1;
  cursor:help;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-header{
  display:flex;
  flex-direction:column;
  gap:4px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-title{
  margin:0;
  font:700 21px/1.15 var(--plm-bom-font-sans);
  color:#142435;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-description{
  margin:0;
  font:400 12.5px/1.4 var(--plm-bom-font-sans);
  color:#51606f;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-grid{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  gap:10px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-field{
  display:flex;
  flex-direction:column;
  gap:4px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-field--modified-custom{
  margin-top:8px;
  padding-top:2px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-modified-stack{
  display:flex;
  flex-direction:column;
  gap:8px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-field--extensions{
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
  box-shadow:none;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-row{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:nowrap;
  min-width:0;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-groups{
  display:flex;
  align-items:stretch;
  gap:8px;
  flex-wrap:nowrap;
  flex:0 0 auto;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-card{
  display:flex;
  align-items:center;
  gap:8px;
  min-height:40px;
  padding:0 10px;
  border:1px solid #d4e0eb;
  border-radius:8px;
  background:#f9fbfe;
  font:600 12px/1.2 var(--plm-bom-font-sans);
  color:#24374a;
  white-space:nowrap;
  box-sizing:border-box;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-card input[type="checkbox"]{
  accent-color:#149cd8;
  margin:0;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-card span{
  flex:0 0 auto;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-card:has(input[type="checkbox"]:checked){
  border-color:#8ec9e7;
  background:#eef8fd;
  box-shadow:0 0 0 1px rgba(20, 156, 216, .08);
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-pillbox{
  display:flex;
  align-items:center;
  gap:6px;
  flex:1 1 0;
  min-width:132px;
  min-height:40px;
  padding:4px 8px;
  border:1px solid #d4e0eb;
  border-radius:8px;
  background:#fff;
  flex-wrap:wrap;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-pill{
  display:inline-flex;
  align-items:center;
  gap:6px;
  min-height:26px;
  padding:0 8px;
  border:1px solid #c9d8e6;
  border-radius:999px;
  background:#edf5fb;
  color:#1e425f;
  font:600 11.5px/1.2 var(--plm-bom-font-sans);
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-pill-remove{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:16px;
  height:16px;
  padding:0;
  border:0;
  background:transparent;
  color:#47637b;
  cursor:pointer;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-pill-remove .zmdi{
  font-size:13px;
  line-height:1;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-pill-input{
  flex:1 1 110px;
  min-width:110px;
  min-height:24px;
  border:0;
  outline:0;
  background:transparent;
  padding:0;
  color:#132131;
  font:400 12.5px/1.3 var(--plm-bom-font-sans);
}
#${attachmentModalId} .plm-extension-bom-attachment-download-field--full{
  grid-column:1 / -1;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-label{
  font:600 11.5px/1.2 var(--plm-bom-font-sans);
  color:#24374a;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-input,
#${attachmentModalId} .plm-extension-bom-attachment-download-select{
  width:100%;
  min-height:34px;
  border:1px solid #c8d4e0;
  border-radius:8px;
  padding:7px 10px;
  font:400 12.5px/1.3 var(--plm-bom-font-sans);
  color:#132131;
  background:#fff;
  box-sizing:border-box;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-input:focus,
#${attachmentModalId} .plm-extension-bom-attachment-download-select:focus{
  outline:none;
  border-color:#149cd8;
  box-shadow:0 0 0 3px rgba(20, 156, 216, .16);
}
#${attachmentModalId} .plm-extension-bom-attachment-download-help{
  margin:0;
  font:400 11px/1.35 var(--plm-bom-font-sans);
  color:#697888;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-date-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  gap:8px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-options{
  display:grid;
  grid-template-columns:minmax(0,1fr);
  gap:12px;
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-toggle{
  display:flex;
  align-items:flex-start;
  gap:8px;
  padding:1px 0;
  border:0;
  border-radius:0;
  background:transparent;
  font:600 11.5px/1.3 var(--plm-bom-font-sans);
  color:#24374a;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-summary{
  display:flex;
  flex-direction:column;
  gap:6px;
  margin-top:8px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-summary-list{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-summary-pill{
  display:inline-flex;
  align-items:center;
  gap:6px;
  min-height:28px;
  padding:0 10px;
  border:1px solid #d7e3ef;
  border-radius:8px;
  background:#f5f9fc;
  color:#27425b;
  font:600 12px/1.2 var(--plm-bom-font-sans);
}
#${attachmentModalId} .plm-extension-bom-attachment-download-extension-summary-pill strong{
  font:700 12px/1 var(--plm-bom-font-sans);
  color:#14324b;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-toggle input{
  margin-top:2px;
  accent-color:#149cd8;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-toggle span{
  display:flex;
  flex-direction:column;
  gap:3px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-toggle strong{
  font:700 12px/1.25 var(--plm-bom-font-sans);
  color:#1d354c;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-toggle small{
  font:500 11px/1.35 var(--plm-bom-font-sans);
  color:#66788b;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-footer{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
  margin-top:auto;
  padding-top:12px;
  border-top:1px solid #e0e8f1;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-actions{
  display:flex;
  align-items:center;
  gap:10px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview{
  display:flex;
  flex-direction:column;
  border:1px solid #d8e2ec;
  border-radius:12px;
  background:#fbfcfe;
  overflow:hidden;
  min-width:0;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding:12px 14px 10px;
  border-bottom:1px solid #e1e8f0;
  background:#f3f7fb;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-title{
  margin:0;
  font:700 15px/1.2 var(--plm-bom-font-sans);
  color:#15283b;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-subtitle{
  margin:4px 0 0;
  font:400 11.5px/1.35 var(--plm-bom-font-sans);
  color:#667689;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-body{
  flex:1 1 auto;
  min-height:0;
  overflow:auto;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-warning{
  margin:10px 12px 0;
  padding:8px 10px;
  border:1px solid #efb3b3;
  border-radius:8px;
  background:#fff4f4;
  color:#b42318;
  font:600 12px/1.35 var(--plm-bom-font-sans);
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table{
  width:100%;
  min-width:100%;
  table-layout:fixed;
  border-collapse:collapse;
  border-spacing:0;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table th,
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table td{
  text-align:left;
  padding:0 10px;
  height:33px;
  line-height:1.2;
  vertical-align:middle;
  border-bottom:1px solid #e7edf4;
  font-size:13.5px;
  font-weight:400;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table th{
  position:sticky;
  top:0;
  z-index:1;
  font-weight:700;
  color:#2d435a;
  background:#f5f8fc;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table col.plm-extension-bom-attachment-download-col-description{
  width:auto;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table col.plm-extension-bom-attachment-download-col-attachments{
  width:138px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table col.plm-extension-bom-attachment-download-col-files-downloaded{
  width:146px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-number-descriptor-merged-cell{
  padding-left:8px;
  padding-right:8px;
  min-width:0;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-number-descriptor-merged-wrap{
  display:flex;
  align-items:center;
  gap:20px;
  min-width:0;
  width:100%;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-descriptor-scroll{
  display:block;
  width:100%;
  max-width:100%;
  overflow:hidden;
  white-space:nowrap;
  text-overflow:ellipsis;
  padding-left:4px;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-number-value{
  display:inline-flex;
  align-items:center;
  min-width:22px;
  margin-right:6px;
  font:800 13px/1.2 var(--plm-bom-font-sans);
  color:#1e425f;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-number{
  display:inline-flex;
  align-items:stretch;
  gap:8px;
  min-width:0;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-attachment-download-files-cell{
  text-align:center;
  font:700 12.5px/1.2 var(--plm-bom-font-sans);
  color:#6a7d90;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-attachment-download-attachments-cell{
  text-align:center;
  padding-left:0;
  padding-right:0;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-attachment-download-attachment-pill{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  min-width:40px;
  padding:0 8px;
  height:24px;
  border:1px solid #d4e0eb;
  border-radius:999px;
  background:#f7fbff;
  color:#31597b;
  font:700 12px/1 var(--plm-bom-font-sans);
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-attachment-download-paperclip{
  font-size:13px;
  line-height:1;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-attachment-download-attachment-empty{
  color:#6a7d90;
  font:700 12.5px/1.2 var(--plm-bom-font-sans);
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-chevron,
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-chevron-spacer{
  width:16px;
  min-width:16px;
  height:29px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-chevron{
  border:0;
  background:transparent;
  color:#4e647a;
  padding:0;
  cursor:pointer;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-chevron .zmdi{
  font-size:16px;
  line-height:1;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-part-icon-box,
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-assembly-icon-box,
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-root-icon-box{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:29px;
  min-width:29px;
  height:29px;
  align-self:stretch;
  border:1px solid #c8d4e2;
  background:#eef2f6;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-part-icon-box{
  border-right:3px solid #111827;
  color:#5b6e83;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-assembly-icon-box{
  border-right:3px solid #2d79c7;
  color:#2d79c7;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-root-icon-box{
  border-right:3px solid #1f334a;
  color:#101820;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-part-glyph{
  display:block;
  width:17px;
  height:17px;
  color:#111827;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-part-glyph.is-assembly-badge{
  width:15px;
  height:15px;
  color:#2d79c7;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-preview-table .plm-extension-bom-structure-root-assembly-icon{
  font-size:17px;
  line-height:1;
  color:#1f334a;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-empty{
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:220px;
  padding:20px;
  text-align:center;
  font:500 12.5px/1.45 var(--plm-bom-font-sans);
  color:#68798b;
}
#${attachmentModalId} .plm-extension-bom-clone-loading-center{
  min-height:220px;
  width:100%;
  height:100%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:8px;
  text-align:center;
}
#${attachmentModalId} .plm-extension-bom-clone-loading-center .generic-loader{
  width:72px;
  text-align:center;
}
#${attachmentModalId} .plm-extension-bom-clone-loading-center .generic-loader > div{
  width:16px;
  height:16px;
  background-color:#149cd8;
  border-radius:100%;
  display:inline-block;
  animation:plm-extension-bom-clone-bouncedelay 1.4s infinite ease-in-out both;
  margin:0 3px;
}
#${attachmentModalId} .plm-extension-bom-clone-loading-center .generic-loader .bounce1{
  animation-delay:-0.32s;
}
#${attachmentModalId} .plm-extension-bom-clone-loading-center .generic-loader .bounce2{
  animation-delay:-0.16s;
}
#${attachmentModalId} .plm-extension-bom-clone-loading-text{
  color:#4b637a;
  font:600 12px/1.25 var(--plm-bom-font-sans);
}
#${attachmentModalId} .plm-extension-bom-attachment-download-btn{
  min-height:34px;
  border-radius:8px;
  padding:0 14px;
  font:600 12px/1 var(--plm-bom-font-sans);
  cursor:pointer;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-btn--secondary{
  border:1px solid #ccd7e2;
  background:#fff;
  color:#203246;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-btn--primary{
  border:1px solid #149cd8;
  background:#149cd8;
  color:#fff;
}
#${attachmentModalId} .plm-extension-bom-attachment-download-btn--primary:disabled{
  opacity:.55;
  cursor:not-allowed;
}
@media (max-width: 720px){
  #${attachmentModalId} .plm-extension-bom-attachment-download-layout,
  #${attachmentModalId} .plm-extension-bom-attachment-download-grid,
  #${attachmentModalId} .plm-extension-bom-attachment-download-date-row{
    grid-template-columns:minmax(0,1fr);
  }
  #${attachmentModalId} .plm-extension-bom-attachment-download-layout{
    overflow:auto;
  }
  #${attachmentModalId} .plm-extension-bom-attachment-download-extension-row{
    grid-template-columns:minmax(0,1fr);
  }
  #${attachmentModalId} .plm-extension-bom-attachment-download-footer{
    justify-content:flex-end;
  }
}
`
}
