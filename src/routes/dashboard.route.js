import { Router } from "express";
import Local from "../models/local.model.js";
import Contract from "../models/contract.model.js";
import Payment from "../models/payment.model.js";
import Tax from "../models/tax.model.js";
import PaymentTransaction from "../models/paymentTransaction.model.js";
import { todayUTC, decorate } from "../utils/finance.js";
const router = Router();
router.get("/", async (req, res) => {
  const today = todayUTC();
  const year =
    req.query.year === undefined
      ? today.getUTCFullYear()
      : Number(req.query.year);
  const month =
    req.query.month === undefined
      ? today.getUTCMonth()
      : Number(req.query.month);
  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 2200 ||
    !Number.isInteger(month) ||
    month < 0 ||
    month > 11
  )
    throw new Error("Elegí un mes válido.");
  const start = new Date(Date.UTC(year, month, 1)),
    end = new Date(Date.UTC(year, month + 1, 1));
  const [locals, contracts, payments, taxes, transactions, allExpenses] =
    await Promise.all([
      Local.find().sort({ name: 1 }).lean(),
      Contract.find({ status: "active" }).lean(),
      Payment.find({ status: { $ne: "paid" } })
        .populate("local contract")
        .sort({ dueDate: 1 })
        .lean(),
      Tax.find({ status: { $ne: "paid" } })
        .populate("local locals")
        .sort({ dueDate: 1 })
        .lean(),
      PaymentTransaction.find({
        date: { $gte: start, $lt: end },
        reversedAt: null,
      }).lean(),
      Tax.find().lean(),
    ]);
  const pending = payments.map(decorate).filter((p) => p.remaining > 0);
  const late = pending.filter((p) => p.overdue);
  const dueThisMonth = pending.filter(
    (p) => p.dueDate >= start && p.dueDate < end,
  );
  const expenses = taxes.map(decorate).filter((t) => t.remaining > 0);
  const paidExpenses = allExpenses.reduce(
    (sum, t) =>
      sum +
      (t.movements?.length
        ? t.movements
            .filter((m) => !m.reversedAt && m.date >= start && m.date < end)
            .reduce((s, m) => s + m.amount, 0)
        : t.status === "paid" && t.paidDate >= start && t.paidDate < end
          ? t.amount
          : 0),
    0,
  );
  const collected = transactions.reduce((s, t) => s + t.amount, 0);
  const prev = new Date(Date.UTC(year, month - 1, 1)),
    next = new Date(Date.UTC(year, month + 1, 1));
  res.vary("X-Requested-With");
  res.render("dashboard", {
    layout: req.get("X-Requested-With") === "month-navigation" ? false : "main",
    year,
    month,
    prevYear: prev.getUTCFullYear(),
    prevMonth: prev.getUTCMonth(),
    nextYear: next.getUTCFullYear(),
    nextMonth: next.getUTCMonth(),
    collected,
    paidExpenses,
    net: collected - paidExpenses,
    debt: late.reduce((s, p) => s + p.remaining, 0),
    lateCount: late.length,
    pendingCount: dueThisMonth.length,
    expenseCount: expenses.length,
    latePayments: late.slice(0, 5),
    upcomingExpenses: expenses.slice(0, 5),
    hasLocals: locals.length > 0,
    locals: locals.map((l) => {
      const c = contracts.find((c) => String(c.local) === String(l._id));
      const debts = pending.filter(
        (p) => String(p.local?._id) === String(l._id) && p.overdue,
      );
      return {
        ...l,
        tenantName: c?.tenantName,
        debt: debts.reduce((s, p) => s + p.remaining, 0),
      };
    }),
  });
});
export default router;
