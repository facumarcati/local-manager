import { Router } from "express";
import Payment from "../models/payment.model.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const today = new Date();

    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    await Payment.updateMany(
      { status: "pending", dueDate: { $lt: today } },
      { status: "late" },
    );

    const payments = await Payment.find({
      status: { $in: ["late", "pending"] },
      dueDate: { $lte: in30Days },
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

    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    const payments = await Payment.find({
      dueDate: { $gt: in30Days },
      status: "pending",
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
    const payments = await Payment.find({
      status: "paid",
    })
      .populate("contract")
      .populate("local")
      .sort({ paidDate: -1 })
      .lean();

    res.render("payments", {
      payments,
      view: "history",
    });
  } catch (error) {
    console.log(error);
    res.send("Error cargando historial");
  }
});

router.post("/pay/:id", async (req, res) => {
  try {
    await Payment.findByIdAndUpdate(req.params.id, {
      status: "paid",
      paidDate: new Date(),
    });

    const view = req.query.view || "active";

    res.redirect(`/payments/${view === "active" ? "" : view}`);
  } catch (error) {
    console.log(error);
    res.send("Error registrando pago");
  }
});

router.post("/unpay/:id", async (req, res) => {
  try {
    await Payment.findByIdAndUpdate(req.params.id, {
      status: "pending",
      paidDate: null,
    });

    const view = req.query.view || "active";

    res.redirect(`/payments/${view === "active" ? "" : view}`);
  } catch (error) {
    console.log(error);
    res.send("Error deshaciendo pago");
  }
});

export default router;
