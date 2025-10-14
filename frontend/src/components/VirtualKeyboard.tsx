import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  onHeightChange?: (height: number) => void;
}

type KeyboardLayout = 'letters' | 'korean' | 'symbols' | 'symbolsMore';

type KeyboardKeyType = 'char' | 'shift' | 'backspace' | 'layout' | 'space' | 'enter';

interface KeyboardKey {
  label: string;
  value?: string;
  width?: number;
  type?: KeyboardKeyType;
  shiftValue?: string;
  targetLayout?: KeyboardLayout;
  color?: string;
}

interface ExtraKey {
  label: string;
  value?: string;
  color?: string;
  modifier?: 'ctrl' | 'alt';
  width?: number;
}

const EXTRA_KEY_ROWS: ExtraKey[][] = [
  [
    { label: 'ESC', value: '\x1b', color: 'bg-red-600 hover:bg-red-500' },
    { label: 'Tab', value: '\t', color: 'bg-gray-600 hover:bg-gray-500' },
    { label: 'Ctrl', modifier: 'ctrl', color: 'bg-purple-600 hover:bg-purple-500' },
    { label: 'Alt', modifier: 'alt', color: 'bg-purple-600 hover:bg-purple-500' },
    { label: '^C', value: '\x03', color: 'bg-yellow-600 hover:bg-yellow-500' },
    { label: '^D', value: '\x04', color: 'bg-orange-600 hover:bg-orange-500' },
    { label: '^Z', value: '\x1a', color: 'bg-purple-600 hover:bg-purple-500' },
    { label: '^L', value: '\x0c', color: 'bg-blue-600 hover:bg-blue-500' },
  ],
  [
    { label: '←', value: '\x1b[D' },
    { label: '↑', value: '\x1b[A' },
    { label: '↓', value: '\x1b[B' },
    { label: '→', value: '\x1b[C' },
    { label: '`', value: '`' },
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '0', value: '0' },
    { label: '-', value: '-' },
    { label: '=', value: '=' },
    { label: '[', value: '[' },
    { label: ']', value: ']' },
    { label: '\\', value: '\\' },
    { label: ';', value: ';' },
    { label: "'", value: "'" },
    { label: ',', value: ',' },
    { label: '.', value: '.' },
    { label: '/', value: '/' },
  ],
];

const createCharRow = (chars: string): KeyboardKey[] =>
  chars.split('').map((char) => ({
    label: char.toUpperCase(),
    value: char.toLowerCase(),
    shiftValue: char.toUpperCase(),
    type: 'char',
  }));

const HANGUL_SHIFT_MAP: Record<string, string> = {
  'ㅂ': 'ㅃ',
  'ㅈ': 'ㅉ',
  'ㄷ': 'ㄸ',
  'ㄱ': 'ㄲ',
  'ㅅ': 'ㅆ',
  'ㅐ': 'ㅒ',
  'ㅔ': 'ㅖ',
};

const createHangulRow = (chars: string): KeyboardKey[] =>
  chars.split('').map((char) => ({
    label: char,
    value: char,
    shiftValue: HANGUL_SHIFT_MAP[char] ?? char,
    type: 'char',
  }));

const createSymbolRow = (symbols: string[]): KeyboardKey[] =>
  symbols.map((symbol) => ({
    label: symbol,
    value: symbol,
    type: 'char',
  }));

