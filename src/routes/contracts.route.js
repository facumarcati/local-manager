import { Router } from "express";
import { generatePayments } from "../utils/generatePayments.js";
import Contract from "../models/contract.model.js";
import Local from "../models/local.model.js";
import Payment from "../models/payment.model.js";
import { atomic } from "../utils/atomic.js";
import {
  validContract,
  money,
  dateOnly,
  text,
  state,
} from "../utils/finance.js";
const router = Router();
router.get(["/", "/history"], async (req, res) => {
  const history = req.path === "/history";
  const contracts = await Contract.find({
    status: history ? { $in: ["finished", "cancelled"] } : "active",
  })
    .populate("local")
    .sort({ endDate: 1 })
    .lean();
  res.render("contracts", { contracts, view: history ? "history" : "active" });
});
router.get("/new", async (req, res) =>
  res.render("newContract", {
    locals: await Local.find({ status: { $ne: "inactive" } }).lean(),
  }),
);
router.post("/", async (req, res) => {
  const data = validContract(req.body),
    historical = req.body.historical === "on";
  await atomic(async (session) => {
    const local = await Local.findById(req.body.local).session(session);
    if (!local) throw new Error("Elegí un local existente.");
    const overlap = await Contract.exists({
      local: local._id,
      status: { $ne: "cancelled" },
      startDate: { $lte: data.endDate },
      endDate: { $gte: data.startDate },
    }).session(session);
    if (overlap)
      throw new Error("El local ya tiene un contrato en esas fechas.");
    if (
      !historical &&
      (await Contract.exists({ local: local._id, status: "active" }).session(
        session,
      ))
    )
      throw new Error(
        "Finalizá el contrato activo de este local antes de crear otro.",
      );
    const [contract] = await Contract.create(
      [
        {
          ...data,
          local: local._id,
          status: historical ? "finished" : "active",
        },
      ],
      { session },
    );
    const payments = generatePayments(contract);
    if (payments.length) await Payment.insertMany(payments, { session });
    if (!historical) {
      local.status = "rented";
      await local.save({ session });
    }
  });
  res.redirect("/contracts" + (historical ? "/history" : "") + "?saved=1");
});
router.get("/edit/:id", async (req, res) => {
  const contract = await Contract.findById(req.params.id)
    .populate("local")
    .lean();
  if (!contract) throw new Error("No se encontró el contrato.");
  res.render("editContract", { contract });
});
router.post("/edit/:id", async (req, res) => {
  const tenantName = text(req.body.tenantName, "el nombre del inquilino"),
    endDate = dateOnly(req.body.endDate);
  await atomic(async (session) => {
    const contract = await Contract.findById(req.params.id).session(session);
    if (!contract) throw new Error("No se encontró el contrato.");
    if (endDate < contract.startDate)
      throw new Error("La fecha de fin debe ser posterior al inicio.");
    if (endDate.getUTCFullYear() - contract.startDate.getUTCFullYear() > 50)
      throw new Error("El contrato no puede superar 50 años.");
    if (
      await Contract.exists({
        _id: { $ne: contract._id },
        local: contract.local,
        status: { $ne: "cancelled" },
        startDate: { $lte: endDate },
        endDate: { $gte: contract.startDate },
      }).session(session)
    )
      throw new Error("Las fechas se superponen con otro contrato del local.");
    if (
      endDate < contract.endDate &&
      (await Payment.exists({
        contract: contract._id,
        dueDate: { $gt: endDate },
        paidAmount: { $gt: 0 },
      }).session(session))
    )
      throw new Error(
        "Hay cobros posteriores a esa fecha. Revisalos antes de acortar el contrato.",
      );
    await Payment.deleteMany({
      contract: contract._id,
      dueDate: { $gt: endDate },
      paidAmount: 0,
    }).session(session);
    contract.tenantName = tenantName;
    contract.endDate = endDate;
    await contract.save({ session });
    const existing = await Payment.find({ contract: contract._id })
      .session(session)
      .lean();
    const periods = new Set(existing.map((p) => p.period));
    const missing = generatePayments(contract).filter(
      (p) => !periods.has(p.period),
    );
    if (missing.length) await Payment.insertMany(missing, { session });
  });
  res.redirect("/contracts?saved=1");
});
router.post("/finish/:id", async (req, res) => {
  await atomic(async (session) => {
    const c = await Contract.findById(req.params.id).session(session);
    if (!c || c.status !== "active")
      throw new Error("No se encontró un contrato activo.");
    c.status = "finished";
    await c.save({ session });
    await Local.findByIdAndUpdate(
      c.local,
      { status: "available" },
      { session },
    );
  });
  res.redirect("/contracts/history?saved=1");
});
router.get("/adjust/:id", async (req, res) => {
  const contract = await Contract.findById(req.params.id)
    .populate("local")
    .lean();
  if (!contract) throw new Error("No se encontró el contrato.");
  res.render("adjustContract", { contract });
});
router.post("/adjust-contract/:id", async (req, res) => {
  const amount = money(req.body.newAmount),
    fromDate = dateOnly(req.body.fromDate),
    reason = text(req.body.reason, "el motivo del ajuste");
  await atomic(async (session) => {
    const c = await Contract.findById(req.params.id).session(session);
    if (!c) throw new Error("No se encontró el contrato.");
    if (fromDate < c.startDate || fromDate > c.endDate)
      throw new Error("La fecha del ajuste debe estar dentro del contrato.");
    const rows = await Payment.find({
      contract: c._id,
      dueDate: { $gte: fromDate },
      status: { $ne: "paid" },
    }).session(session);
    if (!rows.length)
      throw new Error("No hay cuotas pendientes desde esa fecha.");
    if (rows.some((p) => p.paidAmount > amount))
      throw new Error(
        "El nuevo importe es menor a lo ya cobrado en alguna cuota.",
      );
    for (const p of rows) {
      p.adjustments.push({
        date: new Date(),
        reason,
        previousAmount: p.amount,
        amount,
        previousDueDate: p.dueDate,
        dueDate: p.dueDate,
      });
      p.amount = amount;
      p.status = state(p);
      await p.save({ session });
    }
    c.baseRent = amount;
    await c.save({ session });
  });
  res.redirect("/contracts?saved=1");
});
// Completa cuotas faltantes; nunca elimina cuotas existentes ni movimientos.
router.post("/regenerate/:id", async (req, res) => {
  await atomic(async (session) => {
    const c = await Contract.findById(req.params.id).session(session);
    if (!c) throw new Error("No se encontró el contrato.");
    const existing = await Payment.find({ contract: c._id })
      .session(session)
      .lean();
    const periods = new Set(existing.map((p) => p.period));
    const missing = generatePayments(c).filter((p) => !periods.has(p.period));
    if (missing.length) await Payment.insertMany(missing, { session });
  });
  res.redirect("/payments?saved=1");
});
export default router;
