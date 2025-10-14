import { useState, useEffect, useRef } from 'react';

interface Key {
  label: string;
  value: string;
  width?: number; // 1 = normal, 1.5 = wide, 2 = extra wide
  isModifier?: boolean;
  color?: string;
}

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  onHeightChange?: (height: number) => void;
}

type KeyboardLayout = 'default' | 'symbols' | 'korean';

// QWERTY Layout
const defaultLayout: Key[][] = [
  [
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
    { label: '⌫', value: '\x7f', width: 1.5 },
  ],
  [
    { label: 'Tab', value: '\t', width: 1.5, color: 'bg-gray-600' },
    { label: 'Q', value: 'q' },
    { label: 'W', value: 'w' },
    { label: 'E', value: 'e' },
    { label: 'R', value: 'r' },
    { label: 'T', value: 't' },
    { label: 'Y', value: 'y' },
    { label: 'U', value: 'u' },
    { label: 'I', value: 'i' },
    { label: 'O', value: 'o' },
    { label: 'P', value: 'p' },
    { label: '[', value: '[' },
    { label: ']', value: ']' },
    { label: '\\', value: '\\' },
  ],
  [
    { label: 'ESC', value: '\x1b', width: 1.5, color: 'bg-red-600' },
    { label: 'A', value: 'a' },
    { label: 'S', value: 's' },
    { label: 'D', value: 'd' },
    { label: 'F', value: 'f' },
    { label: 'G', value: 'g' },
    { label: 'H', value: 'h' },
    { label: 'J', value: 'j' },
    { label: 'K', value: 'k' },
    { label: 'L', value: 'l' },
    { label: ';', value: ';' },
    { label: "'", value: "'" },
    { label: '↵', value: '\r', width: 2, color: 'bg-blue-600' },
  ],
  [
    { label: 'Ctrl', value: '', width: 1.5, isModifier: true, color: 'bg-purple-600' },
    { label: 'Z', value: 'z' },
    { label: 'X', value: 'x' },
    { label: 'C', value: 'c' },
    { label: 'V', value: 'v' },
    { label: 'B', value: 'b' },
    { label: 'N', value: 'n' },
    { label: 'M', value: 'm' },
    { label: ',', value: ',' },
    { label: '.', value: '.' },
    { label: '/', value: '/' },
    { label: 'Alt', value: '', width: 1.5, isModifier: true, color: 'bg-purple-600' },
  ],
  [
    { label: '한/영', value: '', width: 1.5, color: 'bg-green-600' }, // Korean/English toggle
    { label: '←', value: '\x1b[D', width: 1 },
    { label: '↓', value: '\x1b[B', width: 1 },
    { label: '↑', value: '\x1b[A', width: 1 },
    { label: '→', value: '\x1b[C', width: 1 },
    { label: 'Space', value: ' ', width: 3 },
    { label: '#+=', value: '', width: 1, color: 'bg-gray-600' }, // Symbols toggle
    { label: '^C', value: '\x03', width: 1.5, color: 'bg-yellow-600' },
    { label: '^D', value: '\x04', width: 1.5, color: 'bg-orange-600' },
  ],
];

