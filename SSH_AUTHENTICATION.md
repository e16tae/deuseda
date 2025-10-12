# SSH Authentication Setup

DeusEda Console uses SSH-based authentication to verify users against existing Linux system accounts. No registration is needed - users must already have accounts on the SSH server.

## How It Works

1. User enters their Linux username and password in the web interface
2. Backend connects to the configured SSH server
3. If SSH authentication succeeds, user is automatically created in the database (first login only)
4. A JWT token is issued for session management
5. Password is **never** stored in the database - authentication always happens via SSH

## Configuration

### Backend Environment Variables

Edit `backend/.env` to configure your SSH server:

```bash
# SSH Server Configuration
SSH_HOST=127.0.0.1        # Your SSH server address
SSH_PORT=22               # SSH server port (default: 22)

# JWT Secret for token signing
JWT_SECRET=your-secret-key-here
```

### For Local Testing

To enable SSH on macOS for local testing:
1. Open **System Preferences** → **Sharing**
2. Enable **Remote Login**
3. Set `SSH_HOST=127.0.0.1` and `SSH_PORT=22` in `.env`

For Linux:
```bash
sudo systemctl enable ssh
sudo systemctl start ssh
```

### For Production

Point to your actual SSH server:
```bash
SSH_HOST=your-ssh-server.com
SSH_PORT=22
```

## Testing

### Using the Test Script

```bash
./test_ssh_auth.sh
```

This will prompt for credentials and test the login endpoint.

### Manual Testing with curl

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-username","password":"your-password"}'
```

Expected successful response:
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": "uuid-here",
    "username": "your-username"
  }
}
```

### Via Frontend

1. Start the frontend: `cd frontend && npm run dev`
2. Open http://localhost:5173
3. Enter your Linux username and password
4. Login button will authenticate against the SSH server

## Security Notes

1. **No Password Storage**: Passwords are never stored in the database
2. **Existing Accounts Only**: Users must already exist on the Linux system
3. **SSH Security**: Leverage SSH's built-in security features
4. **JWT Sessions**: Token-based session management after authentication
5. **Database**: Only stores user metadata (id, username, timestamps)

## Troubleshooting

### "Connection refused" Error
- SSH server is not running or not reachable
- Check `SSH_HOST` and `SSH_PORT` configuration
- Verify firewall settings

### "SSH authentication failed" Error
- Invalid username or password
- User account doesn't exist on the SSH server
- SSH server doesn't allow password authentication

### Check Backend Logs
```bash
# Backend logs show detailed SSH connection attempts
RUST_LOG=debug cargo run
```

## Database Schema

Users table only stores metadata:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR NOT NULL,  -- Always empty, kept for schema compatibility
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Note: `password_hash` column is kept empty (no passwords stored).
