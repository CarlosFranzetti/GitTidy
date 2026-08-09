import { Muted } from './ui'

const GUIDES = [
  {
    label: 'Vercel',
    href: 'https://vercel.com/docs/deployments/git/vercel-for-github',
    hint: 'Best for React, Next.js and static sites',
  },
  {
    label: 'Netlify',
    href: 'https://docs.netlify.com/welcome/add-new-site/',
    hint: 'Similar to Vercel, generous free tier',
  },
  {
    label: 'GitHub Pages',
    href: 'https://docs.github.com/pages/getting-started-with-github-pages',
    hint: 'Free static hosting straight from the repo',
  },
]

/**
 * Shown under the homepage field when a repository has no deploy link. A
 * missing homepage is worth 20 points and is the single most common gap, so the
 * fix is put directly in front of the user rather than left implied.
 */
export function DeployHelp() {
  return (
    <div className="mt-2 rounded-xl border border-dashed border-slate-300 p-3 dark:border-white/15">
      <p className="text-xs font-medium">No deploy link yet — worth 20 points.</p>
      <p className="mt-0.5 text-xs">
        <Muted>Publish it free, then paste the URL above.</Muted>
      </p>
      <ul className="mt-2 space-y-1">
        {GUIDES.map((guide) => (
          <li key={guide.label}>
            <a
              href={guide.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 text-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-white/[0.06]"
            >
              <span>
                <span className="block font-medium">Deploy on {guide.label}</span>
                <span className="block text-xs">
                  <Muted>{guide.hint}</Muted>
                </span>
              </span>
              <span aria-hidden="true" className="shrink-0 opacity-60">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
