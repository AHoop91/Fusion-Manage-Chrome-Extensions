import { ensureStyleTag } from '../dom/styles'

const DEFAULT_MODAL_ID = 'plm-extension-bom-clone-modal'
const DEFAULT_STYLE_ID = 'plm-extension-search-styles'

// Shell styles for BOM clone / item selector (layout chrome, mode toggle, group joins, etc.).
// Search dialog layout, fields, and result lists live in
// `features/cross-feature-ui/search-dialog-modal/searchDialogModal.styles.ts` (ensureSearchDialogModalStyles).
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
