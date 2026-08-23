# H.E.A.R. Bible Journal

A React + Firebase app for journaling H.E.A.R. (Highlight, Explain, Apply, Respond) Bible study entries, with support for sharing entries and commenting.

Live at: https://hear-bible-study-56f67.web.app

## Stack

- React 19 + Vite
- Firebase Auth (email/password + Google sign-in)
- Firestore (per-user entries, sharing, comments)
- Firebase Hosting

## Setup

```bash
npm install
```

The Firebase project config is already embedded in `src/App.jsx` (client-side config is safe to expose — access is controlled by Firestore security rules, not by hiding this config).

## Development

```bash
npm run dev
```

Starts the Vite dev server (default: http://localhost:5173).

## Lint

```bash
npm run lint
```

## Build

```bash
npm run build
```

Outputs a production build to `dist/`.

## Deploy

Deploys are made to Firebase Hosting on project `hear-bible-study-56f67` (configured in `.firebaserc` / `firebase.json`).

1. Install the Firebase CLI if you don't have it:
   ```bash
   npm install -g firebase-tools
   ```
2. Authenticate (one-time, opens a browser):
   ```bash
   firebase login
   ```
3. Build and deploy:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

## Notes

- `migrate.mjs` is a one-off script used to migrate legacy top-level `entries` documents into the current per-user `users/{uid}/entries` structure. Not part of the normal app flow.
