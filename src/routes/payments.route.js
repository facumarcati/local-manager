import { Router } from "express";
import Payment from "../models/payment.model.js";
import PaymentTransaction from "../models/paymentTransaction.model.js";
import { atomic } from "../utils/atomic.js";
import {
  money,
  dateOnly,
  todayString,
  balance,
  state,
  decorate,
  text,
} from "../utils/finance.js";
const router = Router();
router.get(["/", "/upcoming", "/history"], async (req, res) => {
  const view =
    req.path === "/history"
      ? "history"
      : req.path === "/upcoming"
        ? "upcoming"
        : "active";
  if (view === "history") {
    const transactions = await PaymentTransaction.find()
      .populate({
        path: "payment",
        populate: [{ path: "contract" }, { path: "local" }],
      })
      .sort({ date: -1 })
      .lean();
    return res.render("payments", { transactions, view, isHistory: true });
  }
  const now = dateOnly(todayString()),
    nextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
  const rows = await Payment.find({
    status: { $ne: "paid" },
    dueDate: view === "upcoming" ? { $gte: nextMonth } : { $lt: nextMonth },
  })
    .populate("contract local")
    .sort({ dueDate: 1 })
    .lean();
  res.render("payments", {
    payments: rows.map(decorate).filter((p) => p.remaining > 0),
    view,
  });
});
router.get("/detail/:id", async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate("contract local")
    .lean();
  if (!payment) throw new Error("No se encontró el cobro.");
  const transactions = await PaymentTransaction.find({ payment: payment._id })
    .sort({ date: -1 })
    .lean();
  res.render("paymentDetail", { payment: decorate(payment), transactions });
});
router.post("/pay/:id", async (req, res) => {
  const operationId = text(
      req.body.operationId,
      "la referencia de la operación",
    ),
    amount = money(req.body.amount),
    date = dateOnly(req.body.date),
    method = text(req.body.method, "el medio de cobro");
  if (date > dateOnly(todayString()))
    throw new Error("Un cobro recibido no puede tener fecha futura.");
  await atomic(async (session) => {
    const payment = await Payment.findById(req.params.id).session(session);
    if (!payment) throw new Error("No se encontró el cobro.");
    if (amount > balance(payment))
      throw new Error(
        "El importe supera el saldo pendiente. Revisá el monto antes de guardar.",
      );
    payment.paidAmount =
      Math.round(((payment.paidAmount || 0) + amount) * 100) / 100;
    payment.status = state(payment);
    payment.paidDate = payment.status === "paid" ? date : null;
    await payment.save({ session });
    await PaymentTransaction.create(
      [
        {
          payment: payment._id,
          operationId,
          amount,
          date,
          method,
          notes: req.body.notes || "",
        },
      ],
      { session },
    );
  });
  res.redirect("/payments/detail/" + req.params.id + "?saved=1");
});
router.post("/reverse/:id", async (req, res) => {
  const reason = text(req.body.reason, "el motivo de la anulación");
  let paymentId;
  await atomic(async (session) => {
    const movement = await PaymentTransaction.findById(req.params.id).session(
      session,
    );
    if (!movement || movement.reversedAt)
      throw new Error("El cobro ya fue anulado o no existe.");
    const payment = await Payment.findById(movement.payment).session(session);
    if (!payment)
      throw new Error(
        "No se encontró la cuota original. Revisá el historial antes de continuar.",
      );
    paymentId = payment._id;
    payment.paidAmount = Math.max(
      0,
      Math.round((payment.paidAmount - movement.amount) * 100) / 100,
    );
    payment.status = state(payment);
    payment.paidDate = null;
    movement.reversedAt = new Date();
    movement.reversalReason = reason;
    await payment.save({ session });
    await movement.save({ session });
  });
  res.redirect("/payments/detail/" + paymentId + "?saved=1");
});
router.post("/edit/:id", async (req, res) => {
  const amount = money(req.body.amount),
    dueDate = dateOnly(req.body.dueDate),
    reason = text(req.body.reason, "el motivo del cambio");
  await atomic(async (session) => {
    const p = await Payment.findById(req.params.id).session(session);
    if (!p) throw new Error("No se encontró la cuota.");
    if (amount < p.paidAmount)
      throw new Error(
        "El total no puede ser menor a lo ya cobrado. Anulá primero el cobro incorrecto, si corresponde.",
      );
    p.adjustments.push({
      date: new Date(),
      reason,
      previousAmount: p.amount,
      amount,
      previousDueDate: p.dueDate,
      dueDate,
    });
    p.amount = amount;
    p.dueDate = dueDate;
    p.notes = req.body.notes || "";
    p.status = state(p);
    if (p.status !== "paid") p.paidDate = null;
    await p.save({ session });
  });
  res.redirect("/payments/detail/" + req.params.id + "?saved=1");
});
export default router;