// Korean Layout (두벌식)
const koreanLayout: Key[][] = [
  [
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
    { label: '⌫', value: '\x7f', width: 1.5 },
  ],
  [
    { label: 'Tab', value: '\t', width: 1.5, color: 'bg-gray-600' },
    { label: 'ㅂ', value: 'ㅂ' },
    { label: 'ㅈ', value: 'ㅈ' },
    { label: 'ㄷ', value: 'ㄷ' },
    { label: 'ㄱ', value: 'ㄱ' },
    { label: 'ㅅ', value: 'ㅅ' },
    { label: 'ㅛ', value: 'ㅛ' },
    { label: 'ㅕ', value: 'ㅕ' },
    { label: 'ㅑ', value: 'ㅑ' },
    { label: 'ㅐ', value: 'ㅐ' },
    { label: 'ㅔ', value: 'ㅔ' },
    { label: '[', value: '[' },
    { label: ']', value: ']' },
    { label: '\\', value: '\\' },
  ],
  [
    { label: 'ESC', value: '\x1b', width: 1.5, color: 'bg-red-600' },
    { label: 'ㅁ', value: 'ㅁ' },
    { label: 'ㄴ', value: 'ㄴ' },
    { label: 'ㅇ', value: 'ㅇ' },
    { label: 'ㄹ', value: 'ㄹ' },
    { label: 'ㅎ', value: 'ㅎ' },
    { label: 'ㅗ', value: 'ㅗ' },
    { label: 'ㅓ', value: 'ㅓ' },
    { label: 'ㅏ', value: 'ㅏ' },
    { label: 'ㅣ', value: 'ㅣ' },
    { label: ';', value: ';' },
    { label: "'", value: "'" },
    { label: '↵', value: '\r', width: 2, color: 'bg-blue-600' },
  ],
  [
    { label: 'Ctrl', value: '', width: 1.5, isModifier: true, color: 'bg-purple-600' },
    { label: 'ㅋ', value: 'ㅋ' },
    { label: 'ㅌ', value: 'ㅌ' },
    { label: 'ㅊ', value: 'ㅊ' },
    { label: 'ㅍ', value: 'ㅍ' },
    { label: 'ㅠ', value: 'ㅠ' },
    { label: 'ㅜ', value: 'ㅜ' },
    { label: 'ㅡ', value: 'ㅡ' },
    { label: ',', value: ',' },
    { label: '.', value: '.' },
    { label: '/', value: '/' },
    { label: 'Alt', value: '', width: 1.5, isModifier: true, color: 'bg-purple-600' },
  ],
  [
    { label: '한/영', value: '', width: 1.5, color: 'bg-green-600' }, // Korean/English toggle
    { label: '←', value: '\x1b[D', width: 1 },
    { label: '↓', value: '\x1b[B', width: 1 },
    { label: '↑', value: '\x1b[A', width: 1 },
    { label: '→', value: '\x1b[C', width: 1 },
    { label: 'Space', value: ' ', width: 3 },
    { label: '#+=', value: '', width: 1, color: 'bg-gray-600' }, // Symbols toggle
    { label: '^C', value: '\x03', width: 1.5, color: 'bg-yellow-600' },
    { label: '^D', value: '\x04', width: 1.5, color: 'bg-orange-600' },
  ],
];

// Symbols Layout
const symbolsLayout: Key[][] = [
  [
    { label: '~', value: '~' },
    { label: '!', value: '!' },
    { label: '@', value: '@' },
    { label: '#', value: '#' },
    { label: '$', value: '$' },
    { label: '%', value: '%' },
    { label: '^', value: '^' },
    { label: '&', value: '&' },
    { label: '*', value: '*' },
    { label: '(', value: '(' },
    { label: ')', value: ')' },
    { label: '_', value: '_' },
    { label: '+', value: '+' },
    { label: '⌫', value: '\x7f', width: 1.5 },
  ],
  [
    { label: 'Tab', value: '\t', width: 1.5, color: 'bg-gray-600' },
    { label: '|', value: '|' },
    { label: '<', value: '<' },
    { label: '>', value: '>' },
    { label: '&&', value: '&&' },
    { label: '||', value: '||' },
    { label: '>>', value: '>>' },
    { label: '<<', value: '<<' },
    { label: '2>', value: '2>' },
    { label: '&>', value: '&>' },
    { label: '{', value: '{' },
    { label: '}', value: '}' },
    { label: '|', value: '|' },
  ],
  [
    { label: 'ESC', value: '\x1b', width: 1.5, color: 'bg-red-600' },
    { label: '~/', value: '~/' },
    { label: './', value: './' },
    { label: '../', value: '../' },
    { label: '//', value: '//' },
    { label: '==', value: '==' },
    { label: '!=', value: '!=' },
    { label: '<=', value: '<=' },
    { label: '>=', value: '>=' },
    { label: ':', value: ':' },
    { label: '"', value: '"' },
    { label: '↵', value: '\r', width: 2, color: 'bg-blue-600' },
  ],
  [
    { label: 'Ctrl', value: '', width: 1.5, isModifier: true, color: 'bg-purple-600' },
    { label: '?', value: '?' },
    { label: '/', value: '/' },
    { label: '\\', value: '\\' },
    { label: '`', value: '`' },
    { label: '${', value: '${' },
    { label: '$_', value: '$_' },
    { label: '$?', value: '$?' },
    { label: '$0', value: '$0' },
    { label: '$1', value: '$1' },
    { label: 'Alt', value: '', width: 1.5, isModifier: true, color: 'bg-purple-600' },
  ],
  [
    { label: 'ABC', value: '', width: 1.5, color: 'bg-gray-600' }, // Layout switch
    { label: '←', value: '\x1b[D', width: 1 },
    { label: '↓', value: '\x1b[B', width: 1 },
    { label: '↑', value: '\x1b[A', width: 1 },
    { label: '→', value: '\x1b[C', width: 1 },
    { label: 'Space', value: ' ', width: 4 },
    { label: '^Z', value: '\x1a', width: 1.5, color: 'bg-purple-600' },
    { label: '^L', value: '\x0c', width: 1.5, color: 'bg-blue-600' },
  ],
];

