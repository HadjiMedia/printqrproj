import React, { useState } from 'react';
import { Printer, Copy, Check } from 'lucide-react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  showActions?: boolean;
}

export function QRCodeDisplay({
  value,
  size = 200,
  label,
  sublabel,
  showActions = true,
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  // Use a real QR encoder. The previous hand-drawn matrix only looked like a QR
  // code; it did not contain the URL data and could not be scanned.
  // Request a larger image so the printed standee stays sharp.
  const sourceSize = Math.min(1000, Math.max(300, Math.round(size * 3)));
  const qrImageUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=${sourceSize}x${sourceSize}&data=${encodeURIComponent(value)}&color=20352A&bgcolor=FFFFFF&qzone=4&margin=4&ecc=M&format=png`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Keep the URL visible below when clipboard access is unavailable.
      setCopied(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="bg-white p-4 rounded-2xl border border-[#D4DDD5] shadow-xs flex flex-col items-center"
        style={{ width: size + 32 }}
      >
        {!imageFailed ? (
          <img
            src={qrImageUrl}
            width={size}
            height={size}
            alt={`Scannable QR code linking to ${value}`}
            className="block rounded-lg object-contain"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            role="status"
            className="flex flex-col items-center justify-center gap-2 text-xs text-[#5A6E64]"
            style={{ width: size, height: size }}
          >
            <p className="font-semibold text-[#20352A]">QR code could not load.</p>
            <p className="break-all">{value}</p>
            <button
              type="button"
              onClick={() => setImageFailed(false)}
              className="underline font-semibold text-[#23664B]"
            >
              Try again
            </button>
          </div>
        )}

        {label && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#23664B]">{label}</p>
            {sublabel && (
              <p className="text-[11px] text-[#5A6E64] mt-0.5 max-w-[200px] truncate">
                {sublabel}
              </p>
            )}
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
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#5A6E64]" />
            )}
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
