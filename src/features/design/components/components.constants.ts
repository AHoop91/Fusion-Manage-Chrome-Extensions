import type { DerivativeOutputType } from './components.types'
import type { FormatOptionField } from './components.types'

export const DESIGN_COMPONENTS_STYLE_ID = 'plm-ext-design-components-styles'
export const DESIGN_COMPONENTS_MODAL_ID = 'plm-ext-design-components-conversion-modal'
export const DESIGN_COMPONENTS_ACTION_WRAPPER_ID = 'plm-extension-design-components-action'

export const DESIGN_COMPONENTS_LEGACY_BUTTON_SELECTOR =
  '.plm-ext-design-components-styles-wrap,.plm-ext-design-components-styles-btn'

export const DESIGN_COMPONENTS_STATUS_ROW_ID = 'itemviewer-item-header'

export const DESIGN_COMPONENTS_ICON_CLASS = 'plm-ext-design-components-icon'

export const DESIGN_COMPONENTS_POLL_INTERVAL_MS = 2500
export const DESIGN_COMPONENTS_MAX_POLL_ATTEMPTS = 60


export const DESIGN_COMPONENTS_MODAL_CSS = `
#${DESIGN_COMPONENTS_MODAL_ID}{
  --plm-dc-f:"ArtifaktElement","Segoe UI",Arial,sans-serif;
  position:fixed;inset:0;background:rgba(15,23,42,.32);
  display:flex;align-items:center;justify-content:center;
  z-index:2147483647;padding:16px;box-sizing:border-box;
}
#${DESIGN_COMPONENTS_MODAL_ID} [hidden]{display:none!important;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-shell{
  width:min(660px,92vw);max-height:min(82vh,740px);
  display:flex;flex-direction:column;gap:14px;
  padding:26px 28px 22px;
  border:1px solid #dde6ef;border-radius:16px;
  background:#fff;box-shadow:0 24px 48px rgba(15,23,42,.20);
  font-family:var(--plm-dc-f);color:#1f2d3d;overflow:hidden;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-header{
  display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-shrink:0;
  padding-bottom:14px;border-bottom:1px solid #e3ebf3;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-header-copy{display:flex;flex-direction:column;gap:4px;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-title{margin:0;font:700 21px/1.15 var(--plm-dc-f);color:#142435;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-premium-badge{
  display:inline-flex;align-items:center;padding:2px 9px;
  border-radius:20px;border:1px solid #ddd6fe;
  background:#f5f3ff;color:#6d28d9;
  font:500 10px/1.2 var(--plm-dc-f);letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-subtitle{margin:0;font:400 12.5px/1.4 var(--plm-dc-f);color:#51606f;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-charge-notice{
  margin:2px 0 0;font:400 11px/1.5 var(--plm-dc-f);color:#92400e;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-charge-notice a{
  color:#b45309;font-weight:600;text-decoration:none;white-space:nowrap;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-charge-notice a:hover{text-decoration:underline;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-body{
  position:relative;
  display:grid;grid-template-columns:minmax(180px,0.6fr) minmax(260px,1fr);
  gap:20px;flex:1;min-height:0;overflow:hidden;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-col-details{
  display:flex;flex-direction:column;gap:10px;
  border-right:1px solid #e3ebf3;padding-right:20px;overflow:auto;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-col-right{
  display:flex;flex-direction:column;gap:14px;overflow:auto;padding-right:2px;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-section{display:flex;flex-direction:column;gap:8px;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-section-title{
  margin:0;font:700 12.5px/1.2 var(--plm-dc-f);color:#1c3348;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-divider{border:none;border-top:1px solid #e3ebf3;margin:0;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-detail-block{display:flex;flex-direction:column;gap:2px;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-detail-label{
  font:600 11px/1.2 var(--plm-dc-f);color:#7890a7;
  text-transform:uppercase;letter-spacing:0.04em;margin:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-detail-value{
  font:400 12.5px/1.35 var(--plm-dc-f);color:#1f2d3d;margin:0;word-break:break-word;
}
#${DESIGN_COMPONENTS_MODAL_ID} a.plm-ext-dc-detail-value{color:#149cd8;text-decoration:none;}
#${DESIGN_COMPONENTS_MODAL_ID} a.plm-ext-dc-detail-value:hover{text-decoration:underline;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-wrap{display:flex;flex-wrap:wrap;gap:6px;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-card{
  display:inline-flex;align-items:center;gap:7px;
  min-height:34px;padding:0 10px;
  border:1px solid #d4e0eb;border-radius:8px;background:#f9fbfe;
  cursor:pointer;font:600 12px/1.2 var(--plm-dc-f);color:#24374a;
  white-space:nowrap;user-select:none;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-card input[type="radio"]{
  width:14px;height:14px;margin:0;accent-color:#149cd8;cursor:pointer;flex-shrink:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-format-card:has(input:checked){
  border-color:#8ec9e7;background:#eef8fd;box-shadow:0 0 0 1px rgba(20,156,216,.08);
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-label{font:600 11.5px/1.2 var(--plm-dc-f);color:#24374a;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-select,
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-input{
  width:100%;min-height:34px;
  border:1px solid #c8d4e0;border-radius:8px;
  padding:7px 10px;box-sizing:border-box;
  font:400 12.5px/1.3 var(--plm-dc-f);color:#132131;background:#fff;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-select:focus,
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-input:focus{
  outline:none;border-color:#149cd8;box-shadow:0 0 0 3px rgba(20,156,216,.16);
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-input:disabled{
  background:#f7f9fb;color:#94a3b8;cursor:not-allowed;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-filename-wrap{
  display:flex;align-items:center;
  border:1px solid #c8d4e0;border-radius:8px;background:#fff;overflow:hidden;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-filename-wrap:focus-within{
  border-color:#149cd8;box-shadow:0 0 0 3px rgba(20,156,216,.16);
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-filename-wrap--disabled{
  background:#f7f9fb;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-filename-base{
  flex:1;min-width:0;min-height:34px;padding:7px 0 7px 10px;
  border:none;outline:none;background:transparent;
  font:400 12.5px/1.3 var(--plm-dc-f);color:#132131;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-filename-base:disabled{
  color:#94a3b8;cursor:not-allowed;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-filename-ext{
  padding:0 10px;flex-shrink:0;
  font:600 12px/1.3 var(--plm-dc-f);color:#7890a7;white-space:nowrap;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-toggle{
  display:flex;align-items:center;gap:8px;
  font:600 12px/1.3 var(--plm-dc-f);color:#24374a;cursor:pointer;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-toggle input[type="checkbox"]{
  width:15px;height:15px;margin:0;accent-color:#149cd8;cursor:pointer;flex-shrink:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-footer{
  display:flex;align-items:flex-end;gap:10px;
  border-top:1px solid #e0e8f1;padding-top:12px;flex-shrink:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-progress-panel{
  display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-progress-header{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  font:600 12px/1.25 var(--plm-dc-f);color:#21415f;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-progress-track{
  display:block;height:10px;border-radius:3px;background:#deebf5;overflow:hidden;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-progress-fill{
  display:block;height:100%;width:0;border-radius:3px;
  background:linear-gradient(90deg,#149cd8 0%,#3cb5e6 100%);
  transition:width .18s ease;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-progress-fill.indeterminate{
  width:100%!important;transition:none;
  background:linear-gradient(90deg,#149cd8 0%,#3cb5e6 35%,#8dd4f0 50%,#3cb5e6 65%,#149cd8 100%);
  background-size:200% 100%;
  animation:plm-ext-dc-shimmer 1.6s ease-in-out infinite;
}
@keyframes plm-ext-dc-shimmer{
  0%{background-position:200% 0;}
  100%{background-position:-200% 0;}
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:auto;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-primary,
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-secondary{
  min-height:34px;border-radius:8px;padding:0 14px;
  font:600 12px/1 var(--plm-dc-f);cursor:pointer;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-primary{
  border:1px solid #149cd8;background:#149cd8;color:#fff;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-primary:hover:not(:disabled){
  background:#0e8ab8;border-color:#0e8ab8;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-primary:disabled{opacity:.55;cursor:not-allowed;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-secondary{
  border:1px solid #ccd7e2;background:#fff;color:#203246;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-secondary:hover:not(:disabled){background:#f7f9fb;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-btn-secondary:disabled{opacity:.55;cursor:not-allowed;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-err{
  color:#b42318;font:400 12.5px/1.4 var(--plm-dc-f);margin:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-muted{
  color:#697888;font:400 12.5px/1.4 var(--plm-dc-f);margin:0;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-loader{
  position:absolute;inset:0;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:10px;background:#fff;z-index:10;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-overlay{
  position:absolute;inset:0;z-index:20;
  display:flex;align-items:center;justify-content:center;padding:24px;
  background:rgba(15,23,42,.48);
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-dialog{
  width:min(420px,92%);
  display:flex;flex-direction:column;gap:16px;
  padding:26px 28px 22px;
  border:1px solid #dde6ef;border-radius:16px;
  background:#fff;box-shadow:0 24px 48px rgba(15,23,42,.24);
  font-family:var(--plm-dc-f);
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-copy{
  display:flex;flex-direction:column;gap:8px;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-title{
  margin:0;font:700 17px/1.2 var(--plm-dc-f);color:#142435;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-text{
  margin:0;font:400 13px/1.55 var(--plm-dc-f);color:#4b5563;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-actions{
  display:flex;justify-content:flex-end;gap:8px;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-btn{
  min-height:36px;padding:0 14px;border-radius:8px;
  font:600 12px/1 var(--plm-dc-f);cursor:pointer;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-btn--secondary{
  border:1px solid #ccd7e2;background:#fff;color:#203246;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-btn--secondary:hover{background:#f7f9fb;}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-btn--danger{
  border:1px solid #b42318;background:#b42318;color:#fff;
}
#${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-confirm-btn--danger:hover{background:#9b1d12;border-color:#9b1d12;}
.${DESIGN_COMPONENTS_ICON_CLASS}{color:#4a5568;}
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:hover,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:focus,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:active{
  background:#f3f4f6 !important;
  box-shadow:var(--button-hover-shadow,0 0 0 1px #6b7280) !important;
  outline:none !important;border-color:#d1d5db !important;
}
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:hover::before,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:hover::after,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:focus::before,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:focus::after,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:active::before,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button:active::after{
  box-shadow:none !important;border-color:transparent !important;
}
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button .md-ripple-container,
#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID} .md-button .md-ripple{
  background:transparent !important;
  box-shadow:var(--button-hover-shadow,0 0 0 1px #6b7280) !important;
}
@media(max-width:520px){
  #${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-body{grid-template-columns:1fr;}
  #${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-col-details{
    border-right:none;border-bottom:1px solid #e3ebf3;padding-right:0;padding-bottom:12px;
  }
  #${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-footer{flex-direction:column;align-items:stretch;}
  #${DESIGN_COMPONENTS_MODAL_ID} .plm-ext-dc-actions{justify-content:flex-end;}
}
`


