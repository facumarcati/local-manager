import { Router } from "express";
import Tax from "../models/tax.model.js";
import Local from "../models/local.model.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const today = new Date();

    await Tax.updateMany(
      { status: "pending", dueDate: { $lt: today } },
      { status: "late" },
    );

    const taxes = await Tax.find()
      .populate("locals")
      .sort({ dueDate: 1 })
      .lean();

    res.render("taxes", { taxes });
  } catch (error) {
    console.log(error);
    res.send("Error cargando impuestos");
  }
});

router.get("/new", async (req, res) => {
  try {
    const locals = await Local.find().lean();

    res.render("newTax", { locals });
  } catch (error) {
    console.log(error);
    res.send("Error cargando formulario");
  }
});

router.post("/", async (req, res) => {
  try {
    const { locals, isPersonal, type, amount, period, dueDate, notes } =
      req.body;

    await Tax.create({
      locals: isPersonal
        ? []
        : Array.isArray(locals)
          ? locals
          : locals
            ? [locals]
            : [],
      type,
      amount,
      period,
      dueDate,
      notes,
    });

    res.redirect("/taxes");
  } catch (error) {
    console.log(error);
    res.send("Error creando impuesto");
  }
});

router.post("/pay/:id", async (req, res) => {
  try {
    await Tax.findByIdAndUpdate(req.params.id, {
      status: "paid",
      paidDate: new Date(),
    });

    res.redirect("/taxes");
  } catch (error) {
    console.log(error);
    res.send("Error registrando pago");
  }
});

router.post("/unpay/:id", async (req, res) => {
  try {
    await Tax.findByIdAndUpdate(req.params.id, {
      status: "pending",
      paidDate: null,
    });

    res.redirect("/taxes");
  } catch (error) {
    console.log(error);
    res.send("Error deshaciendo pago");
  }
});

router.post("/delete/:id", async (req, res) => {
  try {
    await Tax.findByIdAndDelete(req.params.id);

    res.redirect("/taxes");
  } catch (error) {
    console.log(error);
    res.send("Error eliminando impuesto");
  }
});

export default router;
