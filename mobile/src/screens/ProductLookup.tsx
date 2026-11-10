import { useRef, useState } from 'react'
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { formatMacro } from '@gainz/shared/macros'
import type { Product } from '@gainz/shared/types'
import { api } from '../api'
import { useIsOnline } from '../offline'
import { colors } from '../theme'
import { Text, Button, ErrorText, Field, Muted, animateLayout, styles as ui } from '../ui'

const BARCODE = /^\d{8,14}$/

// Find a food on Open Food Facts: by name (fruit, bread, anything without a
// barcode at hand), or by barcode, scanned or typed. Server routes
// /api/products/search and /api/products/:barcode.
// Searches on the button, not per keystroke: OFF is a free service. Needs a connection, since the
// product data lives on the server, not the phone.
export default function ProductLookup({ onFound }: { onFound: (product: Product) => void }) {
  const online = useIsOnline()
  const [scanning, setScanning] = useState(false)
  const [code, setCode] = useState('')
  const [looking, setLooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[] | null>(null)

  const search = async () => {
    setError(null)
    setLooking(true)
    try {
      const found = await api<Product[]>(`/api/products/search?q=${encodeURIComponent(query.trim())}`)
      animateLayout()
      setResults(found)
    } catch {
      setError('Could not reach the food database: please try again')
    } finally {
      setLooking(false)
    }
  }

  const choose = (product: Product) => {
    setResults(null)
    onFound(product)
  }

  const lookup = async (barcode: string) => {
    setError(null)
    if (!BARCODE.test(barcode)) return setError('A barcode is 8 to 14 digits')
    setLooking(true)
    try {
      const product = await api<Product | null>(`/api/products/${barcode}`)
      if (product) onFound(product)
      else setError('No product found for that barcode: enter it manually')
    } catch {
      setError('Could not reach the food database: please try again')
    } finally {
      setLooking(false)
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={ui.label}>Food database</Text>
      {online ? (
        <>
          <View style={[ui.row, { alignItems: 'flex-end' }]}>
            <Field
              label="Search by name"
              value={query}
              onChange={setQuery}
              placeholder="e.g. plátano canario"
              returnKeyType="search"
              onSubmitEditing={() => query.trim().length >= 2 && void search()}
            />
            <Button label={looking ? 'Searching…' : 'Search'} variant="secondary" onPress={() => void search()} disabled={looking || query.trim().length < 2} />
          </View>
          {results && (
            <View>
              {results.map((product) => (
                <Pressable
                  key={product.barcode}
                  onPress={() => choose(product)}
                  accessibilityRole="button"
                  accessibilityLabel={`${product.name}${product.brand ? `, ${product.brand}` : ''}, ${summary(product)}`}
                  style={({ pressed }) => [styles.result, pressed && ui.dim]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={ui.text} numberOfLines={1}>
                      {product.name}
                    </Text>
                    {product.brand && <Muted>{product.brand}</Muted>}
                  </View>
                  <Muted>{summary(product)}</Muted>
                </Pressable>
              ))}
              {results.length === 0 && <Muted>Nothing found with nutrition values: try other words, or enter it manually.</Muted>}
            </View>
          )}
          <View style={[ui.row, { alignItems: 'flex-end' }]}>
            <Button label="Scan barcode" variant="secondary" onPress={() => setScanning(true)} disabled={looking} />
            <Field label="or type the number" value={code} onChange={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          </View>
          {code !== '' && (
            <Button label={looking ? 'Looking up…' : 'Look up'} variant="secondary" onPress={() => void lookup(code)} disabled={looking} />
          )}
        </>
      ) : (
        <Muted>The food database needs a connection.</Muted>
      )}
      {error && <ErrorText>{error}</ErrorText>}

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <Scanner
          onScanned={(barcode) => {
            setScanning(false)
            setCode(barcode)
            void lookup(barcode)
          }}
          onClose={() => setScanning(false)}
        />
      </Modal>
    </View>
  )
}

function Scanner({ onScanned, onClose }: { onScanned: (barcode: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions()
  // The camera reports the same barcode on every frame it sees it; take the first.
  const done = useRef(false)
  const insets = useSafeAreaInsets() // keeps Cancel above the phone's navigation bar

  const handleScan = ({ data }: BarcodeScanningResult) => {
    if (done.current) return
    done.current = true
    onScanned(data)
  }

  if (!permission) return <View style={styles.full} />

  if (!permission.granted) {
    return (
      <View style={[styles.full, styles.center]}>
        <Text style={[ui.text, styles.message]}>The camera is used to read food barcodes. Nothing is recorded or stored.</Text>
        {permission.canAskAgain ? (
          <Button label="Allow camera" onPress={() => void requestPermission()} />
        ) : (
          <Button label="Open settings" onPress={() => void Linking.openSettings()} />
        )}
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    )
  }

  return (
    <View style={styles.full}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={handleScan}
      />
      <View style={[styles.footer, { bottom: insets.bottom + 16 }]}>
        <Text style={[ui.text, styles.message]}>Point the camera at the barcode</Text>
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </View>
  )
}

// Per 100 g, as OFF lists them.
const summary = (product: Product) =>
  [`${product.per100g.calories} cal`, formatMacro(product.per100g.proteinG, 'g P')].filter(Boolean).join(' · ') + ' /100 g'

const styles = StyleSheet.create({
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  full: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.main },
  message: { textAlign: 'center' },
  footer: { position: 'absolute', left: 16, right: 16, gap: 12, padding: 16, borderRadius: 16, backgroundColor: 'rgba(3, 22, 31, 0.85)' },
})
