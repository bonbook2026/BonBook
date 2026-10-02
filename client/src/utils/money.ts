const formatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });

export function formatToman(amount: number): string {
  return `${formatter.format(amount)} تومان`;
}
