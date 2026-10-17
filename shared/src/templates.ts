// Adding a new preset is a one-line addition here — no schema or backend
// change needed. "Custom" is handled in the UI, not listed here.
export const SPLIT_TEMPLATES = [
  { name: '6-Day PPL', days: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'] },
  { name: '5-Day PPL + Upper/Lower', days: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'] },
  { name: '4-Day Upper/Lower', days: ['Upper', 'Lower', 'Upper', 'Lower'] },
  { name: '3-Day PPL', days: ['Push', 'Pull', 'Legs'] },
  { name: '2-Day Upper/Lower', days: ['Upper', 'Lower'] },
]
