# Notifyra

Notifyra helps users centralize and manage subscriptions, recurring payments, and shared expenses to avoid missed charges, duplicates, and unnecessary spending. It provides upcoming payment tracking, budgets, reminders, import/export tools, and group settlements in one mobile-first experience.

## Tech Stack

- React 19 + TypeScript
- Vite + Vitest
- Supabase Auth and PostgreSQL, with local-only fallback mode
- PWA support with `vite-plugin-pwa`
- Capacitor for iOS and Android builds

## Features

- Personal subscription tracking with monthly and yearly totals
- Upcoming charges, daily payment reminders, and paid/unpaid tracking
- Budget alerts and spending analytics
- Subscription import/export in JSON and CSV
- Price change history
- Shared group expenses and settlement calculations
- App logo lookup and custom subscription icons
- Offline-aware UI and installable PWA behavior

## Requirements

- Node.js 20+
- npm 10+
- Xcode for iOS builds
- Android Studio + Android SDK for Android builds
- JDK 17+ for Android builds

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Run quality checks:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Environment Variables

Copy the example file and fill in your Supabase project values:

```bash
cp .env.example .env
```

Required variables for cloud sync:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_AUTH_REDIRECT_URL` optional, used for OAuth redirects when it differs from the current browser origin

If these variables are not provided, the app still runs in local-only mode without cloud sync.

## Supabase Setup

1. Create a Supabase project.
2. For a new project, run `supabase/schema.sql` and then `supabase/migrations/20260818_harden_permissions_and_constraints.sql` in the Supabase SQL editor.
3. For an existing project with the previous schema, run only `supabase/migrations/20260818_harden_permissions_and_constraints.sql`.
4. Add the Supabase URL and anon key to `.env`.

### Google Login

1. In Supabase, open Authentication > Providers and enable Google.
2. Add your Google OAuth client ID and secret in Supabase.
3. Add the app URL to Authentication > URL Configuration > Redirect URLs, for example `http://localhost:5173` and your production URL.
4. If needed, set `VITE_SUPABASE_AUTH_REDIRECT_URL` in `.env` to the same URL.

The schema includes tables and row-level security policies for:

- User profiles and personal subscriptions
- Groups, members, and invitations
- Shared expenses and participants
- Monthly charge instances and settlement shares
- Personal charge payment tracking

## Available Scripts

- `npm run dev`: start the local development server
- `npm run lint`: run ESLint
- `npm run test`: run the Vitest suite
- `npm run build`: type-check and build for production
- `npm run preview`: preview the production build locally
- `npm run mobile:build`: build the web app and sync Capacitor projects
- `npm run cap:open:ios`: open the iOS project in Xcode
- `npm run cap:open:android`: open the Android project in Android Studio
- `npm run logos:generate`: regenerate local logo assets

## Mobile Builds

The same codebase is used for the PWA, iOS, and Android versions through Capacitor.

App identity:

- App name: `Notifyra`
- Bundle/package ID: `com.notifyra.app`

Build and sync native projects:

```bash
npm run mobile:build
```

Open native projects:

```bash
npm run cap:open:ios
npm run cap:open:android
```

## Local Data And Privacy

The app stores user preferences, local fallback subscriptions, and PWA cache data in the browser. The settings screen includes a device cleanup action that clears local app data, cached assets, remembered sessions, and service workers from the current browser.

Real environment files such as `.env` are ignored by Git. Only `.env.example` should be committed.
