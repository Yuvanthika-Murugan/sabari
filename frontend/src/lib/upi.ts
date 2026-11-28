/**
 * UPI payment link (NPCI "upi://pay") that any UPI app can scan. With an amount it is
 * filled in for the payer; with 0 the payer types the amount in their app.
 */
export function upiLink(upiId: string, payeeName: string, amount: number, note: string): string {
  const params = new URLSearchParams({ pa: upiId, pn: payeeName || upiId, cu: 'INR' });
  if (amount > 0) params.set('am', amount.toFixed(2));
  if (note) params.set('tn', note.slice(0, 50));
  return `upi://pay?${params.toString()}`;
}
