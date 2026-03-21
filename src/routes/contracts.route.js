import { Router } from "express";
import Contract from "../models/contract.model.js";
import Local from "../models/local.model.js";

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
  const { local, tenantName, rentAmount, startDate, endDate } = req.body;

  await Contract.create({
    local,
    tenantName,
    rentAmount,
    startDate,
    endDate,
  });

  res.redirect("/contracts");
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

  res.redirect("/contracts");
});

router.post("/finish/:id", async (req, res) => {
  await Contract.findByIdAndUpdate(req.params.id, {
    status: "finished",
  });

  res.redirect("/contracts");
});

export default router;
