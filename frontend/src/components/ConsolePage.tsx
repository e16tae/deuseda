import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Terminal } from './Terminal';
import { PlusCircle, LogOut } from 'lucide-react';
import { apiClient } from '@/api/client';
import type { TerminalSession } from '@/api/client';

interface ConsolePageProps {
  username: string;
  onLogout: () => void;
}

export function ConsolePage({ username, onLogout }: ConsolePageProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSession, setActiveSession] = useState<string>('1');
  const [loading, setLoading] = useState(true);

  // Load sessions from server on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const serverSessions = await apiClient.getTerminalSessions();
        if (serverSessions.length === 0) {
          // Create default session if none exist
          const defaultSession = await apiClient.createTerminalSession({
            session_id: '1',
            title: 'Terminal 1',
          });
          setSessions([defaultSession]);
          setActiveSession('1');
        } else {
          setSessions(serverSessions);
          setActiveSession(serverSessions[0].id);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
        // Fallback to creating a default session
        setSessions([{ id: '1', title: 'Terminal 1' }]);
        setActiveSession('1');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, []);

  const addNewSession = async () => {
    const newId = String(sessions.length + 1);
    const newTitle = `Terminal ${newId}`;

    try {
      const newSession = await apiClient.createTerminalSession({
        session_id: newId,
        title: newTitle,
      });
      setSessions([...sessions, newSession]);
      setActiveSession(newSession.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const closeSession = async (id: string) => {
    if (sessions.length === 1) return; // Keep at least one session

    try {
      await apiClient.deleteTerminalSession(id);
      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);

      if (activeSession === id && newSessions.length > 0) {
        setActiveSession(newSessions[0].id);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

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
        <Tabs value={activeSession} onValueChange={setActiveSession} className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <TabsList>
              {sessions.map((session) => (
                <TabsTrigger key={session.id} value={session.id} className="relative group">
                  {session.title}
                  {sessions.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        closeSession(session.id);
                      }}
                      className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      ×
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button size="sm" variant="outline" onClick={addNewSession}>
              <PlusCircle className="w-4 h-4 mr-1" />
              New Tab
            </Button>
          </div>

          <div className="flex-1 overflow-hidden">
            {sessions.map((session) => (
              <TabsContent key={session.id} value={session.id} className="h-full m-0 p-4">
                <Terminal sessionId={session.id} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
