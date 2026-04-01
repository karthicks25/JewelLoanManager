# Jewel Loan Management Web App

Indian Bank, Sulankurichi branch jewel loan management web app with:

- authentication
- category initialization
- manual incoming/outgoing entries
- loan register
- daily share report
- summary reports with filters
- SQLite persistence
- mobile and laptop friendly responsive UI

## Requirements

- Node.js 22 or newer

This app uses `node:sqlite`, which requires a modern Node version.

## Run Locally

```bash
node server.js
```

Open:

- `http://localhost:3000`

Health check:

- `http://localhost:3000/health`

## Important Storage Note

The app stores data in a local SQLite file named `jewel-loan-management.sqlite`.

By default it is stored in the app folder.

For deployment, set one of these:

- `DATA_DIR`
- `RAILWAY_VOLUME_MOUNT_PATH`

The app will then store the database inside that persistent folder.

## Deploy On Railway

### 1. Push the project to GitHub

Create a GitHub repository and push this folder.

### 2. Create a Railway project

In Railway:

1. Create a new project
2. Choose `Deploy from GitHub repo`
3. Select your repository

### 3. Add a persistent volume

In the Railway service:

1. Open the service settings
2. Add a `Volume`
3. Mount it to the app

Railway usually exposes the mount path automatically through `RAILWAY_VOLUME_MOUNT_PATH`, which this app already supports.

If you prefer, you can also set:

- `DATA_DIR=/data`

and mount the volume at `/data`.

### 4. Start command

Use:

```bash
npm start
```

or Railway can use the package script automatically.

### 5. Open the deployed URL

Railway will give you a public HTTPS URL.

That same URL will work on:

- laptop browser
- mobile browser

## Recommended Railway Settings

- Node version: 22+
- 1 service is enough for this single-branch SQLite app
- Use a persistent volume so data survives redeploys and restarts

## Default Login

Use the username and password configured in the app database.

## Files

- `index.html` - UI structure
- `styles.css` - responsive styling
- `app.js` - frontend logic
- `server.js` - Node server and SQLite persistence

## Notes

- SQLite is a good fit for a single branch or low-concurrency setup.
- If you later want multi-branch usage or many simultaneous users, move the database to Postgres.
