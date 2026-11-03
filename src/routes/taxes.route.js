import { Router } from "express";
import Tax from "../models/tax.model.js";
import Local from "../models/local.model.js";
import { atomic } from "../utils/atomic.js";
import {
  money,
  dateOnly,
  todayString,
  decorate,
  balance,
  state,
  text,
} from "../utils/finance.js";
const router = Router();
// Compatibilidad con los gastos anteriores, que no guardaban un importe pagado.
function normalize(t) {
  if (t.status === "paid" && !t.paidAmount && !t.movements?.length)
    t.paidAmount = t.amount;
  return t;
}
router.get("/", async (req, res) => {
  const history = req.query.view === "history";
  const rows = await Tax.find()
    .populate("local locals")
    .sort({ dueDate: history ? -1 : 1 })
    .lean();
  const taxes = rows
    .map((t) => decorate(normalize(t)))
    .filter((t) => (history ? t.remaining === 0 : t.remaining > 0));
  res.render("taxes", { taxes, isHistory: history });
});
router.get("/new", async (req, res) =>
  res.render("newTax", { locals: await Local.find().sort({ name: 1 }).lean() }),
);
router.post("/", async (req, res) => {
  const amount = money(req.body.amount),
    dueDate = dateOnly(req.body.dueDate),
    period = text(req.body.period, "el período");
  const isPersonal =
    req.body.isPersonal === "1" || req.body.isPersonal === "on";
  const ids = isPersonal ? [] : [...new Set([req.body.locals || []].flat())];
  if (!isPersonal && !ids.length)
    throw new Error("Elegí al menos un local para este gasto.");
  if (
    ids.length &&
    (await Local.countDocuments({ _id: { $in: ids } })) !== ids.length
  )
    throw new Error("Alguno de los locales ya no existe.");
  await Tax.create({
    isPersonal,
    locals: ids,
    local: ids[0],
    type: req.body.type,
    amount,
    period,
    dueDate,
    notes: req.body.notes || "",
  });
  res.redirect("/taxes?saved=1");
});
router.get("/detail/:id", async (req, res) => {
  const tax = await Tax.findById(req.params.id).populate("local locals").lean();
  if (!tax) throw new Error("No se encontró el gasto.");
  res.render("taxDetail", { tax: decorate(normalize(tax)) });
});
router.post("/pay/:id", async (req, res) => {
  const operationId = text(
      req.body.operationId,
      "la referencia de la operación",
    ),
    amount = money(req.body.amount),
    date = dateOnly(req.body.date),
    method = text(req.body.method, "el medio de pago");
  if (date > dateOnly(todayString()))
    throw new Error("Un pago realizado no puede tener fecha futura.");
  await atomic(async (session) => {
    const t = await Tax.findById(req.params.id).session(session);
    if (!t) throw new Error("No se encontró el gasto.");
    normalize(t);
    if (t.movements.some((m) => m.operationId === operationId))
      throw new Error("Este pago ya fue registrado. Revisá el historial.");
    if (amount > balance(t))
      throw new Error("El importe supera el saldo pendiente del gasto.");
    t.movements.push({
      operationId,
      amount,
      date,
      method,
      notes: req.body.notes || "",
    });
    t.paidAmount = Math.round((t.paidAmount + amount) * 100) / 100;
    t.status = state(t);
    t.paidDate = t.status === "paid" ? date : null;
    await t.save({ session });
  });
  res.redirect("/taxes/detail/" + req.params.id + "?saved=1");
});
router.post("/reverse/:id/:movement", async (req, res) => {
  const reason = text(req.body.reason, "el motivo de la anulación");
  await atomic(async (session) => {
    const t = await Tax.findById(req.params.id).session(session);
    if (!t) throw new Error("No se encontró el gasto.");
    const movement = t.movements.id(req.params.movement);
    if (!movement || movement.reversedAt)
      throw new Error("El pago ya fue anulado o no existe.");
    movement.reversedAt = new Date();
    movement.reversalReason = reason;
    t.paidAmount = Math.max(
      0,
      Math.round((t.paidAmount - movement.amount) * 100) / 100,
    );
    t.status = state(t);
    t.paidDate = null;
    await t.save({ session });
  });
  res.redirect("/taxes/detail/" + req.params.id + "?saved=1");
});
router.post("/edit/:id", async (req, res) => {
  const amount = money(req.body.amount),
    dueDate = dateOnly(req.body.dueDate),
    reason = text(req.body.reason, "el motivo del cambio");
  await atomic(async (session) => {
    const t = await Tax.findById(req.params.id).session(session);
    if (!t) throw new Error("No se encontró el gasto.");
    normalize(t);
    if (amount < t.paidAmount)
      throw new Error("El total no puede ser menor a lo ya pagado.");
    t.adjustments.push({
      date: new Date(),
      reason,
      previousAmount: t.amount,
      amount,
      previousDueDate: t.dueDate,
      dueDate,
    });
    t.amount = amount;
    t.dueDate = dueDate;
    t.notes = req.body.notes || "";
    t.status = state(t);
    if (t.status !== "paid") t.paidDate = null;
    await t.save({ session });
  });
  res.redirect("/taxes/detail/" + req.params.id + "?saved=1");
});
router.post("/delete/:id", async (req, res) => {
  await atomic(async (session) => {
    const t = await Tax.findById(req.params.id).session(session);
    if (!t) throw new Error("No se encontró el gasto.");
    if (
      t.status === "paid" ||
      t.paidAmount > 0 ||
      t.movements.length ||
      t.adjustments.length
    )
      throw new Error(
        "Este gasto tiene movimientos. Conservalo para mantener el historial.",
      );
    await t.deleteOne({ session });
  });
  res.redirect("/taxes?saved=1");
});
export default router;
