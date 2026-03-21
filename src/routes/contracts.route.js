import { Router } from "express";
import Contract from "../models/contract.model.js";
import Local from "../models/local.model.js";
import Payment from "../models/payment.model.js";

const router = Router();

router.get("/", async (req, res) => {
  const contracts = await Contract.find().populate("local").lean();

  res.render("contracts", { contracts });
});

router.get("/new", async (req, res) => {
  const locals = await Local.find().lean();

  res.render("newContract", { locals });
});

router.post("/", async (req, res) => {
  try {
    const { local, tenantName, rentAmount, startDate, endDate } = req.body;

    const contract = await Contract.create({
      local,
      tenantName,
      rentAmount,
      startDate,
      endDate,
    });

    const payments = generatePayments(contract);
    await Payment.insertMany(payments);

    res.redirect("/contracts");
  } catch (error) {
    console.log(error);
    res.send("Error creando contrato");
  }
});

router.get("/edit/:id", async (req, res) => {
  const contract = await Contract.findById(req.params.id)
    .populate("local")
    .lean();

  const locals = await Local.find().lean();

  res.render("editContract", {
    contract,
    locals,
  });
});

router.post("/edit/:id", async (req, res) => {
  const { local, tenantName, rentAmount, startDate, endDate } = req.body;

  await Contract.findByIdAndUpdate(req.params.id, {
    local,
    tenantName,
    rentAmount,
    startDate,
    endDate,
  });

  await Payment.updateMany(
    {
      contract: req.params.id,
      status: { $in: ["pending", "late"] },
    },
    { amount: rentAmount },
  );

  res.redirect("/contracts");
});

router.post("/finish/:id", async (req, res) => {
  await Contract.findByIdAndUpdate(req.params.id, {
    status: "finished",
  });

  res.redirect("/contracts");
});

function generatePayments(contract) {
  const payments = [];

  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);

  let current = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
  );

  const endLimit = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1),
  );

  while (current <= endLimit) {
    payments.push({
      contract: contract._id,
      local: contract.local,
      amount: contract.rentAmount,
      periodMonth: current.getUTCMonth() + 1,
      periodYear: current.getUTCFullYear(),
      dueDate: new Date(current),
      status: "pending",
    });

    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return payments;
}

export default router;
