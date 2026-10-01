# WizzyBug

Modern bug tracking and resolution management built with React, Express, MongoDB, and Node.js.

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

The Vite client runs on `http://localhost:5173` and the API on `http://localhost:5000`. The polished demo frontend uses local sample data so it is fully explorable before MongoDB is connected. Sign in with the pre-filled demo account.

## Structure

- `src/` React client with responsive role dashboard, bug table, reporting form, details/activity, users, and profile.
- `server/src/models.js` Mongoose User, Bug, Comment/Activity, and Notification structures.
- `server/src/index.js` JWT auth, RBAC, uploads, filtering, pagination, dashboard, user, notification, and bug APIs.

## API overview

`POST /api/auth/register`, `POST /api/auth/login`, `GET|POST /api/bugs`, `GET|PATCH|DELETE /api/bugs/:id`, `POST /api/bugs/:id/comments`, `GET|PATCH /api/users`, `GET /api/dashboard`, `GET /api/notifications`.
