import { Router } from "express";
import Local from "../models/local.model.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const locals = await Local.find().lean();

    res.render("locals", { locals });
  } catch (error) {
    console.log(error);

    res.send("error cargando locales");
  }
});

router.get("/new", (req, res) => {
  res.render("newLocal");
});

router.post("/", async (req, res) => {
  try {
    const { name, address } = req.body;

    await Local.create({
      name,
      address,
    });

    res.redirect("/locals");
  } catch (error) {
    console.log(error);

    res.send("error creando local");
  }
});

router.get("/edit/:id", async (req, res) => {
  const local = await Local.findById(req.params.id).lean();

  res.render("editLocal", { local });
});

router.post("/edit/:id", async (req, res) => {
  const { name, address, status } = req.body;

  await Local.findByIdAndUpdate(req.params.id, {
    name,
    address,
    status,
  });

  res.redirect("/locals");
});

router.post("/delete/:id", async (req, res) => {
  await Local.findByIdAndDelete(req.params.id);

  res.redirect("/locals");
});

export default router;
