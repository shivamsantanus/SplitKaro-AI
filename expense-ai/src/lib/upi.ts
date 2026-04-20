export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export type UpiApp = {
  id: string
  name: string
  scheme: string
}

// App-specific iOS launch schemes — bare launchers only, no UPI params.
// Pre-filling params via deep link is unreliable on iOS: PhonePe routes to
// QR scanner, GPay (tez://) ignores params on newer builds. User copies the
// UPI ID first, then opens the app to paste it manually.
export const IOS_UPI_APPS: UpiApp[] = [
  { id: "phonepe", name: "PhonePe",    scheme: "phonepe://" },
  { id: "gpay",    name: "Google Pay", scheme: "tez://" },
  { id: "paytm",   name: "Paytm",      scheme: "paytmmp://" },
]

// NPCI-standard UPI deep link for Android — every certified UPI app registers
// as a handler, so the OS shows its native app chooser.
export function generateUpiLink(
  receiverUpiId: string,
  receiverName: string,
  amount: number,
  groupName: string
): string {
  const params =
    `pa=${encodeURIComponent(receiverUpiId)}` +
    `&pn=${encodeURIComponent(receiverName)}` +
    `&am=${amount.toFixed(2)}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(`SplitKaro: ${groupName}`)}`
  return `upi://pay?${params}`
}

// iOS-only: build a link for a specific app using its unique scheme.
export function generateIosAppLink(
  app: UpiApp,
  receiverUpiId: string,
  receiverName: string,
  amount: number,
  groupName: string
): string {
  const params =
    `pa=${encodeURIComponent(receiverUpiId)}` +
    `&pn=${encodeURIComponent(receiverName)}` +
    `&am=${amount.toFixed(2)}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(`SplitKaro: ${groupName}`)}`
  return `${app.scheme}?${params}`
}
