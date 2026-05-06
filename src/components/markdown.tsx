import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/**
 * Render a string of GitHub-flavoured markdown with the same typography
 * the rest of the app uses. Server component – no client JS shipped.
 *
 * Usage: <Markdown source={meeting.body ?? ''} />
 *
 * If `source` is empty, renders nothing.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  if (!source.trim()) return null;
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-slate-700',
        // Tighten the default prose spacing a touch — feels heavy in cards.
        'prose-headings:text-slate-900 prose-headings:font-semibold',
        'prose-h1:text-lg prose-h2:text-base prose-h3:text-sm',
        'prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
        'prose-a:text-blue-700 prose-a:font-normal hover:prose-a:underline',
        'prose-code:bg-slate-100 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-mono',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-slate-900 prose-pre:text-slate-100',
        'prose-blockquote:border-slate-200 prose-blockquote:text-slate-600 prose-blockquote:not-italic',
        'prose-table:text-sm',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