export const FORMAT_OPTION_FIELDS: Partial<Record<DerivativeOutputType, FormatOptionField[]>> = {
  step: [
    {
      key: 'applicationProtocol',
      label: 'Protocol',
      options: [
        { value: '203', label: 'AP203 – Surfaces & wireframe' },
        { value: '214', label: 'AP214 – 3D mechanical (default)' },
        { value: '242', label: 'AP242 – With PMI / GD&T' }
      ],
      defaultValue: '214'
    }
  ],
  stl: [
    {
      key: 'exportFileStructure',
      label: 'File structure',
      options: [
        { value: 'single', label: 'Single file (default)' },
        { value: 'multiple', label: 'Multiple files' }
      ],
      defaultValue: 'single'
    },
    {
      key: 'unit',
      label: 'Unit',
      options: [
        { value: 'mm', label: 'Millimetres (default)' },
        { value: 'cm', label: 'Centimetres' },
        { value: 'meter', label: 'Metres' },
        { value: 'inch', label: 'Inches' },
        { value: 'foot', label: 'Feet' }
      ],
      defaultValue: 'mm'
    }
  ],
  obj: [
    {
      key: 'exportFileStructure',
      label: 'File structure',
      options: [
        { value: 'single', label: 'Single file (default)' },
        { value: 'multiple', label: 'Multiple files' }
      ],
      defaultValue: 'single'
    },
    {
      key: 'unit',
      label: 'Unit',
      options: [
        { value: 'mm', label: 'Millimetres (default)' },
        { value: 'cm', label: 'Centimetres' },
        { value: 'meter', label: 'Metres' },
        { value: 'inch', label: 'Inches' },
        { value: 'foot', label: 'Feet' }
      ],
      defaultValue: 'mm'
    }
  ],
  thumbnail: [
    {
      key: 'width',
      label: 'Width',
      options: [
        { value: '100', label: '100 px' },
        { value: '200', label: '200 px' },
        { value: '400', label: '400 px (default)' }
      ],
      defaultValue: '400'
    },
    {
      key: 'height',
      label: 'Height',
      options: [
        { value: '100', label: '100 px' },
        { value: '200', label: '200 px' },
        { value: '400', label: '400 px (default)' }
      ],
      defaultValue: '400'
    }
  ]
}
