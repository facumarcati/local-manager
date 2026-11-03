import { Router } from "express";
import Local from "../models/local.model.js";
import Contract from "../models/contract.model.js";
import Payment from "../models/payment.model.js";
import Tax from "../models/tax.model.js";
import { text } from "../utils/finance.js";
const router = Router();
router.get("/", async (req, res) => {
  const [locals, contracts] = await Promise.all([
    Local.find().sort({ name: 1 }).lean(),
    Contract.find({ status: "active" }).lean(),
  ]);
  res.render("locals", {
    locals: locals.map((l) => ({
      ...l,
      tenantName: contracts.find((c) => String(c.local) === String(l._id))
        ?.tenantName,
    })),
  });
});
router.get("/new", (req, res) => res.render("newLocal"));
router.post("/", async (req, res) => {
  await Local.create({
    name: text(req.body.name, "el nombre"),
    address: text(req.body.address, "la dirección"),
  });
  res.redirect("/locals?saved=1");
});
router.get("/edit/:id", async (req, res) => {
  const local = await Local.findById(req.params.id).lean();
  if (!local) throw new Error("No se encontró el local.");
  res.render("editLocal", { local });
});
router.post("/edit/:id", async (req, res) => {
  const local = await Local.findByIdAndUpdate(
    req.params.id,
    {
      name: text(req.body.name, "el nombre"),
      address: text(req.body.address, "la dirección"),
    },
    { runValidators: true },
  );
  if (!local) throw new Error("No se encontró el local.");
  res.redirect("/locals?saved=1");
});
router.post("/delete/:id", async (req, res) => {
  const id = req.params.id;
  const linked = await Promise.all([
    Contract.exists({ local: id }),
    Payment.exists({ local: id }),
    Tax.exists({ $or: [{ local: id }, { locals: id }] }),
  ]);
  if (linked.some(Boolean))
    throw new Error(
      "Este local tiene historial. No se puede eliminar para conservar los contratos, cobros y gastos.",
    );
  await Local.findByIdAndDelete(id);
  res.redirect("/locals?saved=1");
});
export default router;
