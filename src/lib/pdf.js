import { APP_TAGLINE } from './config'
import { formatDate, money, monthLabel, monthKeyOf } from './utils'

// jsPDF is large, so it is loaded only when someone opens a receipt.
const loadJsPDF = () => import('jspdf').then((module) => module.jsPDF)

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`
}

function threeDigits(n) {
  if (n < 100) return twoDigits(n)
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ''}`
}

export function amountInWords(value) {
  const n = Math.round(Number(value) || 0)
  if (n === 0) return 'Zero Rupees Only'
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  const parts = []
  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (rest) parts.push(threeDigits(rest))
  return `${parts.join(' ')} Rupees Only`
}

function methodLabel(method) {
  return method === 'bank' ? 'Bank / UPI' : 'Cash'
}

export async function buildReceiptPdf(receipt) {
  const jsPDF = await loadJsPDF()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const margin = 18
  const width = pageWidth - margin * 2

  doc.setFillColor(44, 87, 224)
  doc.rect(0, 0, pageWidth, 46, 'F')
  doc.setFillColor(123, 77, 255)
  doc.circle(196, 8, 26, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text('PAFOWA', margin, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.text(APP_TAGLINE, margin, 30)
  doc.setFontSize(9)
  doc.text('MAINTENANCE PAYMENT RECEIPT', margin, 38)

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Payment receipt', margin, 61)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text('Receipt number', margin, 71)
  doc.text('Issued on', pageWidth - margin, 71, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text(receipt.receipt_number || '—', margin, 78)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(formatDate(receipt.issued_at), pageWidth - margin, 78, { align: 'right' })

  // Amount block
  doc.setFillColor(243, 247, 255)
  doc.roundedRect(margin, 88, width, 40, 4, 4, 'F')
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10.5)
  doc.text('Amount received', margin + 8, 99)
  doc.setTextColor(44, 87, 224)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text(`Rs. ${money(receipt.amount, { exact: false }).replace('₹', '').trim()}`, margin + 8, 113)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(71, 85, 105)
  doc.text(amountInWords(receipt.amount), margin + 8, 120)

  doc.setFillColor(220, 252, 231)
  doc.roundedRect(pageWidth - margin - 44, 96, 36, 12, 6, 6, 'F')
  doc.setTextColor(22, 101, 52)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CONFIRMED', pageWidth - margin - 26, 103.5, { align: 'center' })

  const rows = [
    ['Resident name', receipt.resident_name || '—'],
    ['Apartment / unit', receipt.unit_label || '—'],
    [
      'Maintenance for',
      `${monthLabel(monthKeyOf(receipt.maintenance_month))} (month of usage)`,
    ],
    ['Payment date', formatDate(receipt.payment_date)],
    ['Payment method', methodLabel(receipt.payment_method)],
  ]
  if (receipt.payment_method === 'bank') {
    rows.push(['Transaction ID / UTR', receipt.transaction_id || '—'])
    if (receipt.upi_id) rows.push(['UPI ID', receipt.upi_id])
  }
  rows.push(['Confirmation status', 'Confirmed by treasurer'])

  let y = 141
  doc.setDrawColor(226, 232, 240)
  rows.forEach(([label, value], index) => {
    if (index > 0) doc.line(margin, y - 7, pageWidth - margin, y - 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(100, 116, 139)
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(11.5)
    const valueLines = doc.splitTextToSize(String(value), width - 70)
    doc.text(valueLines, margin + 62, y)
    y += Math.max(12, valueLines.length * 6 + 6)
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(
    'Maintenance month is the month of usage. The payment date is when the amount was received.',
    margin,
    258,
  )
  doc.text('This is a computer generated receipt. Thank you for paying on time.', margin, 264)

  doc.setDrawColor(148, 163, 184)
  doc.line(pageWidth - margin - 55, 278, pageWidth - margin, 278)
  doc.setTextColor(71, 85, 105)
  doc.text('Treasurer', pageWidth - margin - 20, 283, { align: 'center' })

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 292, pageWidth, 5, 'F')

  return doc
}

export async function downloadReceiptPdf(receipt) {
  const doc = await buildReceiptPdf(receipt)
  doc.save(`${receipt.receipt_number || 'PAFOWA-receipt'}.pdf`)
}

export async function receiptBlob(receipt) {
  const doc = await buildReceiptPdf(receipt)
  return doc.output('blob')
}
