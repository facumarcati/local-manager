import { Router } from "express";
import Local from "../models/local.model.js";
import Contract from "../models/contract.model.js";
import Payment from "../models/payment.model.js";
import Tax from "../models/tax.model.js";
import PaymentTransaction from "../models/paymentTransaction.model.js";

const router = Router();

async function getDashboardData(year, month) {
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));

  // Fase 1: actualizaciones de estado (deben correr antes de las lecturas)
  await Promise.all([
    Payment.updateMany(
      { status: { $in: ["pending", "partial"] }, dueDate: { $lt: today } },
      { status: "late" },
    ),
    Tax.updateMany(
      { status: "pending", dueDate: { $lt: today } },
      { status: "late" },
    ),
  ]);

  // Fase 2: todas las lecturas en paralelo
  const [
    totalLocals,
    activeContracts,
    expiringContracts,
    pendingPaymentsThisMonth,
    lateTaxes,
    taxesDueThisMonth,
    locals,
    allActiveContracts,
    latePaymentsListRaw,
    pendingPaymentsList,
    paidThisMonthList,
    upcomingPaymentsRaw,
    upcomingContracts,
    upcomingTaxes,
  ] = await Promise.all([
    Local.countDocuments(),
    Contract.countDocuments({ status: "active" }),
    Contract.countDocuments({
      status: "active",
      endDate: { $gte: today, $lte: in30Days },
    }),
    Payment.find({
      status: { $in: ["pending", "partial"] },
      dueDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    }).lean(),
    Tax.countDocuments({ status: "late" }),
    Tax.countDocuments({
      status: "pending",
      dueDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    }),
    Local.find().lean(),
    Contract.find({ status: "active" }).lean(), // para localsDetail sin N+1
    Payment.find({
      status: { $in: ["late", "partial"] },
      dueDate: { $lt: today },
    })
      .populate({ path: "contract", match: { status: "active" } })
      .populate("local")
      .sort({ dueDate: 1 })
      .lean(),
    Payment.find({
      status: { $in: ["pending", "partial"] },
      dueDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    })
      .populate("contract")
      .populate("local")
      .sort({ dueDate: 1 })
      .lean(),
    PaymentTransaction.find({
      date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    })
      .populate({
        path: "payment",
        populate: [{ path: "contract" }, { path: "local" }],
      })
      .sort({ date: -1 })
      .lean(),
    Payment.find({
      status: { $in: ["pending", "late", "partial"] },
      dueDate: { $gte: today, $lte: in30Days },
    })
      .populate({ path: "contract", match: { status: "active" } })
      .populate("local")
      .sort({ dueDate: 1 })
      .lean(),
    Contract.find({
      status: "active",
      endDate: { $gte: today, $lte: in30Days },
    })
      .populate("local")
      .sort({ endDate: 1 })
      .lean(),
    Tax.find({
      status: { $in: ["pending", "late"] },
      dueDate: { $gte: today, $lte: in30Days },
    })
      .populate("local")
      .sort({ dueDate: 1 })
      .lean(),
  ]);

  // localsDetail sin N+1: una sola query de pagos para todos los contratos
  const contractByLocal = Object.fromEntries(
    allActiveContracts.map((c) => [c.local.toString(), c]),
  );

  const activeContractIds = allActiveContracts.map((c) => c._id);
  const allPendingPayments = await Payment.find({
    contract: { $in: activeContractIds },
    status: { $in: ["pending", "partial", "late"] },
  })
    .sort({ dueDate: 1 })
    .lean();

  // Agrupar pagos por contrato en memoria
  const paymentsByContract = {};
  for (const p of allPendingPayments) {
    const key = p.contract.toString();
    if (!paymentsByContract[key]) paymentsByContract[key] = p; // solo el primero (más próximo)
  }

  const localsDetail = locals.map((local) => {
    const contract = contractByLocal[local._id.toString()];
    if (!contract) return { ...local, occupied: false };

    const latestPayment = paymentsByContract[contract._id.toString()] || null;

    return {
      ...local,
      occupied: true,
      tenantName: contract.tenantName,
      contractEnd: contract.endDate,
      latestPayment,
      latestDebt: latestPayment
        ? latestPayment.amount - latestPayment.paidAmount
        : 0,
      latestStatus: latestPayment?.status || "paid",
      latestDueDate: latestPayment?.dueDate,
    };
  });

  // Valores derivados (sin tocar la DB)
  const latePaymentsList = latePaymentsListRaw.filter(
    (p) => p.contract !== null,
  );
  const upcomingPayments = upcomingPaymentsRaw.filter(
    (p) => p.contract !== null,
  );
  const pendingThisMonth = pendingPaymentsThisMonth.filter(
    (p) => p.amount - p.paidAmount > 0,
  ).length;
  const collectedThisMonth = paidThisMonthList.reduce(
    (acc, t) => acc + t.amount,
    0,
  );
  const globalDebt = latePaymentsList.reduce(
    (acc, p) => acc + (p.amount - p.paidAmount),
    0,
  );

  const prevMonthDate = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthDate = new Date(Date.UTC(year, month + 1, 1));

  return {
    totalLocals,
    availableLocals: totalLocals - activeContracts,
    rentedLocals: activeContracts,
    totalActiveContracts: activeContracts,
    expiringContracts,
    latePayments: latePaymentsList.length,
    pendingThisMonth,
    collectedThisMonth,
    lateTaxes,
    taxesDueThisMonth,
    localsDetail,
    pendingPaymentsList,
    globalDebt,
    upcomingPayments,
    upcomingContracts,
    upcomingTaxes,
    latePaymentsList,
    paidThisMonthList,
    year,
    month,
    prevYear: prevMonthDate.getUTCFullYear(),
    prevMonth: prevMonthDate.getUTCMonth(),
    nextYear: nextMonthDate.getUTCFullYear(),
    nextMonth: nextMonthDate.getUTCMonth(),
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
  };
}

router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month =
      req.query.month !== undefined
        ? parseInt(req.query.month)
        : now.getMonth();
    const data = await getDashboardData(year, month);
    res.render("dashboard", data);
  } catch (error) {
    console.log(error);
    res.send("Error cargando dashboard");
  }
});

router.get("/fragment", async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month =
      req.query.month !== undefined
        ? parseInt(req.query.month)
        : now.getMonth();
    const data = await getDashboardData(year, month);
    res.render("dashboard", { ...data, layout: false });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error cargando dashboard");
  }
});

export default router;
