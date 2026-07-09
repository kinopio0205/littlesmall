export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatMonth(iso: string): string {
  return iso.slice(0, 7);
}
