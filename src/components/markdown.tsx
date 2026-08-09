import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Markdown rendering for README content.
 *
 * react-markdown is used without rehype-raw, so raw HTML embedded in a README
 * or returned by the model is escaped rather than executed. Do not add
 * rehype-raw here: this content is untrusted.
 */
const PROSE =
  '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold ' +
  '[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold ' +
  '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold ' +
  '[&_p]:mb-2 [&_li]:my-0.5 ' +
  '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 ' +
  '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs ' +
  '[&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs ' +
  '[&_pre_code]:rounded-none [&_pre_code]:p-0 ' +
  '[&_a]:underline [&_a]:underline-offset-2 [&_a]:opacity-80 hover:[&_a]:opacity-100 ' +
  '[&_img]:inline [&_img]:h-5 [&_img]:max-w-[160px] [&_img]:object-contain [&_img]:align-middle ' +
  '[&_blockquote]:mb-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:opacity-70 ' +
  '[&_hr]:my-3 [&_hr]:border-t ' +
  // Wide tables scroll inside their own wrapper instead of pushing the page sideways.
  '[&_table]:mb-2 [&_table]:w-full [&_table]:text-xs ' +
  '[&_th]:py-1 [&_th]:pr-3 [&_th]:text-left [&_th]:font-semibold ' +
  '[&_td]:py-0.5 [&_td]:pr-3 ' +
  '[&_h1]:text-slate-900 [&_h2]:text-slate-800 [&_h3]:text-slate-700 ' +
  '[&_code]:bg-slate-100 [&_pre]:bg-slate-50 [&_blockquote]:border-slate-300 [&_hr]:border-slate-200 ' +
  'dark:[&_h1]:text-slate-100 dark:[&_h2]:text-slate-200 dark:[&_h3]:text-slate-300 ' +
  'dark:[&_code]:bg-white/10 dark:[&_pre]:bg-black/30 dark:[&_blockquote]:border-white/20 ' +
  'dark:[&_hr]:border-white/10'

export function Markdown({ children }: { children: string }) {
  return (
    <div className={`break-words ${PROSE}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Force external links to open safely.
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer nofollow ugc" />
          ),
          table: ({ node: _node, ...props }) => (
            <div className="-mx-1 overflow-x-auto px-1">
              <table {...props} />
            </div>
          ),
          img: ({ node: _node, ...props }) => (
            <img {...props} loading="lazy" decoding="async" alt={props.alt ?? ''} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
