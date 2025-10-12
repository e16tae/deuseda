import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  sessionId?: string;
}

export function Terminal({ sessionId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(terminalRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Fit after terminal is mounted
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.error('Failed to fit terminal:', e);
      }
    }, 0);

    // Connect to WebSocket
    const token = localStorage.getItem('token');
    const ws = new WebSocket(`ws://localhost:8080/ws/terminal?token=${token}&session_id=${sessionId}`);
    ws.binaryType = 'arraybuffer'; // Receive binary data as ArrayBuffer
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Send password as first message for SSH authentication
      const password = localStorage.getItem('password');
      if (password) {
        ws.send(password);
      } else {
        xterm.writeln('\r\nError: No password found. Please login again.');
      }
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        xterm.write(event.data);
      } else if (event.data instanceof Blob) {
        const text = await event.data.text();
        xterm.write(text);
      } else if (event.data instanceof ArrayBuffer) {
        const decoder = new TextDecoder();
        xterm.write(decoder.decode(event.data));
      }
    };

    ws.onerror = (error) => {
      xterm.writeln(`\r\nWebSocket error: ${error}`);
    };

    ws.onclose = () => {
      xterm.writeln('\r\nConnection closed');
    };

    // Send terminal input to WebSocket
    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      xterm.dispose();
    };
  }, [sessionId]);

  return <div ref={terminalRef} className="h-full w-full" />;
}
