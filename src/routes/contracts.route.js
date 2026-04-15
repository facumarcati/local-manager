import { Router } from "express";
import { generatePayments } from "../utils/generatePayments.js";
import Contract from "../models/contract.model.js";
import Local from "../models/local.model.js";
import Payment from "../models/payment.model.js";

const router = Router();

router.get("/", async (req, res) => {
  const contracts = await Contract.find({ status: "active" })
    .populate("local")
    .lean();

  res.render("contracts", {
    contracts,
    view: "active",
  });
});

router.get("/history", async (req, res) => {
  const contracts = await Contract.find({ status: "finished" })
    .populate("local")
    .lean();

  res.render("contracts", {
    contracts,
    view: "history",
  });
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
  try {
    const { local, tenantName, rentAmount, startDate, endDate } = req.body;

    const oldContract = await Contract.findById(req.params.id);

    const oldEnd = new Date(
      Date.UTC(
        new Date(oldContract.endDate).getUTCFullYear(),
        new Date(oldContract.endDate).getUTCMonth(),
        1,
      ),
    );

    const newEnd = new Date(
      Date.UTC(
        new Date(endDate).getUTCFullYear(),
        new Date(endDate).getUTCMonth(),
        1,
      ),
    );

    await Contract.findByIdAndUpdate(req.params.id, {
      local,
      tenantName,
      rentAmount,
      startDate,
      endDate,
    });

    await Payment.updateMany(
      { contract: req.params.id, status: { $in: ["pending", "late"] } },
      { amount: rentAmount },
    );

    if (newEnd > oldEnd) {
      const startNewPeriod = new Date(oldEnd);
      startNewPeriod.setUTCMonth(startNewPeriod.getUTCMonth() + 1);

      const partialContract = {
        _id: oldContract._id,
        local: oldContract.local,
        rentAmount,
        startDate: startNewPeriod,
        endDate: newEnd,
      };

      const newPayments = generatePayments(partialContract);

      if (newPayments.length > 0) {
        await Payment.insertMany(newPayments);
      }
    } else if (newEnd < oldEnd) {
      await Payment.deleteMany({
        contract: req.params.id,
        status: { $in: ["pending", "late"] },
        dueDate: { $gt: newEnd },
      });
    }

    res.redirect("/contracts");
  } catch (error) {
    console.log(error);
    res.send("Error editando contrato");
  }
});

router.post("/finish/:id", async (req, res) => {
  await Contract.findByIdAndUpdate(req.params.id, {
    status: "finished",
  });

  res.redirect("/contracts");
});

export default router;
