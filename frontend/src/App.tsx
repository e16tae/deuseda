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
    // Store password temporarily for SSH connection (Note: consider more secure alternatives in production)
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
