# Privacy Policy

## Fusion Manage Extensions

Fusion Manage Extensions is a browser extension for Autodesk Fusion Manage pages.
It adds workflow helpers inside supported pages such as item details, grid, BOM, and security users views.

## Unofficial Project Notice

This is an independent custom extension. It is not an Autodesk product and is not supported or maintained by Autodesk.
Use of the extension is at your own discretion.

## What The Extension Uses

The extension uses data already available to the signed-in user in Fusion Manage so it can:
- show item-details helpers
- filter and edit grid rows
- support BOM clone workflows
- show popup health status for supported pages

This may include Fusion Manage record data returned by Autodesk APIs while the user is actively using a feature.

## Authentication

- The extension does not scrape OAuth or bearer tokens from webpage storage.
- The extension does not persist Fusion Manage auth tokens.
- Background API requests rely on the active Fusion Manage browser session using browser-managed session cookies.

## What The Extension Stores

The extension stores only the minimum extension data needed for settings and runtime behavior:
- user preferences in extension storage, such as view and filter settings
- session-only health diagnostics used by the popup and badge

Health diagnostics are stored in `chrome.storage.session`, not persistent local storage, and are cleared when the browser session ends.

Stored health diagnostics include:
- page signature
- health status
- missing selector list
- disabled feature list
- schema version
- extension version
- timestamp

The extension does not store full page URLs in health diagnostics.

## What The Extension Does Not Store

The extension does not locally store:
- Fusion Manage auth tokens
- passwords
- session cookies
- full item, grid, or BOM datasets for general tracking
- full page URLs in health diagnostics

## How Network Requests Work

The extension sends requests only to Autodesk Fusion Manage endpoints needed to perform the feature the user is actively using.
No separate analytics or advertising service is used.

## No Remote Code

The extension does not download and execute remote code.
All extension code run in the browser is packaged with the extension itself.

## Retention

- settings remain in extension storage until removed by the user or the extension is uninstalled
- session health diagnostics are cleared when the browser session ends

## Contact / Operator

This project is an independent custom extension and is not an Autodesk product.
If you publish this extension to the Chrome Web Store, replace this section with your support contact and published privacy-policy URL.
