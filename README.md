# deuseda

Web-based remote console service providing secure SSH terminal access through your browser at `www.deuseda.com`.

## Features

- 🔐 **Secure Authentication**: SSH credentials + Google Authenticator (2FA)
- 📱 **Multi-Session Management**: Tab-based interface for multiple terminal sessions
- 💾 **Session Persistence**: Sessions survive browser close/logout using tmux
- ⚡ **Real-time I/O**: WebSocket-based terminal streaming with xterm.js
- 🐳 **Easy Deployment**: Docker Compose setup for all services

## Quick Start

### Prerequisites

- Docker and Docker Compose
- (For local development) Rust 1.83+, Node.js 20+, PostgreSQL 16

### Running with Docker

```bash
# Clone the repository
git clone <repository-url>
cd deuseda

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access the application
# Frontend: http://localhost
# Backend API: http://localhost:8080
```

### Local Development

#### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration

cargo run
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Architecture

- **Backend**: Rust + Axum (WebSocket server, authentication, session management)
- **Frontend**: React + TypeScript + xterm.js (terminal UI)
- **Database**: PostgreSQL (user data, sessions, audit logs)
- **Session Management**: tmux (persistent shell sessions)

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed architecture, development commands, and implementation notes.

## Security

- SSH password authentication (credentials not stored)
- TOTP-based 2FA with Google Authenticator
- JWT tokens for session management
- Audit logging for all authentication events

## License

TBD