const LETTERS_LAYOUT: KeyboardKey[][] = [
  createCharRow('qwertyuiop'),
  createCharRow('asdfghjkl'),
  [
    { label: '⇧', type: 'shift', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
    ...createCharRow('zxcvbnm'),
    { label: '⌫', value: '\x7f', type: 'backspace', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
  ],
  [
    { label: '123', type: 'layout', targetLayout: 'symbols', width: 1.4, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: '한/영', type: 'layout', targetLayout: 'korean', width: 1.4, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: ',', value: ',', width: 1, type: 'char' },
    { label: 'Space', type: 'space', value: ' ', width: 3.6, color: 'bg-gray-700 hover:bg-gray-600' },
    { label: '.', value: '.', width: 1, type: 'char' },
    { label: '↵', type: 'enter', value: '\r', width: 1.6, color: 'bg-blue-600 hover:bg-blue-500' },
  ],
];

const KOREAN_LAYOUT: KeyboardKey[][] = [
  createHangulRow('ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ'),
  createHangulRow('ㅁㄴㅇㄹㅎㅗㅓㅏㅣ'),
  [
    { label: '⇧', type: 'shift', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
    ...createHangulRow('ㅋㅌㅊㅍㅠㅜㅡ'),
    { label: '⌫', value: '\x7f', type: 'backspace', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
  ],
  [
    { label: '123', type: 'layout', targetLayout: 'symbols', width: 1.4, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: 'ABC', type: 'layout', targetLayout: 'letters', width: 1.4, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: ',', value: ',', width: 1, type: 'char' },
    { label: 'Space', type: 'space', value: ' ', width: 3.6, color: 'bg-gray-700 hover:bg-gray-600' },
    { label: '.', value: '.', width: 1, type: 'char' },
    { label: '↵', type: 'enter', value: '\r', width: 1.6, color: 'bg-blue-600 hover:bg-blue-500' },
  ],
];

const SYMBOLS_LAYOUT: KeyboardKey[][] = [
  createSymbolRow(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']),
  createSymbolRow(['-', '/', ':', ';', '(', ')', '$', '&', '@', '"']),
  [
    { label: '#+=', type: 'layout', targetLayout: 'symbolsMore', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: '.', value: '.', type: 'char', width: 1 },
    { label: ',', value: ',', type: 'char', width: 1 },
    { label: '?', value: '?', type: 'char', width: 1 },
    { label: '!', value: '!', type: 'char', width: 1 },
    { label: "'", value: "'", type: 'char', width: 1 },
    { label: '⌫', value: '\x7f', type: 'backspace', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
  ],
  [
    { label: 'ABC', type: 'layout', targetLayout: 'letters', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: '한/영', type: 'layout', targetLayout: 'korean', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: 'Space', type: 'space', value: ' ', width: 4, color: 'bg-gray-700 hover:bg-gray-600' },
    { label: '↵', type: 'enter', value: '\r', width: 1.5, color: 'bg-blue-600 hover:bg-blue-500' },
  ],
];

const SYMBOLS_MORE_LAYOUT: KeyboardKey[][] = [
  createSymbolRow(['[', ']', '{', '}', '#', '%', '^', '*', '+', '=']),
  createSymbolRow(['_', '\\', '|', '~', '<', '>', '`', '"', '!', '?']),
  [
    { label: '123', type: 'layout', targetLayout: 'symbols', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: '.', value: '.', type: 'char', width: 1 },
    { label: ',', value: ',', type: 'char', width: 1 },
    { label: '?', value: '?', type: 'char', width: 1 },
    { label: '!', value: '!', type: 'char', width: 1 },
    { label: "'", value: "'", type: 'char', width: 1 },
    { label: '⌫', value: '\x7f', type: 'backspace', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
  ],
  [
    { label: 'ABC', type: 'layout', targetLayout: 'letters', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: '한/영', type: 'layout', targetLayout: 'korean', width: 1.5, color: 'bg-gray-600 hover:bg-gray-500' },
    { label: 'Space', type: 'space', value: ' ', width: 4, color: 'bg-gray-700 hover:bg-gray-600' },
    { label: '↵', type: 'enter', value: '\r', width: 1.5, color: 'bg-blue-600 hover:bg-blue-500' },
  ],
];

export function VirtualKeyboard({ onKeyPress, onHeightChange }: VirtualKeyboardProps) {
  const [layout, setLayout] = useState<KeyboardLayout>('letters');
  const [shiftPressed, setShiftPressed] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !onHeightChange) {
      return;
    }

    const notifyHeight = () => {
      const height = containerRef.current?.offsetHeight ?? 0;
      onHeightChange(height);
    };

    notifyHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => notifyHeight());
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [layout, onHeightChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };

    container.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      container.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  const currentLayout = (() => {
    switch (layout) {
      case 'korean':
        return KOREAN_LAYOUT;
      case 'symbols':
        return SYMBOLS_LAYOUT;
      case 'symbolsMore':
        return SYMBOLS_MORE_LAYOUT;
      default:
        return LETTERS_LAYOUT;
    }
  })();

  const sendKeyValue = (rawValue: string | undefined) => {
    if (!rawValue) {
      return;
    }

    let valueToSend = rawValue;

    if (ctrlPressed && rawValue.length === 1) {
      const char = rawValue.toLowerCase();
      if (char >= 'a' && char <= 'z') {
        valueToSend = String.fromCharCode(char.charCodeAt(0) - 96);
      }
    }

    if (altPressed && !rawValue.startsWith('\x1b')) {
      valueToSend = '\x1b' + valueToSend;
    }

    onKeyPress(valueToSend);

    if (ctrlPressed) {
      setCtrlPressed(false);
    }
    if (altPressed) {
      setAltPressed(false);
    }
  };

  const handleMainKey = (key: KeyboardKey) => {
    switch (key.type) {
      case 'shift':
        setShiftPressed((prev) => !prev);
        return;
      case 'layout':
        if (key.targetLayout) {
          setShiftPressed(false);
          setLayout(key.targetLayout);
        }
        return;
      case 'backspace':
        sendKeyValue(key.value ?? '\x7f');
        setShiftPressed(false);
        return;
      case 'space':
        sendKeyValue(key.value ?? ' ');
        setShiftPressed(false);
        return;
      case 'enter':
        sendKeyValue(key.value ?? '\r');
        setShiftPressed(false);
        return;
      default: {
        const baseValue = key.value ?? '';
        if (!baseValue) {
          return;
        }

        let valueToSend = baseValue;
        if (shiftPressed) {
          if (key.shiftValue) {
            valueToSend = key.shiftValue;
          } else if (baseValue.length === 1) {
            valueToSend = baseValue.toUpperCase();
          }
        }

        sendKeyValue(valueToSend);
        if (shiftPressed) {
          setShiftPressed(false);
        }
      }
    }
  };

  const handleMainKeyPointerDown = (key: KeyboardKey, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    handleMainKey(key);
    event.currentTarget.blur();
  };

  const handleExtraKeyPointerDown = (key: ExtraKey, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.currentTarget.blur();

    setShiftPressed(false);

    if (key.modifier === 'ctrl') {
      setCtrlPressed((prev) => !prev);
      return;
    }

    if (key.modifier === 'alt') {
      setAltPressed((prev) => !prev);
      return;
    }

    sendKeyValue(key.value);
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-700 z-50 pb-safe shadow-2xl"
    >
      <div className="px-2 pt-2 pb-1 space-y-1 border-b border-gray-800">
        {EXTRA_KEY_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-wrap justify-center gap-1">
            {row.map((key) => {
              const isActive =
                (key.modifier === 'ctrl' && ctrlPressed) ||
                (key.modifier === 'alt' && altPressed);

              const baseColor = key.color ?? 'bg-gray-700 hover:bg-gray-600';
              const activeColor = isActive
                ? 'bg-blue-500 hover:bg-blue-500 ring-2 ring-blue-400'
                : baseColor;

              return (
                <button
                  key={key.label}
                  onPointerDown={(event) => handleExtraKeyPointerDown(key, event)}
                  className={`
                    h-10 px-3 rounded text-white font-mono text-xs font-semibold
                    ${activeColor}
                    active:scale-95 transition-all select-none
                    flex items-center justify-center
                    touch-manipulation
                  `}
                  style={{ touchAction: 'manipulation' }}
                >
                  {key.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="px-2 pb-2 space-y-1">
        {currentLayout.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1 justify-center">
            {row.map((key, keyIndex) => {
              const isShiftKey = key.type === 'shift';
              const isActive = isShiftKey && shiftPressed;
              const baseColor =
                key.color ??
                (key.type === 'enter'
                  ? 'bg-blue-600 hover:bg-blue-500'
                  : key.type === 'layout'
                    ? 'bg-gray-600 hover:bg-gray-500'
                    : 'bg-gray-700 hover:bg-gray-600');
              const activeColor = isActive
                ? 'bg-blue-500 hover:bg-blue-500 ring-2 ring-blue-400'
                : baseColor;

              return (
                <button
                  key={`${key.label}-${keyIndex}`}
                  onPointerDown={(event) => handleMainKeyPointerDown(key, event)}
                  className={`
                    h-12 rounded text-white font-semibold text-base
                    ${activeColor}
                    active:scale-95 transition-all select-none
                    flex items-center justify-center
                    touch-manipulation
                  `}
                  style={{ flex: key.width ?? 1, touchAction: 'manipulation' }}
                >
                  {key.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
