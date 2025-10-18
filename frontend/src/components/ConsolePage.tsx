import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Terminal } from './Terminal';
import { PlusCircle, LogOut, Eye, Trash2, RefreshCw } from 'lucide-react';
import { apiClient } from '@/api/client';
import type { TerminalSession } from '@/api/client';

interface ConsolePageProps {
  username: string;
  onLogout: () => void;
}

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export function ConsolePage({ username, onLogout }: ConsolePageProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [visibleSessionIds, setVisibleSessionIds] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load sessions from server
  const loadSessions = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const serverSessions = await apiClient.getTerminalSessions();
      if (serverSessions.length === 0) {
        if (!isRefresh) {
          // Create default session if none exist (only on initial load)
          const defaultSession = await apiClient.createTerminalSession({
            session_id: generateSessionId(),
            title: 'Terminal 1',
          });
          setSessions([defaultSession]);
          setVisibleSessionIds([defaultSession.id]);
          setActiveSession(defaultSession.id);
        } else {
          // On refresh, just clear sessions
          setSessions([]);
          setVisibleSessionIds([]);
          setActiveSession('');
        }
      } else {
        const currentVisibleIds = new Set(visibleSessionIds);
        const newVisibleIds = serverSessions
          .filter((session) =>
            // Keep currently visible sessions visible
            currentVisibleIds.has(session.id) ||
            // Auto-show new sessions on initial load
            (!isRefresh && currentVisibleIds.size === 0)
          )
          .map((session) => session.id);

        // On initial load, show all sessions
        const finalVisibleIds = isRefresh
          ? newVisibleIds.length > 0 ? newVisibleIds : [serverSessions[0].id]
          : serverSessions.map((session) => session.id);

        setSessions(serverSessions);
        setVisibleSessionIds(finalVisibleIds);

        // Update active session if needed
        if (!finalVisibleIds.includes(activeSession) && finalVisibleIds.length > 0) {
          setActiveSession(finalVisibleIds[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      if (!isRefresh) {
        // Fallback to creating a default session (only on initial load)
        const fallbackId = generateSessionId();
        setSessions([{ id: fallbackId, title: 'Terminal 1' }]);
        setVisibleSessionIds([fallbackId]);
        setActiveSession(fallbackId);
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    setVisibleSessionIds((prev) => {
      const validIds = prev.filter((id) => sessions.some((session) => session.id === id));
      if (validIds.length === prev.length) {
        return prev;
      }
      return validIds;
    });
  }, [sessions]);

  useEffect(() => {
    if (visibleSessionIds.length === 0) {
      if (activeSession !== '') {
        setActiveSession('');
      }
      return;
    }
    if (!visibleSessionIds.includes(activeSession)) {
      setActiveSession(visibleSessionIds[0]);
    }
  }, [visibleSessionIds, activeSession]);

  const addNewSession = async () => {
    const newId = generateSessionId();
    const newTitle = `Terminal ${sessions.length + 1}`;

    try {
      const newSession = await apiClient.createTerminalSession({
        session_id: newId,
        title: newTitle,
      });
      setSessions((prev) => [...prev, newSession]);
      setVisibleSessionIds((prev) => [...prev.filter((id) => id !== newSession.id), newSession.id]);
      setActiveSession(newSession.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const hideSession = (id: string) => {
    setVisibleSessionIds((prev) => {
      if (!prev.includes(id)) {
        return prev;
      }
      const nextVisible = prev.filter((sessionId) => sessionId !== id);
      if (activeSession === id) {
        setActiveSession(nextVisible[0] ?? '');
      }
      return nextVisible;
    });
  };

  const resumeSession = (id: string) => {
    setVisibleSessionIds((prev) => {
      if (prev.includes(id)) {
        return prev;
      }
      return [...prev, id];
    });
    setActiveSession(id);
  };

  const terminateSession = async (id: string) => {
    try {
      await apiClient.deleteTerminalSession(id);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }

    const nextSessions = sessions.filter((session) => session.id !== id);
    const nextVisible = visibleSessionIds.filter((sessionId) => sessionId !== id);
    setSessions(nextSessions);
    setVisibleSessionIds(nextVisible);

    if (activeSession === id) {
      setActiveSession(nextVisible[0] ?? '');
    }
  };

  const visibleSessions = sessions.filter((session) => visibleSessionIds.includes(session.id));
  const hiddenSessions = sessions.filter((session) => !visibleSessionIds.includes(session.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Deuseda Console</h1>
          <span className="text-sm text-muted-foreground">({username})</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Terminal Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {hiddenSessions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-muted/30">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Hidden sessions
            </span>
            {hiddenSessions.map((session) => (
              <div key={session.id} className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1">
                <span className="text-sm font-medium">{session.title}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resumeSession(session.id)}
                  className="px-2"
                >
                  <Eye className="w-4 h-4" />
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => terminateSession(session.id)}
                  className="px-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Terminate
                </Button>
              </div>
            ))}
          </div>
        )}

        {visibleSessions.length > 0 ? (
          <Tabs value={activeSession} onValueChange={setActiveSession} className="flex flex-col h-full">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b">
              <TabsList>
                {visibleSessions.map((session) => (
                  <TabsTrigger key={session.id} value={session.id} className="flex items-center gap-2">
                    <span>{session.title}</span>
                    {visibleSessions.length > 1 && (
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          hideSession(session.id);
                        }}
                        aria-label={`Hide ${session.title}`}
                      >
                        ×
                      </button>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadSessions(true)}
                  disabled={refreshing}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button size="sm" variant="outline" onClick={addNewSession}>
                  <PlusCircle className="w-4 h-4 mr-1" />
                  New Session
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!activeSession}
                  onClick={() => activeSession && terminateSession(activeSession)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Terminate Current
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {visibleSessions.map((session) => (
                <TabsContent key={session.id} value={session.id} className="h-full m-0 p-4">
                  <Terminal sessionId={session.id} />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
            <p>No active terminals. Resume an existing session or create a new one.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {hiddenSessions.map((session) => (
                <Button
                  key={session.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => resumeSession(session.id)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {session.title}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={addNewSession}>
                <PlusCircle className="w-4 h-4 mr-1" />
                Start New Session
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
