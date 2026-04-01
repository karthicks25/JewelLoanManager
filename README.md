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
