import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SpecialKey {
  label: string;
  value: string;
  color?: string;
  width?: string;
}

interface SpecialKeyBarProps {
  onKeyPress: (key: string) => void;
  onHeightChange?: (height: number) => void;
}

// Essential keys always visible
const ESSENTIAL_KEYS: SpecialKey[] = [
  { label: 'ESC', value: '\x1b', color: 'bg-red-600 hover:bg-red-700', width: 'w-14' },
  { label: 'Tab', value: '\t', color: 'bg-gray-600 hover:bg-gray-700', width: 'w-12' },
  { label: '↑', value: '\x1b[A', width: 'w-10' },
  { label: '↓', value: '\x1b[B', width: 'w-10' },
  { label: '^C', value: '\x03', color: 'bg-yellow-600 hover:bg-yellow-700', width: 'w-10' },
  { label: '^D', value: '\x04', color: 'bg-orange-600 hover:bg-orange-700', width: 'w-10' },
];

// Extended keys shown when expanded
const EXTENDED_KEYS: SpecialKey[][] = [
  // Row 1: Navigation and control
  [
    { label: '←', value: '\x1b[D' },
    { label: '→', value: '\x1b[C' },
    { label: '^Z', value: '\x1a', color: 'bg-purple-600 hover:bg-purple-700' },
    { label: '^L', value: '\x0c', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: '^A', value: '\x01', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: '^E', value: '\x05', color: 'bg-blue-600 hover:bg-blue-700' },
  ],
  // Row 2: Common symbols
  [
    { label: '|', value: '|' },
    { label: '~', value: '~' },
    { label: '/', value: '/' },
    { label: '-', value: '-' },
    { label: '&', value: '&' },
    { label: '>', value: '>' },
    { label: '<', value: '<' },
    { label: '*', value: '*' },
  ],
];

export function SpecialKeyBar({ onKeyPress, onHeightChange }: SpecialKeyBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure and report height to parent
  useEffect(() => {
    if (containerRef.current && onHeightChange) {
      const height = containerRef.current.offsetHeight;
      onHeightChange(height);
    }
  }, [isExpanded, onHeightChange]);

  const handleKeyClick = (key: SpecialKey) => {
    onKeyPress(key.value);
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-50"
    >
      {/* Essential Keys Row - Always Visible */}
      <div className="flex items-center gap-1 p-2">
        {ESSENTIAL_KEYS.map((key) => (
          <button
            key={key.label}
            onClick={() => handleKeyClick(key)}
            className={`
              ${key.width || 'w-10'} h-10 rounded text-white font-mono text-xs font-bold
              ${key.color || 'bg-gray-700 hover:bg-gray-600'}
              active:scale-95 transition-all
              flex items-center justify-center
              touch-manipulation
            `}
            title={`Send ${key.label}`}
          >
            {key.label}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center active:scale-95 transition-all touch-manipulation"
          title={isExpanded ? 'Collapse keyboard' : 'Expand keyboard'}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Extended Keys - Shown When Expanded */}
      {isExpanded && (
        <div className="border-t border-gray-800 p-2 space-y-1">
          {EXTENDED_KEYS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1">
              {row.map((key) => (
                <button
                  key={key.label}
                  onClick={() => handleKeyClick(key)}
                  className={`
                    flex-1 h-9 rounded text-white font-mono text-xs font-bold
                    ${key.color || 'bg-gray-700 hover:bg-gray-600'}
                    active:scale-95 transition-all
                    flex items-center justify-center
                    touch-manipulation
                    min-w-[36px]
                  `}
                  title={`Send ${key.label}`}
                >
                  {key.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
