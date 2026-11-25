/** UPI payment link (NPCI "upi://pay") that any UPI app can scan; the amount is filled in for the payer. */
export function upiLink(upiId: string, payeeName: string, amount: number, note: string): string {
  const params = new URLSearchParams({ pa: upiId, pn: payeeName || upiId, am: amount.toFixed(2), cu: 'INR' });
  if (note) params.set('tn', note.slice(0, 50));
  return `upi://pay?${params.toString()}`;
}
