import { useState } from 'react'
import { formatMacro } from '@gainz/shared/macros'
import type { Product } from '@gainz/shared/types'
import { api } from '../lib/api'
import { useSubmit, ValidationError } from '../lib/useSubmit'
import BarcodeScanner from './BarcodeScanner'

const BARCODE = /^\d{8,14}$/

const SECTION = 'rounded-xl border border-secondary/30 p-4'

// The Food database step of Log food (LogFoodDialog): Open Food Facts by name
// (for food without a barcode at hand), or by barcode, scanned with the camera
// or typed for when there's no camera. Calls onFound(product). Name search runs
// on Enter or the button, not per keystroke: OFF is a free service.

function ProductLookup({ onFound }: { onFound: (product: Product) => void }) {
  const [scanning, setScanning] = useState(false)
  const [code, setCode] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[] | null>(null)

  const search = useSubmit(async (q: string) => {
    if (q.trim().length < 2) throw new ValidationError('Type at least 2 letters')
    setResults(await api<Product[]>(`/api/products/search?q=${encodeURIComponent(q.trim())}`))
  }, 'Could not reach the food database: please try again')

  const choose = (product: Product) => {
    setResults(null)
    onFound(product)
  }

  const { submit: lookup, saving, error } = useSubmit(async (barcode) => {
    if (!BARCODE.test(barcode)) throw new ValidationError('A barcode is 8 to 14 digits')
    const product = await api<Product | null>(`/api/products/${barcode}`)
    if (!product) throw new ValidationError('No product found for that barcode: enter it manually')
    onFound(product)
  }, 'Could not reach the food database: please try again')

  const handleDetected = (barcode: string) => {
    setScanning(false)
    setCode(barcode)
    lookup(barcode)
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={SECTION}>
        <h3 className="mb-2 text-sm font-semibold text-third">Search by name</h3>
        <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            search.submit(query)
          }}
          placeholder="Search by name, e.g. plátano canario"
          aria-label="Search foods by name"
          className="min-w-0 flex-1 rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-sm text-third outline-none focus:border-secondary"
        />
        <button
          type="button"
          onClick={() => search.submit(query)}
          disabled={search.saving || query.trim().length < 2}
          className="shrink-0 rounded-lg border border-secondary/40 px-3 py-1.5 text-sm font-medium text-third transition hover:border-secondary disabled:opacity-60 active:scale-[0.98]"
        >
          {search.saving ? 'Searching…' : 'Search'}
        </button>
      </div>
      {search.error && <p className="mt-1 text-xs text-red-400">{search.error}</p>}
      {results && (
        <ul className="mt-1 divide-y divide-secondary/20 rounded-lg border border-secondary/30">
          {results.map((product) => (
            <li key={product.barcode}>
              <button
                type="button"
                onClick={() => choose(product)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-third transition hover:bg-secondary/10"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{product.name}</span>
                  {product.brand && <span className="block truncate text-xs text-third/60">{product.brand}</span>}
                </span>
                <span className="shrink-0 text-xs text-third/60">
                  {[`${product.per100g.calories} cal`, formatMacro(product.per100g.proteinG, 'g P')].filter(Boolean).join(' · ')} /100 g
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-2 text-xs text-third/60">Nothing found with nutrition values: try other words, or enter it manually.</li>
          )}
        </ul>
      )}
        <p className="mt-2 text-xs text-third/60">Results come from Open Food Facts, which anyone can edit: check them against the pack.</p>
      </section>

      <section className={SECTION}>
        <h3 className="mb-2 text-sm font-semibold text-third">Barcode</h3>
        <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScanning((v) => !v)}
          aria-expanded={scanning}
          className="shrink-0 rounded-lg border border-secondary/40 px-3 py-1.5 text-sm font-medium text-third transition hover:border-secondary active:scale-[0.98]"
        >
          Scan barcode
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            lookup(code)
          }}
          placeholder="or type the number"
          aria-label="Barcode number"
          className="min-w-0 flex-1 rounded-lg border border-secondary/40 bg-main px-2 py-1.5 text-sm text-third outline-none focus:border-secondary"
        />
        <button
          type="button"
          onClick={() => lookup(code)}
          disabled={saving || !code}
          className="shrink-0 rounded-lg border border-secondary/40 px-3 py-1.5 text-sm font-medium text-third transition hover:border-secondary disabled:opacity-60 active:scale-[0.98]"
        >
          {saving ? 'Looking…' : 'Look up'}
        </button>
      </div>

      {scanning && (
        <div className="mt-2">
          <BarcodeScanner onDetected={handleDetected} onClose={() => setScanning(false)} />
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </section>
    </div>
  )
}

export default ProductLookup
