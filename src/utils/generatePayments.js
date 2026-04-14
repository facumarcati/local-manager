export function generatePayments(contract) {
  const payments = [];

  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);

  let current = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
  );

  const endLimit = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1),
  );

  while (current <= endLimit) {
    payments.push({
      contract: contract._id,
      local: contract.local,
      amount: contract.rentAmount,
      periodMonth: current.getUTCMonth() + 1,
      periodYear: current.getUTCFullYear(),
      dueDate: new Date(current),
      status: "pending",
    });

    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return payments;
}
