import { useState, useEffect } from 'react';
import { AuthPage } from './components/AuthPage';
import { ConsolePage } from './components/ConsolePage';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');

    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
    }
  }, []);

  const handleLogin = (newToken: string, newUsername: string, password: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);

    // ⚠️ SECURITY WARNING: Storing plaintext password in localStorage is INSECURE
    // - Vulnerable to XSS attacks (malicious scripts can steal it)
    // - Accessible via browser DevTools (anyone with physical access can see it)
    // - Persists across browser sessions (security risk if device is shared)
    //
    // RECOMMENDED ALTERNATIVES:
    // 1. Use session storage instead (clears on tab close)
    // 2. Store in memory only (re-prompt on WebSocket connect)
    // 3. Implement server-side session management (no client-side password storage)
    //
    // TODO: Remove this before production deployment
    localStorage.setItem('password', password);

    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    setToken(null);
    setUsername('');
  };

  if (!token) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return <ConsolePage username={username} onLogout={handleLogout} />;
}

export default App;
