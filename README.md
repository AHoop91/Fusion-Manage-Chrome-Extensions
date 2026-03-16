# Fusion Manage Chromium Extensions

Fusion Manage Chromium Extensions is a Chrome extension that improves day-to-day workflows in Autodesk Fusion Manage.
It adds practical UI actions, filtering tools, and quality-of-life improvements directly inside supported pages.

## Unofficial Project Notice

This project is an independent, custom-built extension for Autodesk Fusion Manage. It is **not** an official Autodesk product and is not supported, endorsed, or maintained by Autodesk. It integrates with Autodesk Fusion Manage through supported web and API interactions.

## Disclaimer

This project is provided **"as is"** without warranties of any kind, express or implied, including but not limited to reliability, accuracy, completeness, or fitness for a particular purpose. Use of this software is at your own discretion and risk.

## Table of Contents

- [What Users Can Do](#what-users-can-do)
- [Supported Pages](#supported-pages)
- [User Guide](#user-guide)
- [Quick Setup (Local)](#quick-setup-local)
- [Useful Commands](#useful-commands)
- [Permissions and Host Scope](#permissions-and-host-scope)
- [Authentication and Privacy](#authentication-and-privacy)
- [Additional Documentation](#additional-documentation)

## What Users Can Do

### 1) Item Details Improvements
- Hide empty fields in view mode for cleaner records.
- Quickly focus on required fields in edit mode.
- Use section visibility helpers to reduce scrolling.
- Access command-bar shortcuts and linked-item navigation helpers.

These item page enhancements are meant to make busy Fusion Manage records easier to read and work with. Instead of forcing users to scan long forms full of empty or low-value fields, the extension helps surface the parts of the page that matter most for the current task. That is especially useful when reviewing dense records, entering data quickly, or moving between related records during everyday support, engineering, or operations workflows.

[Image Placeholder: Item Details page with empty-field hiding and required-only mode]

### 2) Grid Enhancements
- Build advanced filter conditions for complex table searches.
- Open the Advanced Editor to stage row changes more safely.
- Export visible grid rows to CSV.

The grid tools are designed for large tables where the standard page experience can become slow to review or awkward to edit. Advanced filtering helps narrow results without leaving the page, while the Advanced Editor gives users a safer staging step before committing row changes. CSV export then makes it easy to take the filtered result set outside the system for review, handoff, or audit support.

Advanced filtering view:
[Image Placeholder: Grid advanced filtering view]

Advanced editor workflow:
[Image Placeholder: Grid advanced editor workflow]

[Image Placeholder: Grid CSV export action]

### 3) BOM Clone Workflow
- Launch Clone from the BOM tab.
- Search and validate a source item.
- Stage add/update/delete actions before committing.
- Review staged counts and commit when ready.

The BOM Clone workflow is built to reduce the effort and risk involved in copying or shaping BOM structures. Instead of jumping between pages and making changes directly against the target structure, users can search for a source, validate what they want to bring across, and review staged actions before committing anything. That makes the workflow easier to reason about, especially when dealing with larger structures or more sensitive manufacturing changes.

[Image Placeholder: Clone BOM search screen]
[Image Placeholder: Clone BOM structure/target staging screen]

### 4) Security Users Enhancements
- Filter users quickly in the admin users table.
- Export visible user rows to CSV.

The admin users helpers focus on speed and clarity when working with large user lists. Filtering makes it easier to find the exact accounts relevant to the current task, and exporting the visible rows gives administrators a quick way to capture the filtered result set for review, reporting, or communication with other teams. The goal is to remove repetitive manual scanning from common admin work.

[Image Placeholder: Security users filters and export]

### 5) Health Dashboard (Extension Popup)
- See whether extension features are active on the current page.
- View status per area (Enabled / Disabled / Unknown).
- See diagnostics when a page is partially compatible.

The popup health dashboard acts as a quick confidence check for the current page. It helps users understand whether the extension should be working where they are, which feature areas are active, and whether a page is only partially compatible. That can save time when troubleshooting because it gives a clearer signal than simply seeing that a button or workflow is missing.

[Image Placeholder: Popup health dashboard]

## Supported Pages

- Item details and add-item pages
- Grid pages
- BOM pages (Clone workflow)
- Security/Admin users pages

## User Guide

The extension loads automatically on supported Fusion Manage pages and augments the existing UI without replacing the native page. Availability still depends on the current page layout, workspace permissions, and the active Fusion Manage browser session.

### Item Details

- Hide Empty Fields reduces visual noise on supported read-only layouts by collapsing empty structure without changing record data.
- Required Only helps surface mandatory inputs during editing so long forms are easier to review and complete.
- Search helpers and linked-item actions reduce page-to-page friction on supported item details and add-item flows.
- These helpers only activate where the page structure matches supported layouts.

### Grid

- Advanced Filters help narrow large result sets directly in the current grid view.
- Advanced Editor supports staged add, edit, clone, revert, and remove workflows so changes can be reviewed before commit.
- CSV Export downloads the currently visible rows after filtering.
- Some actions are permission-gated, so available controls can differ by workspace and user.

### BOM Clone

- BOM Clone starts with source item search and validation before loading the heavier staging workflow.
- The engineering flow focuses on source-to-target BOM comparison, staged row edits, and optional add-existing/linkable item actions.
- The manufacturing flow adds process-oriented placement, split behavior, and staged process detail editing where supported.
- Users should always review staged changes, permissions, and required-field blockers before commit.

### Admin Users

- Filter Users Table helps narrow large admin user lists faster.
- Export Visible Users downloads the current filtered result set to CSV for review or handoff.
- This area depends on the supported users table layout remaining compatible.

### Health Dashboard

- The popup shows whether the extension is active, degraded, or unsupported on the current page.
- A feature status list helps identify which feature groups are currently available.
- Diagnostics can surface selector mismatches or partially compatible pages without storing full page URLs in session diagnostics.

### Support Boundaries

- This is an independent extension, not an Autodesk product.
- It is not supported or maintained by Autodesk.
- Not every custom tenant layout or view is guaranteed to be supported.
- Use it at your own discretion and review staged mutations carefully before commit.

## Quick Setup (Local)

If you want to try the extension locally in Chrome, follow these steps.
You do not need to publish anything first, but you do need Node.js installed on your computer.

### Before You Start

- Install **Node.js**.
  The simplest option is the current LTS version from `https://nodejs.org/`.
- Make sure this project is downloaded to your computer.
- Open a terminal in the project folder.

If you are not used to command-line tools, that just means opening PowerShell, Command Prompt, or Terminal in the folder that contains this `README.md`.

### Step 1: Install Project Dependencies

Run:

```bash
npm install
```

What this does:
- Downloads the libraries and build tools the extension needs.
- You usually only need to do this once, unless dependencies change.

### Step 2: Build the Extension

Run:

```bash
npm run build
```

What this does:
- Creates a production-ready build of the extension.
- Puts the final files into the `dist/` folder.

When the build finishes successfully, `dist/` is the folder you will load into Chrome.

### Step 3: Load the Extension in Chrome

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `dist/` folder from this project.

After that, the extension should appear in your extensions list and be available on supported Fusion Manage pages.

### Step 4: Use and Refresh It

- Open a supported Autodesk Fusion Manage page.
- The extension activates automatically where supported.
- If you change the code later, run `npm run build` again.
- Then go back to `chrome://extensions` and click the refresh/reload icon for the extension.

### If Something Does Not Work

- Make sure `npm run build` finished without errors.
- Make sure you selected the `dist/` folder, not the project root folder.
- If Chrome still shows an older version, reload the extension from `chrome://extensions`.
- If Fusion Manage was already open, refresh that browser tab after reloading the extension.

### Fast Summary

```bash
npm install
npm run build
```

Then:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Choose `dist/`

## Useful Commands

- `npm run dev` - Start development workflow
- `npm run build` - Build extension assets into `dist/`
- `npm run check:boundaries` - Run architecture boundary checks
- `npm run preview` - Preview built assets

## Permissions and Host Scope

From `public/manifest.json`:

- Permissions: `activeTab`, `storage`
- Host permissions:
  - `https://*.autodeskplm360.net/plm/*`
  - `https://*.autodeskplm360.net/admin*`

## Authentication and Privacy

- The extension is designed to work with your existing Fusion Manage sign-in session rather than asking you to manage separate credentials inside the extension.
- If your Fusion Manage session expires, some extension actions may stop working until you sign in again in Fusion Manage.
- Diagnostic information used by the popup is kept temporary and limited to what is needed to show feature health and compatibility status.
- Some extension settings may be saved so your preferences can persist across browser sessions.
- See [`PRIVACY.md`](./PRIVACY.md) for the full privacy policy text suitable for Chrome Web Store disclosure.

## Additional Documentation

- Architecture rules: `architecture.md`
- Grid feature spec: `src/features/grid/specification.md`
- Item details feature spec: `src/features/item-details/specification.md`
