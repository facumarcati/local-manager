export function generatePayments(contract) {
  const payments = [];

  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);

  let current = new Date(start);

  current.setMonth(current.getMonth() + 1);

  while (current <= end) {
    const dueDate = getAdjustedDate(start, current);

    payments.push({
      contract: contract._id,
      local: contract.local,
      amount: contract.rentAmount,
      periodMonth: dueDate.getMonth() + 1,
      periodYear: dueDate.getFullYear(),
      dueDate,
      status: "pending",
    });

    current.setMonth(current.getMonth() + 1);
  }

  return payments;
}

function getAdjustedDate(baseDate, targetDate) {
  const day = baseDate.getDate();

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();

  const date = new Date(year, month, day);

  if (date.getDate() !== day) {
    return new Date(year, month + 1, 0);
  }

  return date;
}
