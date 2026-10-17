import { useEffect, useRef, useState } from 'react'

// Retail barcodes only — restricting the decoder to these makes it faster and
// stops it "finding" barcodes in the packaging's other patterns.
const FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'] as const

// Opens the rear camera and calls onDetected(digits) once, then stops. ZXing is
// imported on demand so its weight is only paid when someone actually scans.
function BarcodeScanner({ onDetected, onClose }: { onDetected: (barcode: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectedRef = useRef(onDetected)
  const [error, setError] = useState<string | null>(null)

  // getUserMedia only exists on https:// or localhost.
  const supported = Boolean(navigator.mediaDevices?.getUserMedia)

  useEffect(() => {
    onDetectedRef.current = onDetected
  })

  // Each effect run waits for the previous one to finish releasing the camera.
  // Both share one <video>, and stopping a stream clears that element — so without
  // this, a late stop from an earlier run (React StrictMode mounts twice in dev,
  // and a quick close/reopen does the same) blanks the run that replaced it.
  const previous = useRef(Promise.resolve())

  useEffect(() => {
    if (!supported) return

    let stopped = false
    let controls: { stop: () => void } | null = null

    const run = previous.current.then(async () => {
      if (stopped) return // cleaned up before its turn, so never touch the camera
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, FORMATS.map((f) => BarcodeFormat[f])]])
        controls = await new BrowserMultiFormatReader(hints).decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current ?? undefined,
          (result, _err, live) => {
            if (!result || stopped) return
            stopped = true
            live.stop()
            onDetectedRef.current(result.getText())
          },
        )
      } catch (err) {
        if (stopped) return
        setError(
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it in your browser, or type the number instead.'
            : 'Could not start the camera. You can type the number instead.',
        )
      }
    })
    previous.current = run

    return () => {
      stopped = true
      run.then(() => controls?.stop())
    }
  }, [supported])

  const message = !supported
    ? 'The camera needs a secure (https) connection. You can type the number instead.'
    : error

  return (
    <div className="rounded-lg border border-secondary/25 p-2">
      {message ? (
        <p className="px-1 py-2 text-xs text-red-400">{message}</p>
      ) : (
        <>
          <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-md bg-black object-cover" />
          <p className="mt-2 px-1 text-xs text-third/60">Point the camera at the barcode.</p>
        </>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-1 px-1 text-xs font-medium text-third/60 transition hover:text-third"
      >
        Close camera
      </button>
    </div>
  )
}

export default BarcodeScanner
