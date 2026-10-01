# Hourglass

A small work-progress app I made for fun / entertainment.

I didn’t hand-write this whole thing myself — I built it **completely with AI** (Cursor). I asked for features, tested them, and steered what I wanted. So treat it as an AI-assisted side project, not as proof that I wrote every line from scratch.

It’s not a countdown timer. The hourglass shows how much work I’ve finished on a project. I hold **POUR** when I’m working, and the sand fills up as progress.

## What it does

- Create projects and track progress with the hourglass
- Move important ones to the **Important** panel (star them, up to 5 stars for priority)
- Double-click a project in Important / Projects to list the works to do
- On the first open of the day, it shows incomplete Important projects one by one
  - **Select** → pick which works to do today → goes to **Selected**
  - Click outside → skip that project
  - **Previous** if I skip by mistake
- Double-click something in **Selected** to see only today’s works

## Stack

- **Client:** React + Vite
- **Server:** Express
- **Data:** MongoDB if it’s running, otherwise a local JSON file (`server/data/projects.json`)

I mostly use the JSON file right now because Mongo isn’t always on.

## How to run

Need Node.js installed.

```bash
npm run install:all
npm run dev
```

Then open: http://localhost:5173/

On Windows I also use `start-hourglass.bat` (desktop shortcut). Keep that window open while using the app.

## Local setup

Copy `server/.env.example` to `server/.env` and change if you need:

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/hourglass
DATA_DIR=data
PROJECTS_FILE=projects.json
```

## Preserve existing data when enabling MongoDB

The server keeps existing JSON data in `server/data/`; connecting MongoDB does not delete or automatically import those files. Set `MONGODB_URL` or `MONGO_URI` in `server/.env`, then preview the local record counts without connecting to or changing MongoDB:

```bash
cd server
npm run migrate:legacy-data
```

Optionally compare against the configured MongoDB database (read-only):

```bash
npm run migrate:legacy-data -- --check-target
```

Only after reviewing the preview, explicitly import records:

```bash
npm run migrate:legacy-data -- --apply
```

The import skips matching accounts and previously imported records; it does not overwrite existing MongoDB records or remove local JSON files. Keep `server/.env` private.

## Deploy a test prototype to Vercel

The repository includes a Vercel serverless API and builds the React client from the repository root.

1. Push the project to a GitHub repository and import it in Vercel with the repository root as the project root.
2. Create a MongoDB Atlas database and set `MONGO_URI` in the Vercel project's Production environment variables. Use a database user limited to this database and keep the URI private.
3. Deploy. Check `/api/health`; it should return `{"ok":true,"storage":"mongodb"}`. Register a test account, create a progress path, then sign out and back in to verify persistence.

Do not deploy without `MONGO_URI`: production intentionally refuses to use the local JSON fallback because Vercel function files are not persistent. Social posts, group feeds, messages, and some preferences are currently stored in each browser, so those items do not yet sync between friends' accounts. Treat this as a hosted testing prototype, not a production launch.

## Notes

- My real project names / topics stay in `server/data/` and `.env` — those are in `.gitignore` on purpose
- If the app won’t start, something might still be using ports 5000 or 5173 from a previous run. Closing the old console window (or using the bat file) usually fixes it

## Folder layout

```
client/   → React UI
server/   → API + store
start-hourglass.bat → quick start on Windows
```