export function VirtualKeyboard({ onKeyPress, onHeightChange }: VirtualKeyboardProps) {
  const [layout, setLayout] = useState<KeyboardLayout>('default');
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure and report height
  useEffect(() => {
    if (containerRef.current && onHeightChange) {
      const height = containerRef.current.offsetHeight;
      onHeightChange(height);
    }
  }, [layout, onHeightChange]);

  // Prevent scrolling on keyboard container
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

  const handleKeyClick = (key: Key, event?: React.MouseEvent | React.TouchEvent) => {
    // Prevent default behavior and stop propagation to avoid scrolling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }


    // Layout switch - Korean/English toggle
    if (key.label === '한/영') {
      setLayout(layout === 'korean' ? 'default' : 'korean');
      return;
    }

    // Layout switch - Symbols
    if (key.label === '#+=') {
      setLayout('symbols');
      return;
    }

    // Layout switch - Back to default
    if (key.label === 'ABC') {
      setLayout('default');
      return;
    }

    // Modifier toggle
    if (key.isModifier) {
      if (key.label === 'Ctrl') {
        setCtrlPressed(!ctrlPressed);
      } else if (key.label === 'Alt') {
        setAltPressed(!altPressed);
      }
      return;
    }

    // Send key with modifiers
    let valueToSend = key.value;

    // Apply Ctrl modifier
    if (ctrlPressed && valueToSend.length === 1) {
      const char = valueToSend.toLowerCase();
      if (char >= 'a' && char <= 'z') {
        // Ctrl+A = 0x01, Ctrl+B = 0x02, etc.
        valueToSend = String.fromCharCode(char.charCodeAt(0) - 96);
      }
    }

    // Apply Alt modifier (ESC prefix)
    if (altPressed) {
      valueToSend = '\x1b' + valueToSend;
    }

    onKeyPress(valueToSend);

    // Auto-release modifiers
    setCtrlPressed(false);
    setAltPressed(false);
  };

  const currentLayout =
    layout === 'symbols' ? symbolsLayout :
    layout === 'korean' ? koreanLayout :
    defaultLayout;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-700 z-50 pb-safe"
    >
      <div className="p-1 space-y-1">
        {currentLayout.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1 justify-center">
            {row.map((key, keyIndex) => {
              const isActive =
                (key.label === 'Ctrl' && ctrlPressed) ||
                (key.label === 'Alt' && altPressed);

              const width = key.width || 1;
              const baseColor = key.color || 'bg-gray-700';
              const activeColor = isActive ? 'bg-blue-500 ring-2 ring-blue-400' : baseColor;

              return (
                <button
                  key={keyIndex}
                  onClick={(e) => handleKeyClick(key, e)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleKeyClick(key, e);
                  }}
                  className={`
                    h-10 rounded text-white font-mono text-xs font-semibold
                    ${activeColor}
                    hover:brightness-110
                    active:scale-95 transition-all
                    flex items-center justify-center
                    touch-manipulation
                  `}
                  style={{
                    flex: width,
                    touchAction: 'none',
                    WebkitTapHighlightColor: 'transparent'
                  }}
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
