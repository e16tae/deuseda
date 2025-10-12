# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**deuseda** is a web-based remote console service accessible at www.deuseda.com. It provides secure SSH-based terminal access through a browser with multi-session management and persistent sessions.

### Key Features
- SSH account authentication with Google Authenticator (2FA)
- Tab-based multi-session terminal management
- Session persistence using tmux (survives browser close/logout)
- WebSocket-based real-time terminal I/O

## Technology Stack

### Backend (Rust)
- **Framework**: Axum 0.7 with Tower middleware
- **Database**: PostgreSQL with SQLx (async)
- **Authentication**:
  - SSH credentials via ssh2
  - TOTP/2FA via totp-rs
  - JWT tokens via jsonwebtoken
- **Terminal**:
  - PTY via portable-pty
  - Session management via tmux
- **Logging**: tracing + tracing-subscriber

### Frontend (React + TypeScript)
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui (New York style)
- **Terminal**: xterm.js with fit and web-links addons
- **Styling**: TailwindCSS v3

### Infrastructure
- **Database**: PostgreSQL 16
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: nginx (in frontend container)

## Development Commands

### Backend (Rust)

```bash
# Navigate to backend directory
cd backend

# Build
cargo build

# Run (requires PostgreSQL)
cargo run

# Build for release
cargo build --release

# Run tests
cargo test
```

### Frontend (React)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

### Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Stop and remove volumes
docker-compose down -v
```

### Database

```bash
# Connect to PostgreSQL in Docker
docker exec -it deuseda-postgres psql -U deuseda -d deuseda_console

# Run migrations (automatically run on backend startup via sqlx::migrate!)
# Migrations are in backend/migrations/
```

## Architecture

### Authentication Flow
1. User submits username, password, and OTP code
2. Backend verifies SSH credentials via ssh2 library
3. Backend validates OTP against user's TOTP secret from database
4. On success, backend issues JWT token (24-hour expiry)
5. JWT token used for subsequent WebSocket and API requests

### Session Management
1. Each terminal tab creates a unique tmux session
2. Session metadata stored in PostgreSQL:
   - `user_id`: Owner of the session
   - `tmux_session_name`: Format `deuseda-{uuid}`
   - `session_title`: User-defined tab title
   - `last_accessed_at`: Tracks activity
   - `is_active`: Soft delete flag
3. When browser reconnects, user can re-attach to existing tmux sessions
4. tmux keeps shells alive independently of WebSocket connections

### WebSocket Terminal Flow
1. Client connects to `/ws/terminal` endpoint
2. Backend authenticates JWT from connection
3. Backend either creates new tmux session or attaches to existing one
4. PTY I/O streamed bidirectionally via WebSocket
5. On disconnect, tmux session persists in background

### Database Schema

**users table**:
- Stores username and TOTP secret (for 2FA)
- One user can have multiple sessions

**sessions table**:
- Links user_id to tmux_session_name
- Tracks creation time and last access time
- Enables session list/restore functionality

**audit_logs table**:
- Records authentication events and user actions
- Includes IP address, user agent, and metadata (JSONB)

## Project Structure

```
deuseda/
├── backend/
│   ├── src/
│   │   ├── auth/          # SSH authentication + TOTP verification
│   │   ├── db/            # Database connection pool initialization
│   │   ├── handlers/      # HTTP/WebSocket route handlers
│   │   │   ├── auth.rs    # Login/register endpoints
│   │   │   ├── session.rs # Session list endpoints
│   │   │   └── terminal.rs# WebSocket terminal handler
│   │   ├── middleware/    # JWT auth middleware (TODO)
│   │   ├── models/        # Database models and API types
│   │   ├── session/       # Tmux session management
│   │   ├── terminal/      # PTY creation and I/O
│   │   └── main.rs        # Application entry point
│   ├── migrations/        # SQL migration files
│   ├── Cargo.toml
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   │   └── ui/        # shadcn/ui components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── components.json    # shadcn/ui configuration
│   └── tailwind.config.js
└── docker-compose.yml
```

## Key Implementation Notes

### SSH Authentication
- Uses ssh2 crate to validate credentials against actual SSH server
- Password verification happens via SSH protocol (not stored in database)
- Only TOTP secrets are stored for 2FA

### Tmux Session Naming
- Format: `deuseda-{uuid}` (e.g., `deuseda-a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- Ensures unique session names across all users
- Enables programmatic session management

### WebSocket Protocol
- Text messages: User keyboard input to terminal
- Binary messages: Terminal output to browser
- Connection authenticated via JWT token in query params or headers

### Environment Variables
Backend requires:
- `DATABASE_URL`: PostgreSQL connection string
- `SERVER_HOST`: Bind address (default: 0.0.0.0)
- `SERVER_PORT`: Listen port (default: 8080)
- `JWT_SECRET`: Secret key for JWT signing
- `RUST_LOG`: Log level configuration

## TODO Items

The following features are planned but not yet implemented:

1. **JWT Authentication Middleware**: Extract and validate JWT tokens in middleware layer
2. **SSH Credential Verification**: Complete ssh2 integration in auth module
3. **WebSocket ↔ PTY Bridge**: Implement bidirectional streaming between WebSocket and PTY
4. **Tmux Attach Logic**: Connect to existing tmux sessions on reconnect
5. **Frontend Login UI**: Build login form with username/password/OTP inputs
6. **Frontend Terminal Component**: Integrate xterm.js with WebSocket
7. **Tab Management UI**: Create tab interface for multiple sessions
8. **Session Restore**: Load user's previous sessions on login

## Common Development Patterns

### Adding New API Endpoint

1. Define request/response types in `backend/src/models/mod.rs`
2. Create handler function in appropriate `backend/src/handlers/*.rs` file
3. Register route in `backend/src/main.rs` Router
4. Add middleware if authentication required

### Adding New Database Table

1. Create SQL migration in `backend/migrations/NNN_description.sql`
2. Add corresponding struct in `backend/src/models/mod.rs` with `#[derive(FromRow)]`
3. Implement query functions in relevant module

### Adding shadcn/ui Component

```bash
cd frontend
npx shadcn@latest add <component-name>
```

Components are added to `src/components/ui/` and can be imported via `@/components/ui/component-name`.

## Security Considerations

- Never commit `.env` files containing secrets
- JWT_SECRET must be cryptographically random in production
- SSH passwords never stored in database (verified via ssh2)
- TOTP secrets stored securely in database (consider encryption at rest)
- Audit logs track all authentication attempts
- WebSocket connections must validate JWT before granting terminal access
- Rate limiting should be added to authentication endpoints
