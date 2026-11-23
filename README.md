# SinkThatShip

**SinkThatShip** is a real-time, browser-based multiplayer Battleship game. Players create an account, arrange a fleet on a 10×10 grid, get matched with another player, and take turns attacking each other's boards. The game includes live chat, account verification, persistent player statistics, and a global leaderboard.

🌐 **Play:** [https://www.sinkthatship.com](https://www.sinkthatship.com)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)
- [Security Notes](#security-notes)

## Features

### Multiplayer gameplay
- Real-time player matchmaking using Socket.IO.
- Interactive 10×10 Battleship boards.
- Drag-and-drop ship placement with rotation.
- Turn-based attacks with hit and miss feedback.
- Ship-sunk detection and animated game feedback.
- Match completion handling, including opponent disconnects.

### Accounts and authentication
- Account registration and login.
- Email verification by link or verification code.
- Password hashing with bcrypt.
- Forgot-password and password-reset flows.
- Session-based authentication with sessions persisted in PostgreSQL.
- Sign-out and account deletion.

### Social and player stats
- In-game, real-time chat with unread-message notification.
- Global leaderboard displaying player wins, losses, and win/loss ratio.
- Persistent win and loss statistics.

### Interface
- Responsive game screens for desktop and mobile.
- Animated navigation, chat, and game feedback.
- Interactive fleet placement and visual board states.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling and animation | Tailwind CSS 4, Framer Motion, Lucide |
| Drag and drop | dnd-kit |
| Real-time communication | Socket.IO |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Express sessions, bcrypt |
| Session storage | connect-pg-simple |
| Email | SendGrid |
| Frontend hosting | Vercel |
| Backend hosting | Render |

## How It Works

SinkThatShip is organized as a separate frontend and backend:

1. The **Next.js frontend** renders the landing page, account flows, matchmaking hub, fleet placement screen, and active game.
2. The **Express backend** handles authentication, session management, leaderboard data, and HTTP API requests.
3. **PostgreSQL** stores user accounts, verification and password-reset state, game records, messages, friend-request records, and persistent login sessions.
4. **Prisma** provides database access to the backend.
5. **Socket.IO** shares authenticated sessions with real-time connections and coordinates matchmaking, game events, and in-game chat.

During a match, the server tracks the players, boards, and current turn. Attack results are sent to both players so their views stay synchronized. Completed matches update player win/loss statistics.

## Project Structure

```text
.
├── backend/
│   ├── prisma/
│   │   ├── migrations/       # Database migrations
│   │   └── schema.prisma     # PostgreSQL data models
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js       # Registration, login, verification, password flows
│   │   │   └── matchStore.js # Matchmaking queue and active match state
│   │   ├── utils/
│   │   │   └── email.js      # SendGrid email helper
│   │   ├── index.js          # Express server and HTTP API
│   │   └── socket.js         # Socket.IO authentication and game events
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/app/
    │   ├── components/       # Shared UI components (navbar, chat, etc.)
    │   ├── game/             # Active multiplayer game
    │   ├── hub/              # Fleet placement and matchmaking
    │   ├── lib/              # Frontend utilities and socket setup
    │   ├── page.tsx          # Landing page and account UI
    │   └── layout.tsx
    └── package.json
```

## Getting Started

### Prerequisites

- Node.js **22** (the backend supports Node.js 22 through 24).
- npm.
- A PostgreSQL database.
- A SendGrid account with a verified sender address if you want to test registration verification and password-reset emails.

### 1. Clone the repository

```bash
git clone https://github.com/rareyese97/battleship.git
cd battleship
```

### 2. Configure the backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and set the values described in [Environment Variables](#environment-variables). Use a local PostgreSQL database or a development database connection string.

Generate the Prisma client and apply the checked-in migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

For a local development database where you are creating a new migration, use `npx prisma migrate dev` instead of `migrate deploy`.

Start the backend:

```bash
npm run dev
```

The backend runs on [http://localhost:4000](http://localhost:4000) by default.

### 3. Configure the frontend

Open a second terminal from the repository root:

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

Start the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Important:** Run the frontend and backend together. The frontend uses the backend for account/session requests and Socket.IO connections. Email-based account flows also require valid SendGrid configuration.

## Environment Variables

### Backend — `backend/.env`

The repository includes `backend/.env.example` as a template.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Used by Prisma and the PostgreSQL session store. |
| `SESSION_SECRET` | Long, random secret used to sign session cookies. Required in production. |
| `SENDGRID_API_KEY` | SendGrid API key used to send verification and password-reset emails. |
| `SENDGRID_FROM_EMAIL` | Verified sender email address configured in SendGrid. |
| `BACKEND_URL` | Public backend base URL used when generating email verification links. Use `http://localhost:4000` locally. |
| `FRONTEND_URL` | Frontend base URL used for redirects after email verification. Use `http://localhost:3000` locally. |
| `NODE_ENV` | Set to `development` locally and `production` in the deployed backend. |

Example local configuration:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/sinkthatship
SESSION_SECRET=replace-with-a-long-random-secret
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your-verified-sender@example.com
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### Frontend — `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Base URL of the Express backend. For local development, use `http://localhost:4000`. |

Only expose values prefixed with `NEXT_PUBLIC_` if they are safe to be included in browser-side code. Never put database credentials, session secrets, or email-provider API keys in frontend environment variables.

## Database

The PostgreSQL schema is defined in `backend/prisma/schema.prisma`.

The primary models include:

- **User** — account credentials (stored as password hashes), email-verification state, password-reset state, and win/loss statistics.
- **Game** — players, winner, creation time, and related messages.
- **Message** — chat messages associated with a game and sender.
- **FriendRequest** — sender, receiver, request status, and creation time.

Apply existing migrations from the `backend/` directory:

```bash
npx prisma migrate deploy
```

Regenerate Prisma Client after schema/client changes:

```bash
npx prisma generate
```

The backend also uses PostgreSQL to persist Express sessions in the `user_sessions` table. This allows authenticated sessions to survive backend restarts and avoids relying on Express's in-memory session store.

## Available Scripts

Run commands from the relevant directory.

### Frontend

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run the configured Next.js lint script. |

### Backend

| Command | Description |
|---|---|
| `npm run dev` | Start the Express server with nodemon. |
| `npm start` | Start the Express server. |
| `npx prisma generate` | Generate Prisma Client. |
| `npx prisma migrate deploy` | Apply committed database migrations. |

The backend's current `npm test` script is a placeholder; automated backend tests are not configured yet.

## Deployment

The production application is split across two services:

- **Frontend:** Vercel — deploy the `frontend/` directory as the project root.
- **Backend:** Render — deploy the `backend/` directory as the service root and use `npm start` as the start command.
- **Database:** PostgreSQL — configure the same production database connection for Prisma and persistent sessions.

### Production configuration checklist

**Vercel**
- Set `NEXT_PUBLIC_BACKEND_URL` to the deployed backend URL (currently `https://api.sinkthatship.com`).
- Set the project root directory to `frontend`.

**Render**
- Set the service root directory to `backend`.
- Set the start command to `npm start`.
- Configure `DATABASE_URL`, `SESSION_SECRET`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `BACKEND_URL`, `FRONTEND_URL`, and `NODE_ENV=production`.
- Set `BACKEND_URL=https://api.sinkthatship.com` and `FRONTEND_URL=https://www.sinkthatship.com`.
- Apply database migrations as part of the deployment/release process with `npx prisma migrate deploy`.

**Database**
- Use a production PostgreSQL connection string with the required TLS settings for the hosting provider.
- Keep database credentials and all secrets out of source control.

The backend configures credentialed CORS for the production site and local development. If the frontend domain changes, update the backend's allowed origins in both `backend/src/index.js` and `backend/src/socket.js`.

## Security Notes

- Never commit `.env`, `.env.local`, API keys, database URLs containing credentials, or session secrets.
- Use a strong, unique `SESSION_SECRET` in production.
- Keep `DATABASE_URL` and `SENDGRID_API_KEY` on the backend only.
- Use HTTPS for deployed frontend and backend services.
- Passwords are hashed with bcrypt before being stored.
- Authentication uses HTTP-only session cookies; production cookies are configured for secure cross-site requests.
- Email verification and password-reset tokens expire.

---

Built with Next.js, Express, Socket.IO, PostgreSQL, and Prisma.
