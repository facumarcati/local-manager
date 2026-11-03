export function generatePayments(contract) {
  const start = new Date(contract.startDate),
    end = new Date(contract.endDate);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start > end
  )
    throw new Error("Fechas de contrato inválidas.");
  if (
    !Number.isInteger(Number(contract.paymentDay)) ||
    contract.paymentDay < 1 ||
    contract.paymentDay > 31
  )
    throw new Error("Día de vencimiento inválido.");
  const payments = [];
  let year = start.getUTCFullYear(),
    month = start.getUTCMonth();
  while (Date.UTC(year, month, 1) <= end.getTime()) {
    const day = Math.min(
      Number(contract.paymentDay),
      new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
    );
    const dueDate = new Date(Date.UTC(year, month, day));
    // Incluye el primer mes; si el vencimiento ya pasó, usa el inicio del contrato.
    const actualDue = dueDate < start ? new Date(start) : dueDate;
    if (actualDue <= end)
      payments.push({
        contract: contract._id,
        local: contract.local,
        amount: contract.baseRent,
        paidAmount: 0,
        period: year + "-" + String(month + 1).padStart(2, "0"),
        dueDate: actualDue,
        status: "pending",
      });
    month++;
    if (month === 12) {
      month = 0;
      year++;
    }
  }
  return payments;
}
