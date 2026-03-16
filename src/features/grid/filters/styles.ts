import {
  GRID_ACTIONS_ID,
  GRID_ADD_RULE_ID,
  GRID_APPLY_BUTTON_ID,
  GRID_CLEAR_BUTTON_ID,
  GRID_COUNT_ID,
  GRID_EXPORT_BUTTON_ID,
  GRID_EXPORT_PROGRESS_FILL_ID,
  GRID_EXPORT_PROGRESS_ID,
  GRID_EXPORT_PROGRESS_TEXT_ID,
  GRID_EXPORT_PROGRESS_TRACK_ID,
  GRID_FILTER_TOGGLE_BUTTON_ID,
  GRID_PANEL_ID,
  GRID_PANEL_HEADER_ID,
  GRID_PANEL_TITLE_ID,
  GRID_ROW_HIDDEN_CLASS,
  GRID_RULES_ID
} from './constants'
import { GRID_SUMMARY_COUNT_ID, GRID_SUMMARY_LIST_ID, GRID_SUMMARY_ID } from './model'

/**
 * Build panel stylesheet in one place so UI concerns stay out of page lifecycle code.
 */
export function getGridPanelStyleText(): string {
  return [
    `#${GRID_PANEL_ID}{position:relative;margin:0 0 8px;padding:8px 10px;border:1px solid #d8e1eb;border-radius:10px;background:rgba(204, 204, 204, 0.2);font-family:"ArtifaktElement","Segoe UI",Arial,sans-serif;}`,
    `#${GRID_PANEL_HEADER_ID}{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 6px;}`,
    `#${GRID_PANEL_TITLE_ID}{display:flex;flex-direction:column;align-items:flex-start;gap:3px;}`,
    `#${GRID_PANEL_TITLE_ID} .plm-extension-grid-title{font:700 13px/1.1 "ArtifaktElement","Segoe UI",Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#44566c;}`,
    `#${GRID_PANEL_TITLE_ID} .plm-extension-grid-subtitle{font:500 12px/1.35 "ArtifaktElement","Segoe UI",Arial,sans-serif;color:#4f647b;}`,
    `#${GRID_ADD_RULE_ID},#${GRID_APPLY_BUTTON_ID},#${GRID_CLEAR_BUTTON_ID},#${GRID_FILTER_TOGGLE_BUTTON_ID},#${GRID_EXPORT_BUTTON_ID}{display:inline-flex;align-items:center;justify-content:center;position:relative;box-sizing:border-box;-webkit-tap-highlight-color:transparent;outline:0;margin:0;user-select:none;vertical-align:middle;appearance:none;text-decoration:none;letter-spacing:normal;box-shadow:none;font-family:"ArtifaktElement","Segoe UI",Arial,sans-serif;font-size:14px;font-weight:600;height:36px;line-height:20px;min-width:52px;padding:8px 16px;text-transform:initial;transition:box-shadow 300ms cubic-bezier(0.4,0,0.2,1),background-color 120ms ease,border-color 120ms ease,color 120ms ease;white-space:nowrap;overflow:hidden;}`,
    `#${GRID_ADD_RULE_ID}:disabled,#${GRID_APPLY_BUTTON_ID}:disabled,#${GRID_CLEAR_BUTTON_ID}:disabled,#${GRID_FILTER_TOGGLE_BUTTON_ID}:disabled,#${GRID_EXPORT_BUTTON_ID}:disabled{opacity:.55;cursor:default;box-shadow:none;}`,
    `#${GRID_PANEL_ID} .plm-extension-grid-header-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}`,
    `#${GRID_COUNT_ID}{display:inline-flex;align-items:center;justify-content:center;min-width:96px;height:36px;padding:0 12px;border:1px solid #c7d2e0;border-radius:999px;background:#f8fbff;color:#274c77;font:700 12px/1 "ArtifaktElement","Segoe UI",Arial,sans-serif;}`,
    `#${GRID_RULES_ID}{display:flex;flex-direction:column;gap:6px;align-items:stretch;width:100%;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-header,#${GRID_RULES_ID} .plm-extension-grid-rule-row{display:grid;grid-template-columns:minmax(220px,1.6fr) 86px minmax(150px,1fr) minmax(360px,2.4fr) 40px 40px;gap:8px;align-items:center;width:100%;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-header{padding:0 1px 2px;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-header-label{font:700 13px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#486079;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-header-spacer{height:1px;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-row .plm-extension-grid-rule-placeholder{height:30px;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-value-slot{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0;width:100%;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-value-slot--between{grid-template-columns:minmax(0,1fr) minmax(0,1fr);}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-row select,#${GRID_RULES_ID} .plm-extension-grid-rule-row input{height:32px;padding:0 10px;border:1px solid #cfd8e3;border-radius:8px;background:#fff;color:#111827;font:500 12px/1 "ArtifaktElement","Segoe UI",Arial,sans-serif;outline:none;box-sizing:border-box;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-row select:focus,#${GRID_RULES_ID} .plm-extension-grid-rule-row input:focus{border-color:#7cb9dd;box-shadow:0 0 0 2px rgba(31,156,220,0.12);}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-row input[type="checkbox"]{width:18px;height:18px;padding:0;margin-left:6px;border:none;box-shadow:none;accent-color:#149cd8;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-remove,#${GRID_RULES_ID} .plm-extension-grid-rule-add{width:40px;height:34px;border-radius:9px;padding:0;display:inline-flex;align-items:center;justify-content:center;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-rule-remove .zmdi,#${GRID_RULES_ID} .plm-extension-grid-rule-add .zmdi{font-size:18px;line-height:1;}`,
    `#${GRID_RULES_ID} .plm-extension-grid-empty{padding:8px 10px;border:1px dashed #d6deea;border-radius:8px;background:#f8fafc;color:#64748b;font:500 12px/1.35 "ArtifaktElement","Segoe UI",Arial,sans-serif;}`,
    `#${GRID_EXPORT_PROGRESS_ID}{display:none;align-items:center;gap:10px;margin:8px 0 0;}`,
    `#${GRID_EXPORT_PROGRESS_TEXT_ID}{min-width:130px;font:600 11px/1 Segoe UI,Arial,sans-serif;color:#3f5872;white-space:nowrap;}`,
    `#${GRID_EXPORT_PROGRESS_TRACK_ID}{position:relative;flex:1;height:6px;border-radius:999px;background:#dce8f5;overflow:hidden;}`,
    `#${GRID_EXPORT_PROGRESS_FILL_ID}{position:absolute;left:0;top:0;height:100%;width:0;background:linear-gradient(90deg,#1f9cdc 0%,#2563eb 100%);transition:width 120ms ease;}`,
    `#${GRID_ACTIONS_ID}{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:8px;}`,
    `#${GRID_SUMMARY_ID}{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:0 0 10px;padding:8px 10px;border:1px solid #d8e1eb;border-radius:10px;background:#f8fbff;}`,
    `#${GRID_SUMMARY_COUNT_ID}{display:inline-flex;align-items:center;justify-content:center;min-width:96px;height:28px;padding:0 10px;border:1px solid #c7d2e0;border-radius:999px;background:#fff;color:#274c77;font:700 11px/1 Segoe UI,Arial,sans-serif;white-space:nowrap;}`,
    `#${GRID_SUMMARY_LIST_ID}{display:flex;flex-wrap:wrap;gap:6px;min-height:28px;}`,
    `#${GRID_SUMMARY_LIST_ID} .plm-extension-grid-chip-empty{padding:4px 8px;border:1px dashed #cfd8e3;border-radius:999px;color:#64748b;font:500 11px/1.2 Segoe UI,Arial,sans-serif;background:#fff;}`,
    `#${GRID_SUMMARY_LIST_ID} .plm-extension-grid-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #c8d9ea;border-radius:999px;background:#fff;color:#1f3f62;font:600 11px/1.2 Segoe UI,Arial,sans-serif;}`,
    `#${GRID_SUMMARY_LIST_ID} .plm-extension-grid-chip-label{max-width:480px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}`,
    `#${GRID_SUMMARY_LIST_ID} .plm-extension-grid-chip-remove{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:999px;background:transparent;color:#5b6f87;cursor:pointer;}`,
    `#${GRID_SUMMARY_LIST_ID} .plm-extension-grid-chip-remove:hover{background:#eaf3fc;color:#1f4a75;}`,
    `#${GRID_SUMMARY_LIST_ID} .plm-extension-grid-chip-remove .zmdi{font-size:14px;line-height:1;}`,
    `#${GRID_FILTER_TOGGLE_BUTTON_ID}{gap:6px;}`,
    `#${GRID_FILTER_TOGGLE_BUTTON_ID} .icon-Filter{display:inline-block;line-height:1;}`,
    `#${GRID_FILTER_TOGGLE_BUTTON_ID} .plm-extension-grid-filter-text{line-height:1;}`,
    `#${GRID_EXPORT_BUTTON_ID}{gap:6px;}`,
    `#${GRID_EXPORT_BUTTON_ID} .export-excel-btn{width:16px;height:16px;display:block;}`,
    `#${GRID_EXPORT_BUTTON_ID} .plm-extension-grid-export-text{line-height:1;}`,
    `#${GRID_FILTER_TOGGLE_BUTTON_ID}[aria-pressed="true"]{background-color:#149cd8;border-color:#149cd8;color:#fff;}`,
    `#${GRID_FILTER_TOGGLE_BUTTON_ID}[aria-pressed="true"]:hover{background-color:#0e8cc3;border-color:#0e8cc3;color:#fff;}`
  ].join('')
}

export function getGridHiddenRowsStyleText(): string {
  return `.${GRID_ROW_HIDDEN_CLASS}{display:none !important;}`
}
