import qrcode from 'qrcode-generator';

/** Draws a QR code for the given text as crisp SVG squares. */
export default function UpiQr({ text, size = 200 }: { text: string; size?: number }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2; // white border, in modules
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  const total = n + quiet * 2;
  return (
    <svg viewBox={`0 0 ${total} ${total}`} width={size} height={size} role="img" aria-label="UPI payment QR code"
      shapeRendering="crispEdges" className="bg-white rounded-lg">
      <rect width={total} height={total} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
