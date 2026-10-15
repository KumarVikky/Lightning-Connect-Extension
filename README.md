# Lightning Connect

Lightning Connect is a Chrome Extension (Manifest V3) for working with Salesforce metadata, records, queries, and developer resources from a focused workspace. It runs inside supported Salesforce domains, reuses the signed-in Salesforce session, and opens each workflow in a dedicated extension tab.

## What it provides

### Salesforce launcher

The content script adds a floating **Salesforce Connect** launcher to Salesforce pages. The launcher is limited to Salesforce host permissions and provides quick access to the workflows below:

- **Data Export** - choose Salesforce objects, inspect fields, build SOQL queries with suggestions, execute queries, browse paginated results, inspect related records, and export or copy results.
- **Data Import** - prepare record operations for objects that support create, update, upsert, or delete. Records can be entered manually, uploaded from CSV/Excel files, or pasted as tabular data. The workflow supports field selection, picklists, column mapping, validation, staged-record review, saved mappings, and CRUD execution controls.
- **Data View** - inspect Salesforce object and record data from the launcher, including record details and metadata-backed views where available.
- **Download Metadata** - browse and download Salesforce metadata resources through the Salesforce APIs.
- **Developer Console** - work with Apex, Aura, Lightning Web Components, Visualforce, Lightning Message Channels, and related Tooling API resources in a Monaco-based editor and explorer.

The home page also displays the connected organization, organization type, API version, current user, and profile image when the Salesforce session is available.

## Settings

The Settings page contains persistent preferences for the extension, including:

- Salesforce API version and theme
- Data Export editor, explorer, query-history, table, pagination, and download preferences
- Data Import operation defaults, input mode, required-field behavior, processing settings, staged-table appearance, panel sizing, and saved-mapping behavior
- Developer Console editor, layout, logging, and explorer preferences

Preferences are stored with `chrome.storage.local` and are broadcast to open workflow tabs so supported UI changes can apply without reopening the page.

## Salesforce integration

Salesforce requests are centralized in `app/modules/salesforce-api.js`. The extension reads the Salesforce `sid` cookie through the Chrome cookies permission and uses the active Salesforce origin when making REST, Tooling API, metadata, describe, query, and sObject requests.

If the session expires or the cookie is unavailable, the UI reports a session error and asks the user to sign in to Salesforce again. The extension does not require a separate Salesforce password or API token.

## Project structure

```text
app/
  features/          Data Export, Data Import, Data View, Metadata, Developer Console
  modules/           Salesforce API, preferences, page chrome, SOQL language support
  home.html/js/css   Main workflow shell and Salesforce session header
  settings.html/js   Preferences UI
background.js        Extension service worker and cross-page Salesforce operations
content-script.js    Salesforce-page launcher and quick actions
manifest.json        Chrome MV3 permissions, hosts, scripts, and resources
tests/               Node-based tests for shared language behavior
```

## Requirements

- Google Chrome or another Chromium browser with Manifest V3 support
- A Salesforce session in one of the supported Salesforce domains
- Node.js and npm for local development and production builds

## Development

Install dependencies:

```bash
npm install
```

Run the Vite development server:

```bash
npm run dev
```

Create the extension build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

To load the extension in Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the generated extension directory described by the project’s Vite configuration. Reload the extension after rebuilding.

## Permissions and privacy

The manifest requests `cookies`, `storage`, `tabs`, and `activeTab`, plus host access for supported Salesforce domains. These permissions are used to identify the current Salesforce session, persist local preferences and mappings, open workflow tabs, and communicate with the active Salesforce page.

Saved mappings and preferences are kept locally in the browser. Salesforce data is requested only from the Salesforce origin selected by the workflow. A local proxy is not part of the default architecture.

## Current limitations

- Salesforce permissions, object permissions, field-level security, API limits, and session state can restrict results or operations.
- Some workflows require a currently authenticated Salesforce tab and a valid `sid` cookie.
- Browser extension APIs and Salesforce CORS/cookie policies can vary between Salesforce domains and browser environments.
- CRUD and metadata actions should be reviewed carefully in a non-production org before being used against production data.
