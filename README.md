# Academic Curriculum Workload & Timetable Policy Simulator

The Allocation Dashboard now includes an interactive curriculum workload
simulator alongside the existing teacher and subject allocation views. The
simulator opens from the **Curriculum Simulator** dashboard tab and models
Classes 1–11 using the supplied curriculum dataset.

The curriculum simulator is a static HTML feature embedded within the
authenticated dashboard. The dashboard itself still uses Google sign-in and
the Apps Script backend described below; no additional server or package
dependencies are required.

This project is hosted as a static site on GitHub Pages. Google Apps Script
provides the authenticated backend for Google Sheets and Drive.

## Architecture

```text
GitHub Pages
  └── index.html + config.js
      └── Google Identity Services sign-in
          └── Apps Script Web App
              ├── Google Sheets read/write
              └── Google Drive teacher photos
```

GitHub Pages never receives a service-account key. `config.js` contains only
the OAuth client ID and Apps Script URL, which are public identifiers.

## Curriculum simulator

- **Dashboard & Matrix:** edit periods and page counts, filter by class, search
  and sort subjects, show or hide zero-period books, and switch between weekly
  periods and annual hours.
- **Reallocation Engine:** transfer periods from a donor subject into a
  class-scoped pool, assign the pool to a recipient, preview pace changes, and
  undo completed reallocations.
- **Timetable & Policy:** configure weekday and Saturday schedules and breaks,
  compare 35-minute and 30-minute periods, map subjects to weekly slots, and
  check the weekly capacity.
- **Audit & Export:** compare baseline with revised loads and download CSV or
  JSON reports, or print a summary.
- **Google Sheets:** load a published-to-web CSV sheet with columns for book
  name, class, periods, and pages.

The simulator's data and interface are kept in
[`curriculum-simulator.html`](./curriculum-simulator.html); it is embedded in
the authenticated dashboard so its styles and controls remain isolated from
the allocation views. Its defaults are 30 teaching weeks and 35-minute
periods. Teaching pace is calculated as pages divided by annual teaching
hours.

### Schedule defaults and calculations

| Setting | Default |
|---|---|
| Mon–Fri schedule | 08:50–15:45 |
| Tea break | 10:35–10:55 |
| Lunch break | 12:40–14:00 |
| Saturday schedule | 08:15–13:15 |
| Teaching weeks | 30 |
| Period duration | 35 minutes |

Weekly hours are `periods × duration / 60`; annual hours multiply weekly
hours by teaching weeks. The policy cards show aggregate capacity based on
total net teaching minutes, alongside the break-aligned slot count used by
the visual timetable and its capacity warning.

## Configure the Apps Script backend

1. Create or open a Google Apps Script project.
2. Copy `apps-script/Code.gs` into the Apps Script editor.
3. Set `spreadsheetId`, `googleClientId`, `sheetName`, and `photoFolderId` in `CONFIG`.
4. Enable the Apps Script services requested on first run.
5. Deploy as **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployed `/exec` URL into `config.js` as `backendUrl`.

After changing `Code.gs`, create a new deployment version (or update the
existing Web app deployment) before testing. A stale deployment can redirect
requests to a `script.googleusercontent.com` URL that returns 404 even when
the `/exec` URL is still reachable.

The spreadsheet and photo folder must be accessible to the Google account that
owns the Apps Script project. The allow-list in `Code.gs` controls dashboard
access.

## Configure Google sign-in

Create a Web application OAuth client in Google Cloud Console and add the
GitHub Pages origin to the authorised JavaScript origins, for example:

```text
https://YOUR-USER.github.io
https://YOUR-USER.github.io/allocation
```

Put the same client ID in `config.js` as `googleClientId` and in the Apps
Script `CONFIG.googleClientId`. Do not put a client secret or service-account
JSON in this repository.

## Publish with GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, choose **Deploy from a branch**.
3. Select the `main` branch and `/ (root)`.
4. Open the generated Pages URL.

## Local testing

Because Google sign-in requires an origin, use a local static server rather
than opening `index.html` directly:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000` and add that origin to the OAuth client while
testing. Use the browser DevTools Console and Network tabs to inspect sign-in,
`data`, `photos`, and `sync` requests. Apps Script execution logs are
available under **Executions** in the Apps Script editor.

## Mobile behavior

The dashboard uses a responsive navigation bar, horizontally scrollable
workload tables, compact class selectors, and a stacked teacher view on small
screens. Use Chrome DevTools device emulation to test narrow widths and touch
interactions.

## Distribution dashboards

- **Daerat Distribution** groups the `Ustad_Daera` values from the configured
  `1449Working` tab into columns and lists every teacher with a Daera assignment,
  using the 1449 weekly period values in each cell.
- **Subject Distribution** can be filtered by subject, class, and optionally
  book name. It lists teacher, class/section, book, and either 1449 weekly or
  the detected `1448Tafweed` history value.
- **Al-Masʾūl** lays out the first 55 matching weekly periods in an 11-row by
  5-column grid. Each populated period shows the assigned teacher and provides
  the same inline teacher reassignment control used elsewhere in the dashboard.
- The sheet-tab lookup is case-insensitive, so `1449Working` and
  `1449working` both resolve to the configured tab.

## Security notes

- Keep `config.js` limited to public identifiers.
- Keep the Apps Script deployment restricted to the intended Google accounts
  through `allowedEmails`.
- Redeploy the Apps Script after changing `Code.gs`.
