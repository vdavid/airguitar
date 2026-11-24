/**
 * Beat icons, drawn like `ui/icons.ts` (24 × 24, stroked in `currentColor`) so they match the rest
 * of the top bar.
 */
const svg = (body: string, size = 20): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const BEAT_ICON = {
  /** A drum with sticks. */
  beat: svg(
    '<ellipse cx="12" cy="11" rx="8" ry="3"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><path d="m7 3 4 6M17 3l-4 6"/>',
  ),
  /** Mixer faders. */
  parts: svg(
    '<path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1"/><rect x="10" y="7" width="4" height="3" rx="1"/><rect x="16" y="11" width="4" height="3" rx="1"/>',
  ),
  minus: svg('<path d="M6 12h12"/>', 16),
  plus: svg('<path d="M6 12h12M12 6v12"/>', 16),
} as const
