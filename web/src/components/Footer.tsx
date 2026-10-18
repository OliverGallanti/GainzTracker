import { useRef } from 'react'

// Everything the app stands on. Open Food Facts is listed with its licence
// because ODbL requires attribution; the rest is credit where it's due.
const CREDITS = [
  {
    title: 'Food data',
    items: [
      {
        name: 'Open Food Facts',
        url: 'https://world.openfoodfacts.org',
        note: 'Barcode lookups. Community-edited data, available under the Open Database License (ODbL).',
      },
    ],
  },
  {
    title: 'App',
    items: [
      { name: 'React', url: 'https://react.dev' },
      { name: 'Vite', url: 'https://vite.dev' },
      { name: 'Tailwind CSS', url: 'https://tailwindcss.com' },
      { name: 'Recharts', url: 'https://recharts.org' },
      { name: 'Lucide', url: 'https://lucide.dev', note: 'icons' },
      { name: 'Manrope', url: 'https://fonts.google.com/specimen/Manrope', note: 'typeface' },
      { name: 'ZXing', url: 'https://github.com/zxing-js/library', note: 'barcode scanning' },
    ],
  },
  {
    title: 'Server',
    items: [
      { name: 'Fastify', url: 'https://fastify.dev' },
      { name: 'Prisma', url: 'https://www.prisma.io' },
      { name: 'PostgreSQL', url: 'https://www.postgresql.org' },
      { name: 'Zod', url: 'https://zod.dev' },
      { name: 'SimpleWebAuthn', url: 'https://simplewebauthn.dev', note: 'passkeys' },
    ],
  },
]

const AUTHOR_LINKS = [
  { name: 'Portfolio', url: 'https://olivergallanti.vercel.app/' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/olivergallanti/' },
]

const linkClass = 'underline decoration-secondary/40 underline-offset-2 hover:decoration-secondary'

function Footer() {
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <footer className="mt-auto px-4 py-6 text-center text-xs text-third/60 sm:px-6">
      Made by Oliver Gallanti
      {AUTHOR_LINKS.map((link) => (
        <span key={link.name}>
          {' · '}
          <a href={link.url} target="_blank" rel="noreferrer" className={linkClass}>
            {link.name}
          </a>
        </span>
      ))}
      {' · '}
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={linkClass}>
        Credits
      </button>

      {/* Native <dialog>: focus trapping, Esc to close and the backdrop come with it. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="credits-title"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()} // click on the backdrop
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-secondary/40 bg-card p-6 text-left text-third shadow-2xl shadow-black/60 backdrop:bg-black/60 sm:p-8"
      >
        <h2 id="credits-title" className="text-sm font-semibold">
          Credits
        </h2>
        <p className="mt-2 text-xs text-third/60">
          Made by Oliver Gallanti, standing on a lot of open-source work.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {CREDITS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1.5 text-xs font-semibold">{group.title}</h3>
              <ul className="flex flex-col gap-1 text-xs text-third/60">
                {group.items.map((item) => (
                  <li key={item.name}>
                    <a href={item.url} target="_blank" rel="noreferrer" className={`text-third ${linkClass}`}>
                      {item.name}
                    </a>
                    {item.note && <span> - {item.note}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <form method="dialog" className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg border border-secondary/40 px-4 py-2 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
          >
            Close
          </button>
        </form>
      </dialog>
    </footer>
  )
}

export default Footer
