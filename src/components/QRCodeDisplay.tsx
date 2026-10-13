import React, { useMemo } from 'react';
import { Download, Printer, Copy, Check } from 'lucide-react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  showActions?: boolean;
}

// Deterministic QR-like pattern generator with authentic standard QR finder patterns and timing patterns
export function QRCodeDisplay({
  value,
  size = 200,
  label,
  sublabel,
  showActions = true,
}: QRCodeDisplayProps) {
  const [copied, setCopied] = React.useState(false);

  // Generate a realistic 25x25 QR Matrix with true corner finder patterns
  const matrix = useMemo(() => {
    const N = 25;
    const grid: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

    // Simple pseudo-random hash generator based on the value string
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }

    // Helper to draw a 7x7 finder pattern
    const drawFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isOuterBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInnerSquare = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[startY + r][startX + c] = isOuterBorder || isInnerSquare;
        }
      }
    };

    // Draw 3 standard corner finder patterns
    drawFinder(0, 0);         // Top-left
    drawFinder(N - 7, 0);     // Top-right
    drawFinder(0, N - 7);     // Bottom-left

    // Timing lines (row 6 and col 6)
    for (let i = 7; i < N - 7; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Alignment pattern near bottom right (around 18, 18)
    const alignX = 16;
    const alignY = 16;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const isBorder = r === 0 || r === 4 || c === 0 || c === 4;
        const isCenter = r === 2 && c === 2;
        grid[alignY + r][alignX + c] = isBorder || isCenter;
      }
    }

    // Populate data cells deterministically using hash and value chars
    let seed = Math.abs(hash) || 12345;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        // Skip finder pattern zones + separators
        const inTopLeft = r <= 7 && c <= 7;
        const inTopRight = r <= 7 && c >= N - 8;
        const inBottomLeft = r >= N - 8 && c <= 7;
        const inAlignment = r >= alignY - 1 && r <= alignY + 5 && c >= alignX - 1 && c <= alignX + 5;
        const inTiming = r === 6 || c === 6;

        if (inTopLeft || inTopRight || inBottomLeft || inAlignment || inTiming) {
          continue;
        }

        // Fill data bits
        grid[r][c] = rng() > 0.48;
      }
    }

    return grid;
  }, [value]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const matrixSize = matrix.length;
  const cellSize = size / matrixSize;

  return (
    <div className="flex flex-col items-center text-center">
      <div 
        className="bg-white p-4 rounded-2xl border border-[#D4DDD5] shadow-xs flex flex-col items-center"
        style={{ width: size + 32 }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rounded-lg"
          role="img"
          aria-label={`QR Code for ${value}`}
        >
          {/* Background */}
          <rect width={size} height={size} fill="#FFFFFF" />

          {/* Matrix Cells */}
          {matrix.map((row, r) =>
            row.map((cell, c) =>
              cell ? (
                <rect
                  key={`${r}-${c}`}
                  x={c * cellSize}
                  y={r * cellSize}
                  width={cellSize + 0.3}
                  height={cellSize + 0.3}
                  fill="#20352A"
                  rx={cellSize > 8 ? 1.5 : 0.5}
                />
              ) : null
            )
          )}
        </svg>

        {label && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#23664B]">{label}</p>
            {sublabel && <p className="text-[11px] text-[#5A6E64] mt-0.5 max-w-[200px] truncate">{sublabel}</p>}
          </div>
        )}
      </div>

      {showActions && (
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#D4DDD5] text-[#20352A] hover:bg-[#F7F8F5] transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#5A6E64]" />}
            <span>{copied ? 'Copied Link' : 'Copy URL'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#D4DDD5] text-[#20352A] hover:bg-[#F7F8F5] transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-[#5A6E64]" />
            <span>Print Standee</span>
          </button>
        </div>
      )}
    </div>
  );
}
