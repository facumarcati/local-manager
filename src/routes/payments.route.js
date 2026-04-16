import { Router } from "express";
import Payment from "../models/payment.model.js";
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

    const payments = await Payment.find({
      status: { $ne: "paid" },
      dueDate: { $lte: lastDayOfMonth },
    })
      .populate({
        path: "contract",
        match: { status: "active" },
      })
      .populate("local")
      .sort({ dueDate: 1 })
      .lean();

    const filteredPayments = payments.filter((p) => p.contract !== null);

    res.render("payments", {
      payments: filteredPayments,
      view: "active",
    });
  } catch (error) {
    console.log(error);
    res.send("Error cargando pagos");
  }
});

router.get("/upcoming", async (req, res) => {
  try {
    const today = new Date();

    const lastDayOfMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );

    const payments = await Payment.find({
      status: { $ne: "paid" },
      dueDate: { $gt: lastDayOfMonth },
    })
      .populate({
        path: "contract",
        match: { status: "active" },
      })
      .populate("local")
      .sort({ dueDate: 1 })
      .lean();

    const filteredPayments = payments.filter((p) => p.contract !== null);

    res.render("payments", {
      payments: filteredPayments,
      view: "upcoming",
    });
  } catch (error) {
    console.log(error);
    res.send("Error cargando pagos futuros");
  }
});

router.get("/history", async (req, res) => {
  try {
    const transactions = await PaymentTransaction.find()
      .populate({
        path: "payment",
        populate: [{ path: "contract" }, { path: "local" }],
      })
      .sort({ date: -1 })
      .lean();

    res.render("payments", {
      payments: transactions,
      view: "history",
      isHistory: true,
    });
  } catch (error) {
    console.log(error);
    res.send("Error cargando historial");
  }
});

router.post("/pay/:id", async (req, res) => {
  try {
    const { amount } = req.body;

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.send("Pago no encontrado");
    }

    const payAmount = Number(amount);

    if (!payAmount || payAmount <= 0) {
      return res.send("Monto inválido");
    }

    payment.paidAmount += payAmount;

    if (payment.paidAmount >= payment.amount) {
      payment.status = "paid";
      payment.paidDate = new Date();
    } else {
      payment.status = "partial";
    }

    await payment.save();

    await PaymentTransaction.create({
      payment: payment._id,
      amount: payAmount,
      date: new Date(),
    });

    const view = req.query.view || "active";

    res.redirect(`/payments/${view === "active" ? "" : view}`);
  } catch (error) {
    console.log(error);
    res.send("Error registrando pago");
  }
});

export default router;
