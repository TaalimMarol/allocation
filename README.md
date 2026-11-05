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
  ├── index.html (single page, one login: comparison, Asateza Masooliyaat,
  │   subject/class/Al-Masul/daerat dashboards, Musanid Allocation,
  │   embedded Life Skills and Curriculum Simulator)
  └── config.js
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

The dashboard uses the bundled Kanz Al Lulu WOFF2 font from
[`assets/fonts/kanz-al-lulu-regular.woff2`](./assets/fonts/kanz-al-lulu-regular.woff2)
with system fonts as fallbacks.

## Distribution dashboards

- **Teacher workload report** (the **Asateza Masooliyaat** tab, formerly
  "Teacher Workload") opens a print-friendly A4 report for the selected
  teacher while keeping allocation edits in the dashboard. The whole report is
  RTL Arabic. Direct allocations in the teacher's Al-Masʾūl class/section are
  highlighted green. Rows whose `Musaid` value matches the selected teacher's
  name or ITS are shown separately in yellow as MUSANID. The total includes
  direct, Musanid, and department periods.
- **Teacher_Profile** is an optional tab for report metadata, keyed by `ITS`.
  Columns: `ITS`, `NameAR` (the teacher name shown in reports and used in the
  Musanid dropdown; falls back to the `1449Working` name when empty),
  `SequenceNo`, `HifzCertificate`, `Takhassus`, `Idara`, `ServiceDuration`,
  `YearOfCompletion`, `UniversitySanad`, `Category`, and `AppointmentYear`.
  Until populated, these report fields stay blank.
- **Department_Periods** is an optional tab for teaching periods outside the
  teacher's class allocations. Add one row per assignment with columns
  `TeacherITS`, `Subject`, `BookName`, `ClassName` (leave blank when not
  class-based), and `WeeklyPeriods`. Class names without spaces such as `11AM`
  or `3DARSF` are displayed as `11 A M` and `3 DARS F`. The report labels this
  section `حصـص الإدارات`; its periods are included in the top total. No
  `1449Working` row is excluded any more, so department periods can live in
  this tab only.
- **Daerat Distribution** detects every non-empty `Ustad_Daera` value from the
  configured `1449Working` tab, groups those values into columns, and lists
  every teacher with a Daera assignment using the 1449 weekly period values.
  Teacher Workload uses the same field to identify Daera rows and periods.
- **Teacher departments** are read from the `Dept_Allocation` tab and grouped
  by ITS. The tab needs ITS/ITSID, English and Arabic department names,
  designation, and at least one responsibility column. Common header variants
  such as `DepartmentName`, `DepartmentNameAR`, and
  `Dept_responsibilities_master` are supported; master responsibilities may
  contain HTML. Department details can be edited from a teacher's workload
  header, with English and Arabic department names available in both name
  pickers.
- **Teacher Daerat** can be edited from the teacher workload header. The
  change applies to that teacher's allocation rows in `1449Working`; workload
  highlighting and Daerat periods are recalculated only for rows where the
  normalized subject matches the Daerat name.
- **Subject Distribution** shows a cross-campus matrix filtered by subject and
  optionally by book.   Arabic book names are fixed-width, wrapped columns and class/section names
    (for example, `4AM` and `4BF`) are the rows, split into the four Al-Masʾūl
    groups (Cultural Generale a/b, Collegiate one/two). Each cell lists the
  teachers assigned to that book and class (with their photos), shown as first
  and last name without the Mulla/Shaikh/Bhai/Bai honorifics or father's name.
- **Photos** are served as small Drive thumbnails, cached server-side for six
  hours and in the browser (IndexedDB), so repeat visits show them instantly
  while a background refresh updates them. Redeploy `Code.gs` after changing it.
- **Al-Masʾūl** lays out the first 55 matching weekly periods in an 11-row by
  5-column grid. Each populated period shows the assigned teacher and provides
  the same inline teacher reassignment control used elsewhere in the dashboard.
  Each period also shows a check: male Al-Masʾūl teachers must teach Qasaid
  Muntakhabat or Silk Jawhar, and female teachers the Fiqh book with the most
  weekly periods, in the same class, section and gender. For classes 8–11 the
  Al-Masʾūl teacher must instead teach the Adab Fatemi subject there.
  Teachers who do not are highlighted red with what they need.
- The sheet-tab lookup is case-insensitive, so `1449Working` and
  `1449working` both resolve to the configured tab.

## Single page, one login

Everything lives in `index.html` under one Google sign-in: 1448 vs 1449
Comparison, Asateza Masooliyaat, Subject Distribution, Uloom Kauniyah/
Insaniyah, Class Allocation, Al-Masʾūl, Daerat Distribution, Life Skills
teaching, Curriculum Simulator and Musanid Allocation. The old
`Asateza_Masooliyaat.html` page was removed. The Google ID token lasts about an
hour, after which the page asks you to sign in again. Life Skills and the
Curriculum Simulator are embedded as static pages.

## 1448 vs 1449 comparison

- Side-by-side printable reports per teacher (1448 Tafweed and 1449), RTL, with
  dark blue table headers for 1448 and dark green for 1449.
- Subjects that already existed in 1448 are marked red, bold and underlined.
  The match uses class number + subject + book only (section and gender are
  ignored). Books show the Arabic name from `BookName_AR` when present.
- The class column reads numerals first (`1 A M`). The teacher list collapses
  after a selection and reopens on hover.
- Musanid rows appear in their own MUSANID section, and department periods
  (class names included) appear in the 1449 and 1448 reports.

## Musanid Allocation

1. Pick a **Subject**, then optionally filter by **Class** and **Book** (the
   dropdowns cascade).
2. Each row is one book in one class (for example `1 A M`) with its weekly
   periods and current musanid.
3. Choose a teacher (from `Teacher_Profile`, sorted by ITS descending) and
   press **Assign**.    The teacher's ITS number is written to the `Musaid` column of
   `1449Working` (names are shown from `Teacher_Profile` `NameAR`; older name values still work) through the `musaid-sync` action. **Clear musanid** empties it.

Musanid periods count toward the teacher's total and show with a MUSANID badge
in Asateza Masooliyaat and the comparison list. A teacher who exists only in
`Teacher_Profile` joins the teacher lists as soon as they are assigned.
Changes update every view immediately.

## Backend notes

- `Code.gs` returns every non-empty `1449Working` row, including rows without a
  teacher; nothing is filtered by subject.
- Actions: `me`, `data`, `data-compare`, `photos`, `departments`, `sync`,
  `department-sync` and `musaid-sync` (writes the `Musaid`/`Musanid` column).
- The sheet should have a `BookName_AR` column for Arabic book names.
- Gender and Daera are read from `Teacher_Profile` (`Gender`, `Daera` columns) and
  override the same columns in `1449Working` when filled. Saving a Daera
  (`daera-sync`) writes to the teacher's `Teacher_Profile` row.
- After any `Code.gs` change, deploy a new Web app version.
- Arabic typography: `حصـص` and `التخصـص` are written with a tatweel between
  the two ص so the font renders them correctly. Brackets stay inside the Arabic
  text run so they display correctly in RTL.

## Security notes

- Keep `config.js` limited to public identifiers.
- Keep the Apps Script deployment restricted to the intended Google accounts
  through `allowedEmails`.
- Redeploy the Apps Script after changing `Code.gs`.
