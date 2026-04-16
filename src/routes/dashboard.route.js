import { Router } from "express";
import Local from "../models/local.model.js";
import Contract from "../models/contract.model.js";
import Payment from "../models/payment.model.js";
import Tax from "../models/tax.model.js";
import PaymentTransaction from "../models/paymentTransaction.model.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const today = new Date();

    const firstDayOfMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const lastDayOfMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );

    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    const totalLocals = await Local.countDocuments();
    const activeContracts = await Contract.countDocuments({ status: "active" });
    const availableLocals = totalLocals - activeContracts;

    const totalActiveContracts = activeContracts;
    const expiringContracts = await Contract.countDocuments({
      status: "active",
      endDate: { $gte: today, $lte: in30Days },
    });

    await Payment.updateMany(
      { status: { $in: ["pending", "partial"] }, dueDate: { $lt: today } },
      { status: "late" },
    );

    const pendingPaymentsThisMonth = await Payment.find({
      status: { $in: ["pending", "partial"] },
      dueDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    }).lean();

    const pendingThisMonth = pendingPaymentsThisMonth.filter(
      (p) => p.amount - p.paidAmount > 0,
    ).length;

    const paymentsPaidThisMonth = await PaymentTransaction.find({
      date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    }).lean();

    const collectedThisMonth = paymentsPaidThisMonth.reduce(
      (acc, t) => acc + t.amount,
      0,
    );

    await Tax.updateMany(
      { status: "pending", dueDate: { $lt: today } },
      { status: "late" },
    );

    const lateTaxes = await Tax.countDocuments({ status: "late" });

    const taxesDueThisMonth = await Tax.countDocuments({
      status: "pending",
      dueDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    });

    const locals = await Local.find().lean();

    const localsDetail = await Promise.all(
      locals.map(async (local) => {
        const contract = await Contract.findOne({
          local: local._id,
          status: "active",
        })
          .populate("local")
          .lean();

        if (!contract) {
          return {
            ...local,
            occupied: false,
          };
        }

        let latestPayment = await Payment.findOne({
          contract: contract._id,
          status: { $in: ["pending", "partial"] },
        })
          .sort({ dueDate: 1 })
          .lean();

        if (!latestPayment) {
          latestPayment = await Payment.findOne({
            contract: contract._id,
            status: "pending",
          })
            .sort({ dueDate: 1 })
            .lean();
        }

        const latestDebt = latestPayment
          ? latestPayment.amount - latestPayment.paidAmount
          : 0;
        const latestStatus =
          latestPayment?.status === "partial"
            ? "partial"
            : latestPayment?.status || "paid";
        const latestDueDate = latestPayment?.dueDate;

        return {
          ...local,
          occupied: true,
          tenantName: contract.tenantName,
          contractEnd: contract.endDate,
          latestPayment,
          latestDebt,
          latestStatus,
          latestDueDate,
        };
      }),
    );

    const upcomingPaymentsRaw = await Payment.find({
      status: { $in: ["pending", "late", "partial"] },
      dueDate: { $gte: today, $lte: in30Days },
    })
      .populate({
        path: "contract",
        match: { status: "active" },
      })
      .populate("local")
      .sort({ dueDate: 1 })
      .lean();

    const upcomingPayments = upcomingPaymentsRaw.filter(
      (p) => p.contract !== null,
    );

    const upcomingContracts = await Contract.find({
      status: "active",
      endDate: { $gte: today, $lte: in30Days },
    })
      .populate("local")
      .sort({ endDate: 1 })
      .lean();

    const upcomingTaxes = await Tax.find({
      status: { $in: ["pending", "late"] },
      dueDate: { $gte: today, $lte: in30Days },
    })
      .populate("local")
      .sort({ dueDate: 1 })
      .lean();

    const latePaymentsListRaw = await Payment.find({
      status: { $in: ["late", "partial"] },
      dueDate: { $lt: today },
    })
      .populate({ path: "contract", match: { status: "active" } })
      .populate("local")
      .sort({ dueDate: 1 })
      .lean();

    const latePaymentsList = latePaymentsListRaw.filter(
      (p) => p.contract !== null,
    );

    const latePayments = latePaymentsList.length;

    const globalDebt = latePaymentsList.reduce(
      (acc, p) => acc + (p.amount - p.paidAmount),
      0,
    );

    const paidThisMonthList = await PaymentTransaction.find({
      date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    })
      .populate({
        path: "payment",
        populate: [{ path: "contract" }, { path: "local" }],
      })
      .sort({ date: -1 })
      .lean();

    res.render("dashboard", {
      totalLocals,
      availableLocals,
      rentedLocals: activeContracts,
      totalActiveContracts,
      expiringContracts,
      latePayments,
      pendingThisMonth,
      collectedThisMonth,
      lateTaxes,
      taxesDueThisMonth,
      localsDetail,
      globalDebt,
      upcomingPayments,
      upcomingContracts,
      upcomingTaxes,
      latePaymentsList,
      paidThisMonthList,
    });
  } catch (error) {
    console.log(error);
    res.send("Error cargando dashboard");
  }
});

export default router;
