import { Router } from "express";
import Payment from "../models/payment.model.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const today = new Date();

    await Payment.updateMany(
      { status: "pending", dueDate: { $lt: today } },
      { status: "late" },
    );

    const payments = await Payment.find()
      .populate("contract")
      .populate("local")
      .sort({ dueDate: 1 })
      .lean();

    res.render("payments", { payments });
  } catch (error) {
    console.log(error);
    res.send("Error cargando pagos");
  }
});

router.post("/pay/:id", async (req, res) => {
  try {
    await Payment.findByIdAndUpdate(req.params.id, {
      status: "paid",
      paidDate: new Date(),
    });

    res.redirect("/payments");
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

    res.redirect("/payments");
  } catch (error) {
    console.log(error);
    res.send("Error deshaciendo pago");
  }
});

export default router;
