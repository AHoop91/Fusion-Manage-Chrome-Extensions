# Privacy Policy

## Fusion Manage Extensions

Fusion Manage Extensions is a browser extension for Autodesk Fusion Manage pages.
It adds workflow helpers inside supported pages such as item details, grid, BOM, design components, and related PLM views.

## Unofficial Project Notice

This is an independent custom extension. It is not an Autodesk product and is not supported or maintained by Autodesk.
Use of the extension is at your own discretion.

## What The Extension Uses

The extension uses data already available to the signed-in user in Fusion Manage so it can:

- show item-details helpers
- filter and edit grid rows (including import workflows where enabled)
- support BOM workflows
- support design-component translation and download helpers where enabled
- show a popup listing features shipped in the build and optional per-browser toggles

This may include Fusion Manage record data returned by Autodesk APIs while the user is actively using a feature.

## Sign-in

- **You sign in only on Fusion Manage** in the browser, the same way you do without the extension. The extension does not provide its own login screen.
- When you use a feature, API calls go to **Autodesk Fusion Manage** as you—the same sign-in as the website.
- If you sign out of Fusion Manage, extension features stop working until you sign in again on the website.

## Storage

The extension uses the browser **`storage` permission** only for **settings** (feature toggles and UI preferences).

**Saved by the extension:**

- which features you have turned on in this browser (where the build allows popup overrides)
- item-details UI preferences, such as section visibility and “hide empty” options

**Not saved by the extension:**

- full item, grid, or BOM datasets for tracking or analytics

You can clear saved feature overrides from the extension popup (**Reset browser overrides**). Removing the extension or clearing its data in Chrome removes stored settings.

## How Network Requests Work

The extension sends requests only to Autodesk services required for the feature you are actively using. No separate analytics or advertising service is used.

## No Remote Code

The extension does not download and execute remote code.
All extension code run in the browser is packaged with the extension itself.

## Retention

- Extension settings remain until you clear them in the popup, remove extension data in Chrome, or uninstall the extension.

## Contact / Operator

This project is an independent custom extension and is not an Autodesk product.
If you publish this extension to the Chrome Web Store, replace this section with your support contact and published privacy-policy URL.
