export function generatePayments(contract) {
  const payments = [];

  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);

  let current = new Date(start);

  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (true) {
    const year = current.getFullYear();
    const month = current.getMonth();

    const dueDate = getDueDate(year, month, contract.paymentDay);

    if (dueDate > end) break;

    if (dueDate >= start) {
      const period = `${year}-${String(month + 1).padStart(2, "0")}`;

      payments.push({
        contract: contract._id,
        local: contract.local,
        amount: contract.baseRent,
        paidAmount: 0,
        period,
        dueDate,
        status: "pending",
      });
    }

    current.setMonth(current.getMonth() + 1);
  }

  return payments;
}

function getDueDate(year, month, paymentDay) {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  const day = Math.min(paymentDay, lastDayOfMonth);

  return new Date(year, month, day);
}
