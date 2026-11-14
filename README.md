# Bench Spot web app

The web app and Flutter app share a Supabase library for bench locations,
reviews, and photos. Postgres is the source of truth; the JSON response from
Supabase is an API representation, not a shared writable `benches.json` file.
Each client writes individual records so concurrent contributions do not
replace one another.

## Configure Supabase

1. Create a Supabase project.
2. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**.
3. Open the SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql).
   It creates the `benches` and `bench_reviews` tables, row-level policies, the
   first-review RPC, and the public `bench-photos` bucket.
4. Put the project URL and its public publishable/anon key in
   [`js/supabase-config.js`](./js/supabase-config.js). These client values are
   public by design; never use a service-role key in the browser or a mobile
   app.

New benches and reviews are public as soon as saved. Readers do not need an
account. Each client creates an anonymous identity for writes; a user can
remove only benches they created. Photo files are public and limited to JPEGs
up to 5 MB.

## Run locally

With Python 3 installed:

```powershell
python server.py
```

Open <http://127.0.0.1:8000>. The Python server only serves the static app; all
bench data and photos are read from and written to Supabase. Location search,
map tiles, and the Supabase project need internet access.

## Publish with GitHub Pages

The `Deploy web app to GitHub Pages` workflow publishes the static app whenever
changes are pushed to `main`, or when started manually from the Actions tab. It
publishes only `index.html`, `styles.css`, `js/`, and `assets/`; the local
server, database schema, importer, and legacy JSON are not deployed.

To enable the shared Supabase library on the deployed site:

1. Add repository variables named `SUPABASE_URL` and `SUPABASE_ANON_KEY` under
   **Settings → Secrets and variables → Actions → Variables**. Use the project
   URL and public publishable/anon key; never put a service-role key in the
   workflow or browser app.
2. Push a commit or run the workflow manually to publish with the configured
   Supabase client.

The workflow writes those public client values into the generated
`js/supabase-config.js` in the deployment artifact. The checked-in file stays
blank so project-specific values are not committed. The static site can deploy
without Supabase variables, but its shared bench library will not work until
both variables are set. If only one is set, deployment stops with an explicit
error.

## Legacy JSON data

The existing [`benches.json`](./benches.json) is kept as a local backup and is
not loaded or published automatically. To deliberately import verified legacy
entries, exclude any sample rows and use the importer with Node.js 18 or later:

```powershell
node supabase/import-benches.mjs benches.json --dry-run
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_ANON_KEY = "YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY"
node supabase/import-benches.mjs benches.json
```

The dry run validates the file and reports records eligible to publish without
connecting. The importer skips records marked `isSample: true`, validates
coordinates and reviews, skips existing record IDs, and uploads JPEG data URLs
to Supabase Storage. Do not import unverified demo locations as real benches.
The script uses anonymous auth and the public key; the SQL policies remain in
force.

## Find and add benches

Choose **Louvain-la-Neuve** or another Belgian city, then tap **Spot a bench**
or a location on the map. Add a name, location type, optional note, initial
rating, review, and up to three photos. New records appear in the shared
library immediately. The library remains public and can expand across both
clients. Tap **Refresh shared library** to fetch benches added since this page
was opened.

Choose **Use my location** to show nearby benches. Browsers only provide GPS
on secure pages: `localhost` works on the computer running the server, but a
phone generally needs HTTPS. Map tiles and place-name suggestions use
OpenStreetMap; keep their attribution visible.

## Project structure

- `index.html` contains the page structure.
- `styles.css` contains page styling.
- `js/app.js` wires the map and collection workflows together.
- `js/bench-repository.js` reads and writes shared Supabase records and photos.
- `js/supabase-config.js` contains public client configuration.
- `supabase/schema.sql` defines the shared database, policies, and photo bucket.
- `supabase/import-benches.mjs` deliberately imports verified legacy JSON.
- `server.py` serves the static web app locally; it is not the data API.
