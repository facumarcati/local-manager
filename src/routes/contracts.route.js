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
  const contracts = await Contract.find({
    status: { $in: ["finished", "cancelled"] },
  })
    .populate("local")
    .lean();

  res.render("contracts", {
    contracts,
    view: "history",
  });
});

router.get("/new", async (req, res) => {
  const locals = await Local.find({ status: { $ne: "inactive" } }).lean();

  res.render("newContract", { locals });
});

router.post("/", async (req, res) => {
  try {
    const { local, tenantName, baseRent, paymentDay, startDate, endDate } =
      req.body;

    if (
      !local ||
      !tenantName ||
      !baseRent ||
      !paymentDay ||
      !startDate ||
      !endDate
    ) {
      return res.send("Faltan datos");
    }

    const existing = await Contract.findOne({
      local,
      status: "active",
    });

    if (existing) {
      return res.send("El local ya tiene un contrato activo");
    }

    const contract = await Contract.create({
      local,
      tenantName,
      baseRent,
      paymentDay,
      startDate,
      endDate,
    });

    const payments = generatePayments(contract);
    await Payment.insertMany(payments);

    await Local.findByIdAndUpdate(local, {
      status: "rented",
    });

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
    const { tenantName, endDate } = req.body;

    await Contract.findByIdAndUpdate(req.params.id, {
      tenantName,
      endDate,
    });

    const contract = await Contract.findById(req.params.id);

    const lastPayment = await Payment.findOne({
      contract: contract._id,
    }).sort({ dueDate: -1 });

    if (lastPayment) {
      const lastDate = new Date(lastPayment.dueDate);
      const newEnd = new Date(endDate);

      if (newEnd > lastDate) {
        const partialContract = {
          _id: contract._id,
          local: contract.local,
          baseRent: contract.baseRent,
          paymentDay: contract.paymentDay,
          startDate: lastDate,
          endDate: newEnd,
        };

        const newPayments = generatePayments(partialContract);

        if (newPayments.length > 0) {
          await Payment.insertMany(newPayments);
        }
      }
    }

    res.redirect("/contracts");
  } catch (error) {
    console.log(error);
    res.send("Error editando contrato");
  }
});

router.post("/finish/:id", async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    await Contract.findByIdAndUpdate(req.params.id, {
      status: "finished",
    });

    await Local.findByIdAndUpdate(contract.local, {
      status: "available",
    });

    res.redirect("/contracts");
  } catch (error) {
    console.log(error);
    res.send("Error finalizando contrato");
  }
});

router.post("/adjust-contract/:id", async (req, res) => {
  try {
    const { newAmount, fromDate } = req.body;

    const contractId = req.params.id;

    await Contract.findByIdAndUpdate(contractId, {
      baseRent: newAmount,
    });

    await Payment.updateMany(
      {
        contract: contractId,
        dueDate: { $gte: new Date(fromDate) },
        status: { $ne: "paid" },
      },
      {
        amount: newAmount,
      },
    );

    res.redirect("/contracts");
  } catch (error) {
    console.log(error);
    res.send("Error ajustando contrato");
  }
});

router.get("/adjust/:id", async (req, res) => {
  const contract = await Contract.findById(req.params.id)
    .populate("local")
    .lean();

  if (!contract) {
    return res.send("Contrato no encontrado");
  }

  res.render("adjustContract", { contract });
});

router.post("/regenerate/:id", async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.send("Contrato no encontrado");
    }

    await Payment.deleteMany({ contract: contract._id });

    const payments = generatePayments(contract);
    await Payment.insertMany(payments);

    res.redirect("/payments");
  } catch (error) {
    console.log(error);
    res.send("Error regenerando pagos");
  }
});

export default router;
