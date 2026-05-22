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

## Sign-in and session

- **You sign in only on Fusion Manage** in the browser, the same way you do without the extension. The extension does not provide its own login screen and does not ask for your password.
- While you are signed in on a supported Fusion Manage page, the extension can call Autodesk APIs **as you**, using the session the Fusion Manage web app already established in that browser.
- If you sign out of Fusion Manage or your session expires, extension features stop working until you sign in again on the website.

## Authentication (API access)

- API calls run **only when you use a feature** and are sent to **Autodesk services** required for that feature (Fusion Manage PLM, and where enabled, services such as Model Derivative).
- Requests use your **existing browser session** (`credentials: include`) so Fusion Manage and related Autodesk cookies authenticate each call.
- The extension does **not** read OAuth access tokens from Fusion Manage page storage (for example `localStorage`), copy your password, or save sign-in credentials in extension storage.

## Storage

The extension uses the browser **`storage` permission** only to keep **settings**, not for sign-in.

**Saved by the extension:**

- which features you have turned on in this browser (where the build allows popup overrides)
- item-details UI preferences, such as section visibility and “hide empty” options

**Not saved by the extension:**

- your Fusion Manage password
- OAuth access tokens or other sign-in secrets from the Fusion Manage web app
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
