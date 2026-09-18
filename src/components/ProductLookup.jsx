import { useState } from 'react'
import { api } from '../lib/api'
import { useSubmit, ValidationError } from '../lib/useSubmit'
import BarcodeScanner from './BarcodeScanner'

const BARCODE = /^\d{8,14}$/

// Find a packaged food by barcode — scanned with the camera, or typed for when
// there's no camera. Calls onFound(product) with the Open Food Facts result.
// Not a <form>: this sits inside the meal form, and forms can't nest.
function ProductLookup({ onFound }) {
  const [scanning, setScanning] = useState(false)
  const [code, setCode] = useState('')

  const { submit: lookup, saving, error } = useSubmit(async (barcode) => {
    if (!BARCODE.test(barcode)) throw new ValidationError('A barcode is 8 to 14 digits')
    const product = await api(`/api/products/${barcode}`)
    if (!product) throw new ValidationError('No product found for that barcode — enter it manually')
    onFound(product)
  }, 'Could not reach the food database — please try again')

  const handleDetected = (barcode) => {
    setScanning(false)
    setCode(barcode)
    lookup(barcode)
  }

  return (
    <div>
      <span className="text-xs text-third/60">Packaged food</span>
      <div className="mt-1 flex gap-2">
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
            e.preventDefault() // Enter would otherwise submit the meal form around this
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
    </div>
  )
}

export default ProductLookup
