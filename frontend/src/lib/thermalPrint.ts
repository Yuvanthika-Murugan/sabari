/** Element id of the receipt copy that ThermalReceipt attaches to <body> for printing. */
export const PRINT_ID = 'thermal-receipt-print';

/**
 * Prints only the receipt, sized for 2-inch (58 mm) thermal paper, through the
 * phone's print screen (pick the Bluetooth printer there, e.g. via RawBT).
 */
export function printThermalReceipt() {
  const style = document.createElement('style');
  style.textContent = `
    @page { size: 58mm auto; margin: 0; }
    @media print {
      html, body { width: 58mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
      body > *:not(#${PRINT_ID}) { display: none !important; }
      #${PRINT_ID} { display: block !important; }
    }`;
  document.head.appendChild(style);
  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // Some mobile browsers never fire afterprint; drop the style once printing has started.
  setTimeout(cleanup, 60_000);
}
