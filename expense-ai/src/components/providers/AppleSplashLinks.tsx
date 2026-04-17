// Server component — renders <link rel="apple-touch-startup-image"> for every
// major iPhone/iPad size so iOS shows a branded splash instead of a white screen.
// Physical dimensions must exactly match what iOS expects for each device.
const SPLASH_SCREENS = [
  { w:  750, h: 1334, cssW: 375, cssH:  667, dpr: 2 }, // iPhone SE 2nd/3rd
  { w: 1125, h: 2436, cssW: 375, cssH:  812, dpr: 3 }, // iPhone X / XS / 11 Pro
  { w:  828, h: 1792, cssW: 414, cssH:  896, dpr: 2 }, // iPhone XR / 11
  { w: 1242, h: 2688, cssW: 414, cssH:  896, dpr: 3 }, // iPhone XS Max / 11 Pro Max
  { w: 1080, h: 2340, cssW: 360, cssH:  780, dpr: 3 }, // iPhone 12 mini / 13 mini
  { w: 1170, h: 2532, cssW: 390, cssH:  844, dpr: 3 }, // iPhone 12 / 13 / 14
  { w: 1284, h: 2778, cssW: 428, cssH:  926, dpr: 3 }, // iPhone 12/13 Pro Max / 14 Plus
  { w: 1179, h: 2556, cssW: 393, cssH:  852, dpr: 3 }, // iPhone 14 Pro / 15 / 15 Pro
  { w: 1290, h: 2796, cssW: 430, cssH:  932, dpr: 3 }, // iPhone 14 Pro Max / 15 Plus / 15 Pro Max
  { w: 1536, h: 2048, cssW: 768, cssH: 1024, dpr: 2 }, // iPad Mini / Air
  { w: 1668, h: 2388, cssW: 834, cssH: 1194, dpr: 2 }, // iPad Pro 11"
  { w: 2048, h: 2732, cssW:1024, cssH: 1366, dpr: 2 }, // iPad Pro 12.9"
]

export function AppleSplashLinks() {
  return (
    <>
      {SPLASH_SCREENS.map(({ w, h, cssW, cssH, dpr }) => (
        <link
          key={`${w}x${h}`}
          rel="apple-touch-startup-image"
          href={`/splash/splash-${w}x${h}.png`}
          media={`(device-width: ${cssW}px) and (device-height: ${cssH}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`}
        />
      ))}
    </>
  )
}
