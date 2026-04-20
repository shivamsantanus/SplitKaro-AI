export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export type UpiApp = {
  id: string
  name: string
  scheme: string
}

// App-specific iOS schemes — each scheme is registered by exactly one app,
// so iOS opens the right app directly without ambiguity.
export const IOS_UPI_APPS: UpiApp[] = [
  { id: "phonepe", name: "PhonePe",    scheme: "phonepe://pay" },
  { id: "gpay",    name: "Google Pay", scheme: "tez://upi/pay" },
  { id: "paytm",   name: "Paytm",      scheme: "paytmmp://pay" },
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
