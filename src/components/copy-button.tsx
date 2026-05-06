'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard might be blocked (e.g. http://). Silently swallow.
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}
