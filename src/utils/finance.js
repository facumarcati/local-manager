export function money(value) {
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n <= 0 ||
    Math.abs(n * 100 - Math.round(n * 100)) > 0.00001
  )
    throw new Error(
      "Ingresá un importe mayor a cero, con hasta dos decimales.",
    );
  return n;
}
export function dateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || ""))
    throw new Error("Ingresá una fecha válida.");
  const date = new Date(value + "T00:00:00.000Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new Error("Ingresá una fecha válida.");
  return date;
}
export function todayString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function todayUTC() {
  return dateOnly(todayString());
}
export function balance(p) {
  return Math.max(0, Math.round((p.amount - (p.paidAmount || 0)) * 100) / 100);
}
export function state(p) {
  return balance(p) === 0 ? "paid" : p.paidAmount > 0 ? "partial" : "pending";
}
export function decorate(p) {
  return {
    ...p,
    remaining: balance(p),
    overdue: balance(p) > 0 && new Date(p.dueDate) < todayUTC(),
  };
}
export function text(value, label) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Completá " + label + ".");
  return value.trim();
}
export function validContract(data) {
  const startDate = dateOnly(data.startDate),
    endDate = dateOnly(data.endDate);
  if (endDate < startDate)
    throw new Error("La fecha de fin debe ser posterior al inicio.");
  const paymentDay = Number(data.paymentDay);
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31)
    throw new Error("El día de vencimiento debe estar entre 1 y 31.");
  if (endDate.getUTCFullYear() - startDate.getUTCFullYear() > 50)
    throw new Error("El contrato no puede superar 50 años.");
  return {
    tenantName: text(data.tenantName, "el nombre del inquilino"),
    baseRent: money(data.baseRent),
    paymentDay,
    startDate,
    endDate,
  };
}
