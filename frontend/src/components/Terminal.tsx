import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { VirtualKeyboard } from './VirtualKeyboard';
import { useIsMobile } from '@/hooks/useIsMobile';

interface TerminalProps {
  sessionId?: string;
}

export function Terminal({ sessionId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMobile = useIsMobile();
  const [keypadHeight, setKeypadHeight] = useState(0);
  const [viewportMetrics, setViewportMetrics] = useState<{ height: number | null; keyboardHeight: number }>({
    height: null,
    keyboardHeight: 0,
  });
  const [computedTerminalHeight, setComputedTerminalHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isMobile) {
      setViewportMetrics({ height: null, keyboardHeight: 0 });
      return;
    }

    const updateMetrics = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const viewportKeyboardHeight = Math.max(0, window.innerHeight - height - offsetTop);
      setViewportMetrics({ height, keyboardHeight: viewportKeyboardHeight });
    };

    updateMetrics();
    window.addEventListener('resize', updateMetrics);
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateMetrics);
    viewport?.addEventListener('scroll', updateMetrics);

    return () => {
      window.removeEventListener('resize', updateMetrics);
      viewport?.removeEventListener('resize', updateMetrics);
      viewport?.removeEventListener('scroll', updateMetrics);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Prevent body scroll on mobile when keyboard is active
    if (isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    }

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
      scrollback: 10000, // Enable scrollback buffer (10000 lines)
      fastScrollModifier: 'shift', // Shift+scroll for fast scrolling
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(terminalRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Disable native keyboard on mobile by preventing focus on xterm's textarea
    // but allow text selection to work
    let observer: MutationObserver | null = null;
    if (isMobile) {
      // Prevent native keyboard popup while allowing text selection
      const preventTextareaFocus = () => {
        const textarea = terminalRef.current?.querySelector('textarea');
        if (textarea) {
          textarea.setAttribute('readonly', 'true');
          textarea.setAttribute('inputmode', 'none');
          // Don't disable - let xterm handle selection
          textarea.style.opacity = '0';
          textarea.style.position = 'absolute';
          textarea.style.left = '-9999px';

          // Prevent keyboard popup but allow selection
          const preventKeyboard = (e: Event) => {
            if (e.type === 'focus') {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          };

          textarea.addEventListener('focus', preventKeyboard, true);
        }
      };

      // Run immediately and after DOM is ready
      setTimeout(preventTextareaFocus, 0);
      setTimeout(preventTextareaFocus, 100);
      setTimeout(preventTextareaFocus, 500);

      // Also observe for any DOM changes
      observer = new MutationObserver(preventTextareaFocus);
      if (terminalRef.current) {
        observer.observe(terminalRef.current, { childList: true, subtree: true });
      }
    }

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
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    // Convert HTTP/HTTPS URL to WS/WSS
    const wsUrl = apiBaseUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/terminal?token=${token}&session_id=${sessionId}`);
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

      // Send initial terminal size after connection
      setTimeout(() => {
        const cols = xterm.cols;
        const rows = xterm.rows;
        const resizeMessage = JSON.stringify({ type: 'resize', cols, rows });
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(resizeMessage);
          console.log(`Sent initial terminal size: ${cols}x${rows}`);
        }
      }, 100);
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

    // Send terminal resize to backend
    const resizeDisposable = xterm.onResize(({ cols, rows }) => {
      const resizeMessage = JSON.stringify({ type: 'resize', cols, rows });
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(resizeMessage);
        console.log(`Terminal resized: ${cols}x${rows}`);
      }
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      // Restore body scroll on cleanup
      if (isMobile) {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      }
      // Cleanup observer
      if (observer) {
        observer.disconnect();
      }
      resizeDisposable.dispose();
      window.removeEventListener('resize', handleResize);
      ws.close();
      xterm.dispose();
    };
  }, [isMobile, sessionId]);

  const handleSpecialKey = (key: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(key);
    }
  };

  const handleKeyboardCommand = async (command: 'copySelection' | 'scrollUp' | 'scrollDown' | 'pageUp' | 'pageDown') => {
    const terminal = xtermRef.current;
    if (!terminal) {
      return;
    }

    switch (command) {
      case 'copySelection': {
        const selection = terminal.getSelection?.();
        if (!selection) {
          console.warn('No terminal selection to copy');
          return;
        }

        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(selection);
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = selection;
            textarea.setAttribute('readonly', 'true');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }
        } catch (error) {
          console.error('Failed to copy terminal selection', error);
        }
        break;
      }

      case 'scrollUp':
        terminal.scrollLines(-3);
        break;

      case 'scrollDown':
        terminal.scrollLines(3);
        break;

      case 'pageUp':
        terminal.scrollPages(-1);
        break;

      case 'pageDown':
        terminal.scrollPages(1);
        break;
    }
  };

  const bottomSafeGap = 8;
  const combinedKeyboardHeight = isMobile
    ? Math.max(keypadHeight, viewportMetrics.keyboardHeight)
    : 0;

  useEffect(() => {
    if (!isMobile) {
      setComputedTerminalHeight(undefined);
      return;
    }

    const compute = () => {
      if (!terminalRef.current) return;
      const rect = terminalRef.current.getBoundingClientRect();
      const available = window.innerHeight - rect.top - combinedKeyboardHeight - bottomSafeGap;
      const nextHeight = Math.max(available, 200);
      setComputedTerminalHeight((prev) => (prev !== nextHeight ? nextHeight : prev));
    };

    compute();
    const raf = requestAnimationFrame(compute);
    return () => cancelAnimationFrame(raf);
  }, [combinedKeyboardHeight, isMobile, viewportMetrics.height]);

  const fallbackTerminalHeight = isMobile && viewportMetrics.height
    ? Math.max(viewportMetrics.height - combinedKeyboardHeight - bottomSafeGap, 200)
    : undefined;
  const finalTerminalHeight = isMobile
    ? (computedTerminalHeight ?? fallbackTerminalHeight)
    : undefined;
  const terminalPaddingBottom = isMobile
    ? `${combinedKeyboardHeight + bottomSafeGap}px`
    : undefined;

  useEffect(() => {
    if (!fitAddonRef.current) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      try {
        fitAddonRef.current?.fit();
      } catch (error) {
        console.error('Failed to fit terminal after resize:', error);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [finalTerminalHeight]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Terminal - takes full height with bottom padding for keypad */}
      <div
        ref={terminalRef}
        className="h-full w-full overflow-hidden"
        style={isMobile ? {
          paddingBottom: terminalPaddingBottom,
          height: finalTerminalHeight !== undefined ? `${finalTerminalHeight}px` : '100%',
          maxHeight: finalTerminalHeight !== undefined ? `${finalTerminalHeight}px` : undefined,
          touchAction: 'manipulation'
        } : undefined}
      />

      {/* Virtual Keyboard - full QWERTY layout on mobile */}
      {isMobile && (
        <VirtualKeyboard
          onKeyPress={handleSpecialKey}
          onHeightChange={setKeypadHeight}
          onCommand={handleKeyboardCommand}
        />
      )}
    </div>
  );
}
