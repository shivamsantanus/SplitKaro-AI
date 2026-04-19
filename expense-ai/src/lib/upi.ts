export type UpiApp = {
  name: string
  bg: string          // background colour
  fg: string          // foreground / text colour
  scheme: string      // URL scheme prefix, e.g. "phonepe://pay"
}

export const UPI_APPS: UpiApp[] = [
  { name: "PhonePe",    bg: "#5f259f", fg: "#fff", scheme: "phonepe://pay"    },
  { name: "Google Pay", bg: "#4285F4", fg: "#fff", scheme: "gpay://upi/pay"   },
  { name: "Paytm",      bg: "#00BAF2", fg: "#fff", scheme: "paytmmp://pay"    },
  { name: "BHIM",       bg: "#00704A", fg: "#fff", scheme: "upi://pay"        },
  { name: "Amazon Pay", bg: "#FF9900", fg: "#fff", scheme: "amazonpay://pay"  },
  { name: "WhatsApp",   bg: "#25D366", fg: "#fff", scheme: "whatsapp://upi/pay" },
]

function upiParams(
  receiverUpiId: string,
  receiverName: string,
  amount: number,
  groupName: string
) {
  return (
    `pa=${receiverUpiId}` +
    `&pn=${encodeURIComponent(receiverName)}` +
    `&am=${amount}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(`Settling in ${groupName}`)}`
  )
}

export function generateUpiLink(
  app: UpiApp,
  receiverUpiId: string,
  receiverName: string,
  amount: number,
  groupName: string
): string {
  return `${app.scheme}?${upiParams(receiverUpiId, receiverName, amount, groupName)}`
}

// Returns the generic upi:// link (for copying / fallback)
export function generateGenericUpiLink(
  receiverUpiId: string,
  receiverName: string,
  amount: number,
  groupName: string
): string {
  return `upi://pay?${upiParams(receiverUpiId, receiverName, amount, groupName)}`
}
