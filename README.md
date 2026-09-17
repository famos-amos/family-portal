# Family Portal

A shared family dashboard built for a wall-mounted 10.1" Android tablet: a
smart 2-way synced calendar (Google + Apple/iCloud), a chores board, a weekly
meal planner with recipes and family meal suggestions, family boards (to-do /
wishlist / shopping list), and a customizable home dashboard with a daily
Challenge card and a Verse of the Day.

Built with [Expo](https://expo.dev) / React Native, TypeScript, React
Navigation, Zustand, and [Supabase](https://supabase.com) as the shared
backend (Postgres + realtime sync — see "Setting up Supabase" below).

## What's inside

Five primary screens (tabs across the top), plus Settings (gear, top-right):

- **Home** — a 3-column dashboard of resizable cards (tap the corner mark on a
  card to cycle its detail level). Cards: a mini month/week calendar, Today's
  Events (tap it to jump to the Calendar's Day view on today), the day's
  dinner from the meal plan, a scrollable To-Do list, the Daily Challenge, the
  Verse of the Day, and a chores-progress ring per person. On narrow
  widths (phone / small browser window) it falls back to a single stacked
  column.
- **Calendar** — Month, Week, and Day views over one shared browsable cursor.
  Day view is a half-hour agenda/schedule with events laid out (and sized,
  when an end time is set) against the ruler and a live "now" line. Add/edit
  events in a popup with optional start/end times, any number of family
  members, and a **Calendar** picker choosing where the event lives — this
  app only, iCloud, or any of your writable Google calendars (Work, Personal,
  …) it then 2-way syncs with. Each Google calendar shows up as its own
  checkbox chip right next to the per-person filter, using Google's own
  calendar color by default — tap the color swatch on a chip to pick a
  different one (or reset to Google's), independent of the per-family-member
  colors. Public calendars can be followed read-only by ICS link and toggled
  on/off from chips of their own below that row.
- **Chores** — a board of "Up for Grabs" plus one column per person, with
  points and a progress summary. (The "Claim" button is still a placeholder —
  see Known limitations.)
- **Meal Plans** — the week's breakfast/lunch/dinner grid with chefs (any
  number of family members per meal) and 0–5 star ratings. Quick links from
  here open the **Grocery List** (a board column you can add items to
  directly), **Recipes**, and **Suggestions** (family-submitted meal ideas —
  picking a day/slot for an idea is optional; unscheduled ideas just sit in
  the list until someone assigns them).
- **Boards** — freeform to-do / wishlist / shopping columns. Items can carry a
  description, an owner, and an auto-delete rule (delete immediately on
  check-off, or sweep away 72 hours / a month / a year after being completed).
- **Settings** — appearance (light/dark/system), family members (names,
  birthdays, colors — used everywhere else), connected calendars (Google,
  Apple/iCloud), and notification preferences.

## Requirements

- Node.js 20+
- npm
- The [Expo Go](https://expo.dev/go) app on your Android tablet (fastest way
  to try it), or Android Studio if you want to build a standalone APK.

Runs on Expo SDK 57 (React Native 0.86, React 19).

## Getting started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your tablet, or press `a` to launch an
Android emulator. The app is locked to landscape orientation, matching the
wall-mounted layout it was designed for.

**Before anything shows up as "saved", set up Supabase** — see the next
section. Until then the app runs on temporary in-memory sample data (a
console warning says so on launch), which is fine for kicking the tires but
nothing you change will still be there next time you open it.

Family data (members, chores, meals, meal suggestions, recipes, board items,
calendar events) lives in your own Supabase project's Postgres database and
syncs in real time across every device that has the app open. Device-only
preferences (theme, which calendar people are filtered out, per-widget detail
level, today's Daily Challenge votes) stay local via AsyncStorage.

## Setting up Supabase

Supabase is the free-tier-friendly backend this app saves everything to —
a hosted Postgres database plus realtime sync, reachable straight from the
app with no server code of your own to run. Setup is entirely in Supabase's
dashboard and takes about 5 minutes.

1. **Create a project.** Go to [supabase.com](https://supabase.com) → sign
   up (GitHub login is easiest) → **New Project**. Pick any name/region/
   database password (you won't need the password day-to-day) and wait
   ~1-2 minutes for it to finish provisioning.
2. **Run the schema.** In the project's left sidebar go to **SQL Editor →
   New query**, then open this repo's `supabase/schema.sql`, copy its
   entire contents, paste into the editor, and click **Run**. This creates
   all nine tables the app needs (family members, chores, meals, board
   columns/items, calendar events, recipes, meal suggestions, the app-lock
   PIN), turns on Row
   Level Security with policies that allow the app's key to read/write them,
   turns on realtime sync for each table, and inserts the same starter
   family/chores/meals/recipes the app used to ship with locally — so it
   isn't empty on first load. Safe to re-run; it won't duplicate rows.
3. **Grab your API keys.** Go to **Settings → API** (gear icon, bottom of
   the left sidebar). You need two values off that page:
   - **Project URL** (looks like `https://abcdefghijk.supabase.co`)
   - **anon / public** key, under Project API keys (a long string starting
     `eyJ...`) — **not** the `service_role` key; that one must never ship
     inside an app.
4. **Add them to the app.** Copy `.env.example` to a new file named `.env`
   in the project root, and paste your two values in:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   Restart `npx expo start` if it was already running. Locally, that's it —
   the app now reads and writes Supabase instead of temporary sample data.
5. **For the deployed GitHub Pages site**, the same two values need to be
   available to GitHub Actions at build time (a local `.env` file never
   gets pushed to GitHub — see `.gitignore` — so this is a separate step):
   - In the GitHub repo, go to **Settings → Secrets and variables →
     Actions → New repository secret**.
   - Add one named `EXPO_PUBLIC_SUPABASE_URL` with your Project URL.
   - Add another named `EXPO_PUBLIC_SUPABASE_ANON_KEY` with your anon key.
   - Push to `main` (or re-run the "Deploy web build to GitHub Pages"
     workflow from the Actions tab) — the next deploy picks them up
     automatically; see `.github/workflows/deploy-pages.yml`.

**A note on security**, since there's no login screen in this app: every
table is set up so the anon key can freely read and write it (see the
policies in `supabase/schema.sql`). That's the right tradeoff for a private
single-family app whose GitHub Pages URL you don't publish or share — but
because the anon key ships inside the web bundle, anyone who does find that
URL and opens their browser's dev tools could read your family's data too.
Don't link to the site publicly, and if that's ever a concern, Supabase
Auth (real per-person login) is the natural next step — ask for help
wiring that up if you want it.

**If Supabase becomes unreachable** (a typo in the URL, a paused free-tier
project, a network hiccup), the app doesn't hang — every request times out
after a few seconds and it falls back to showing whatever it last knew
(seed data on a first run), so a wall-mounted tablet is never stuck on a
loading spinner. Changes made while disconnected won't be saved, though —
they're not queued for retry.

## Verse of the Day

The Verse of the Day card pulls today's verse from
[OurManna](https://www.ourmanna.com)'s public JSON API
(`https://beta.ourmanna.com/api/v1/get?format=json&order=daily`), which
sends permissive CORS headers so a direct `fetch()` works the same from the
web build as from native — no proxy or backend needed. See
`src/lib/verseFeed.ts`.

If the fetch fails for any reason (offline, the API down or rate-limited, an
unexpected response), the card silently falls back to a small local verse
rotation keyed by day-of-year, so it always shows something. The last good
fetched verse is cached in AsyncStorage (`roost.verse`) and shown instantly
on the next launch while a fresh copy loads.

> An earlier version used OurManna's RSS feed
> (`ourmanna.com/verses/rss/votd.xml`), which has no
> `Access-Control-Allow-Origin` header and so is blocked outright by
> browsers — that was the old "TypeError: Failed to fetch" console error.
> The JSON API replaced it.

## Daily Challenge

The Daily Challenge card rotates through a local list
(`dailyChallenges` in `src/data/seed.ts`) by day-of-year, so everyone in the
household sees the same prompt each day. Two kinds:

- **"Would You Rather"** prompts show two option buttons and let each family
  member cast one vote per day (tap your initials in the card header, then an
  option). Votes are tallied on the card and stored locally per device
  (`roost.daily.v2` in AsyncStorage) — only today's votes count; a stale
  tally from a previous day is ignored and cleared on the next vote.
- **"Question"** prompts are just a conversation starter, no voting.

## Google Calendar setup (2-way sync)

Google Calendar sync uses the OAuth 2.0 **authorization code flow with PKCE**
and `access_type=offline`, so the app gets a **refresh token** and can keep
syncing without a browser prompt every time. It needs OAuth clients that only
the app owner can create in Google Cloud Console.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and
   create a new project (or reuse one).
2. Enable the **Google Calendar API** for that project (APIs & Services →
   Library → search "Google Calendar API" → Enable).
3. Go to APIs & Services → OAuth consent screen and configure it (External
   user type is fine for a family app). Add the family's Google accounts under
   **Audience → Test users** while the app stays in "Testing". The
   `calendar.events` scope is "sensitive", so sign-in shows an
   "unverified app" interstitial (Advanced → Go to Family Portal) — expected
   for a private family app.
4. Go to APIs & Services → Credentials → Create Credentials → OAuth client
   ID. Create one per platform you'll actually run:
   - **Web application** — needed for the web build (and the only one that
     matters if that's all you use). Under **Authorized JavaScript origins**
     add `http://localhost:8081` (local dev — match whatever port
     `npx expo start --web` prints) and `https://<your-username>.github.io`.
     Under **Authorized redirect URIs** add the same origin(s) plus the
     deployed path `https://<your-username>.github.io/family-portal`. On first
     Connect the app logs (dev console) the exact `redirect_uri` it uses —
     register that string verbatim. This client also has a **client secret**
     (see the Edge Function step below).
   - **Android** — needs the package name (`com.roost.familyportal`) and a
     SHA-1 signing fingerprint (`eas credentials` prints it). No redirect URI
     field; validated by package + fingerprint.
   - **iOS** — needs the bundle identifier (`com.roost.familyportal`).
5. Paste the resulting client IDs into `app.json` under `expo.extra`:

   ```json
   "extra": {
     "googleOAuthClientIdAndroid": "....apps.googleusercontent.com",
     "googleOAuthClientIdIos": "....apps.googleusercontent.com",
     "googleOAuthClientIdWeb": "....apps.googleusercontent.com"
   }
   ```
6. **Web build only — deploy the token-exchange backend.** A "Web application"
   client's code exchange *requires* its client secret, which can't ship in a
   browser bundle, so the web build POSTs the code to a tiny Supabase Edge
   Function (`supabase/functions/google-oauth/`) that holds the secret. Native
   builds skip this entirely — installed-app clients refresh without a secret.

   ```bash
   supabase secrets set \
     GOOGLE_OAUTH_CLIENT_ID=<web client id> \
     GOOGLE_OAUTH_CLIENT_SECRET=<web client secret>
   supabase functions deploy google-oauth --no-verify-jwt
   ```

   The app finds it at `<EXPO_PUBLIC_SUPABASE_URL>/functions/v1/google-oauth`
   automatically. To host the exchange elsewhere, set
   `EXPO_PUBLIC_GOOGLE_TOKEN_PROXY` to its URL instead (it must accept the
   same `{ action: "exchange" | "refresh", ... }` POST body).

Until real values replace the `REPLACE_WITH_...` placeholders, the Settings
screen shows "Setup required" instead of a Connect button (`isGoogleConfigured()`
in `src/lib/googleCalendar.ts` gates this).

Once connected, Family Portal pulls the next 60 days of events from **every
calendar in the account** (Work, Personal, School, …), and — for any event
whose **Calendar** is set to one of them in the add/edit form — mirrors your
creates, edits, deletes and moves back to that calendar (2-way). The event
form's Calendar picker lists each *writable* Google calendar by name; leaving
it on "This app only" keeps the event local. Each event remembers its Google
calendar + id so later changes target the same remote event, and moving an
event between two Google calendars uses Google's move API. The family-member
tags you add are app-only and are preserved across the round-trip that Google
doesn't store. The refresh token is stored with the other device-local
settings (AsyncStorage); "Sync Now" refreshes the calendar list + events with
no sign-in prompt. The **Sync** switch on the Google card hides Google events
and pauses the push without disconnecting; "Disconnect" clears the token.

## Subscribed public calendars (view-only)

Paste any calendar's ICS / webcal URL (a school or sports schedule, a
community calendar, or a Google calendar's "Secret/Public address in iCal
format") and it shows up alongside everything else, read-only. Manage them
from the **Calendar screen toolbar** — the chips next to the per-person
filter: tap to toggle a calendar on/off, long-press to remove it, or hit
**"Add calendar"** to paste a new link. (Settings → Connected Calendars has
the same list.) Removing a calendar deletes its events.

ICS feeds almost never send CORS headers, so on the **web build** the fetch
goes through a second Edge Function; native fetches the feed directly and
falls back to the proxy. Deploy it once:

```bash
supabase functions deploy ics-proxy --no-verify-jwt
```

(Set `EXPO_PUBLIC_ICS_PROXY` to override where feeds are fetched from;
otherwise `<EXPO_PUBLIC_SUPABASE_URL>/functions/v1/ics-proxy` is assumed.)
Recurrence rules aren't expanded — a repeating VEVENT shows only its first
occurrence.

## Calendar schema note

The 2-way / subscription features add two nullable columns to
`calendar_events` (`calendar_id`, `google_id`). Re-running `supabase/schema.sql`
picks them up (it has `alter table … add column if not exists` lines for
existing projects). Until you do, events still work locally but those two
fields won't sync between devices.

## Apple / iCloud Calendar setup (2-way sync)

Apple has no public "Calendar API" for third-party apps — the standard
integration path is **CalDAV** directly against iCloud's servers
(`src/lib/appleCalendar.ts`), authenticated with an **app-specific
password** rather than the real Apple ID password:

1. Go to [appleid.apple.com](https://appleid.apple.com) → Sign-In and
   Security → App-Specific Passwords → generate one.
2. In Family Portal's Settings → Connected Calendars, enter the Apple ID email
   and that app-specific password.

The password is stored in the device keychain / EncryptedSharedPreferences
via `expo-secure-store` — never in plain AsyncStorage, and never sent
anywhere but Apple's own CalDAV servers.

> **Note:** the CalDAV client was implemented directly from Apple's and
> RFC 4791's documented protocol, but hasn't yet been exercised against a
> real iCloud account (the sandbox this was built in has no network path to
> `icloud.com`). Treat it as a solid first draft — test it against a real
> Apple ID on a real device before relying on it, and expect to debug the
> XML parsing in `parseIcsEventsFromMultistatus` against however iCloud
> actually formats its multistatus responses.

## Deploying to the web (GitHub Pages)

Family Portal is a React Native / Expo app, but Expo can export the same
codebase as a static website (React Native Web) — no separate web build to
maintain. This repo is already set up to auto-deploy that web build to
GitHub Pages on every push to `main`, via `.github/workflows/deploy-pages.yml`.

**One-time setup, in the GitHub repo's settings:**

1. Go to **Settings → Pages**.
2. Under "Build and deployment" → **Source**, choose **GitHub Actions**
   (not "Deploy from a branch").
3. Push to `main` (or go to the **Actions** tab and run the "Deploy web
   build to GitHub Pages" workflow manually). The first run takes a couple
   of minutes; after that, the site is live at:

   ```
   https://<your-github-username>.github.io/family-portal/
   ```

Every subsequent push to `main` re-runs the workflow and updates that same
URL automatically — nobody visiting the site ever needs to run `npm
install` or anything else; that command only matters for people who want
to edit the code or run it locally.

**If you rename the repo**, update the base path to match — it's set in
two places:

- `app.json` → `expo.experiments.baseUrl` (currently `/family-portal`)
- the deployed URL itself will change to `https://<username>.github.io/<new-repo-name>/`

**Things that behave differently on the web build**, by necessity rather
than oversight:

- **Apple/iCloud Calendar sync is native-only.** iCloud's CalDAV servers
  don't allow cross-origin requests from a browser (no CORS headers), so
  there's no way to reach them from a web page — only from a native app.
  The Settings screen detects this and hides the Apple connect form on
  web with an explanation instead.
- **Google Calendar sync on web needs the Edge Function.** The web build
  can't hold the Web client's secret, so its auth-code exchange goes through
  the `google-oauth` Supabase Edge Function (see step 6 of "Google Calendar
  setup"). Native builds redeem and refresh tokens on-device with no backend.
  Either way, register the exact redirect URI the app logs on first Connect
  (for web that's `http://localhost:8081` in dev and
  `https://<username>.github.io/family-portal` deployed) on the Web client.
- **Google sign-in does not work in Expo Go** (SDK 50+ removed the auth
  proxy). Use the web build or a native dev build.
- **Landscape-lock** (`app.json` → `orientation: "landscape"`) is a native
  setting and has no effect in a browser — on the web build the tablet's
  own browser chrome and orientation apply, so keep the tablet propped in
  landscape as intended.

## App Lock (PIN)

Settings → **App Lock** lets you require a 4-digit PIN to open Family Portal.
It's one shared PIN for the whole household — only its SHA-256 hash is
stored (`app_lock` table in Supabase, a single row), never the PIN itself.
Unlocking is per-device and sticky: enter it once on a tablet/browser and
that device stays unlocked until someone taps **Lock this device** in
Settings there. A device, browser, or person that has never entered it —
including an attacker with no other way in — always hits the lock screen
first. **Remove PIN** opens the app to everyone with no gate at all; changing
the PIN to a new value doesn't retroactively re-lock devices that were
already unlocked (use **Lock this device** on each one if you want that).

No PIN configured (a fresh install, or after **Remove PIN**) means the app
opens with no gate at all — that's what lets a new install reach Settings to
set one in the first place. Run `supabase/migrate_v6.sql` once if your
project predates this (adds just the `app_lock` table; `schema.sql` already
includes it for fresh installs).

This is a soft gate, not real authentication — consistent with the rest of
the app's security posture (see the note under "Setting up Supabase"): a
4-digit PIN is only 10,000 combinations, and the hash sits in a table the
anon key can read. It stops casual/accidental access, not a determined
attacker.

## Project structure

```
App.tsx          Entry point — fonts, polyfills, ThemeProvider, RootNavigator
src/
  components/    Shared UI — icons, TopBar, Avatar, buttons/cards (ui.tsx),
                 BoardItemFormModal, AssignToPlanModal
  data/          Seed/demo data — recipes.ts, and seed.ts (the Supabase
                 fallback data + the local Daily Challenge / verse rotations)
  lib/           date helpers, id generation, Google + Apple calendar clients,
                 subscribed-calendar (ICS) parsing, calendar color/visibility
                 helpers, PIN hashing (pin.ts), the Supabase client, verse
                 feed client, meal-assignment helper, layout/breakpoint
                 helpers, cross-platform alert/confirm
  navigation/    React Navigation route param types + the root stack navigator
  screens/       One file per screen (Home, Calendar, Chores, MealPlans,
                 Boards, Recipes, GroceryList, Suggestions, Settings) plus
                 LockScreen (the App Lock PIN gate, shown by App.tsx itself —
                 not part of the navigator); screens/home/ holds the
                 dashboard widgets + WidgetShell
  store/         Zustand stores (one per domain). family / chores / meals /
                 meal-suggestions / recipes / boards / calendar sync to
                 Supabase (see useAppStore.ts); verse cache, settings,
                 daily-challenge votes, dashboard layout and the App Lock PIN
                 hash + this device's unlocked flag stay in AsyncStorage as
                 device-local state (the PIN hash is also mirrored to
                 Supabase so every device checks against the same PIN)
  theme/         Colors, typography, ThemeProvider (light/dark), font loading
supabase/
  schema.sql     Run once in your Supabase project's SQL Editor — see
                 "Setting up Supabase"
  functions/
    google-oauth/  Edge Function holding the Google Web client secret — does
                   the OAuth code exchange + token refresh for the web build
                   (see "Google Calendar setup")
    ics-proxy/     Edge Function that fetches subscribed public calendars'
                   ICS feeds server-side (CORS) for the web build
```

## Known limitations / simplifications

- **Chores "Claim" button** assigns the chore to the first family member in
  the list rather than opening a person picker — a placeholder to revisit.
  (The chore add/edit popup *does* have a full person picker.)
- **Apple/iCloud sync is unverified** against a real account (see above).
- **Subscribed calendars don't expand recurrence** — a repeating ICS event
  shows only its first occurrence. The list of feeds is device-local (their
  events sync via `calendar_events` like everything else).
- The Home dashboard's To-Do widget reuses the "Family To-Do" board column
  rather than a separate personal task list.
- **Daily Challenge votes are device-local**, not synced through Supabase —
  each tablet tallies its own votes for the day.
- Push notifications (the toggles in Settings → Notifications) are stored
  as preferences but don't yet trigger real device notifications — wiring
  those up to `expo-notifications` is a good next step.
- **No per-person login / roles.** Every device with the app open shares one
  Supabase-backed household — see the security note under "Setting up
  Supabase" above.
- **Offline edits aren't queued.** If Supabase is unreachable, the app
  still shows (and lets you tap around) whatever it last knew, but changes
  made in that state aren't saved or retried once the connection's back.

## Scripts

```bash
npm run start        # expo start -c   (clears the Metro cache on launch)
npm run android      # expo start --android -c
npm run ios          # expo start --ios -c
npm run web          # expo start --web -c
npm run export:web   # expo export --platform web --clear  (static web build)
npx tsc --noEmit     # typecheck
```
