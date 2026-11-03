import express from "express";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { app } from "../src/app.js";
import Local from "../src/models/local.model.js";
import Contract from "../src/models/contract.model.js";
import Payment from "../src/models/payment.model.js";
import Movement from "../src/models/paymentTransaction.model.js";
import Tax from "../src/models/tax.model.js";
const dbName = "local_manager_test_" + Date.now();
let server;
let checks = 0;
const browserMode = process.argv.includes("--browser");
let finishBrowser;
const browserFinished = new Promise((resolve) => {
  finishBrowser = resolve;
});
const timeout = setTimeout(() => {
  console.error("Pruebas interrumpidas por tiempo de conexión.");
  process.exit(1);
}, 90000);
try {
  await mongoose.connect(process.env.URI_MONGODB, {
    dbName,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 5000,
  });
  await Promise.all(
    [Local, Contract, Payment, Movement, Tax].map((m) => m.init()),
  );
  const testServer = express();
  if (browserMode)
    testServer.post("/__test/finish", (req, res) => {
      res.send("Pruebas de navegador finalizadas.");
      finishBrowser();
    });
  testServer.use(app);
  server = testServer.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  async function get(url) {
    const r = await fetch(origin + url);
    assert.equal(r.status, 200, url);
    const html = await r.text();
    assert.ok(!html.includes("{{"), url + " sin expresiones sin resolver");
    checks++;
    return html;
  }
  async function post(url, data = {}, status = 302) {
    const r = await fetch(origin + url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(
        Object.entries(data).flatMap(([k, v]) =>
          Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]],
        ),
      ),
      redirect: "manual",
    });
    if (r.status !== status)
      throw new Error(
        url +
          " esperaba " +
          status +
          " recibió " +
          r.status +
          " " +
          (await r.text()).replace(/<[^>]*>/g, " ").slice(-1500),
      );
    checks++;
    return r;
  }
  for (const url of [
    "/",
    "/locals",
    "/locals/new",
    "/contracts",
    "/contracts/new",
    "/contracts/history",
    "/payments",
    "/payments/upcoming",
    "/payments/history",
    "/taxes",
    "/taxes/new",
    "/taxes?view=history",
  ])
    await get(url);
  await post("/locals", {
    name: "Local prueba A",
    address: "Calle de prueba 1",
  });
  await post("/locals", {
    name: "Local prueba B",
    address: "Calle de prueba 2",
  });
  const [a, b] = await Local.find().sort({ name: 1 });
  await post("/contracts", {
    local: a.id,
    tenantName: "Inquilino anterior",
    baseRent: "100.25",
    paymentDay: "31",
    startDate: "2024-01-31",
    endDate: "2024-05-31",
    historical: "on",
  });
  const old = await Contract.findOne({ local: a._id });
  assert.equal(old.status, "finished");
  assert.equal(await Payment.countDocuments({ contract: old._id }), 5);
  assert.equal((await Local.findById(a._id)).status, "available");
  checks++;
  let quota = await Payment.findOne({ contract: old._id, period: "2024-01" });
  await get("/payments/detail/" + quota.id);
  assert.ok((await get("/payments")).includes("Inquilino anterior"));
  const op = randomUUID();
  await post("/payments/pay/" + quota.id, {
    amount: "40.25",
    date: "2024-01-31",
    method: "Efectivo",
    operationId: op,
    notes: "Histórico",
  });
  assert.equal((await Payment.findById(quota.id)).paidAmount, 40.25);
  checks++;
  await post(
    "/payments/pay/" + quota.id,
    {
      amount: "40.25",
      date: "2024-01-31",
      method: "Efectivo",
      operationId: op,
    },
    400,
  );
  assert.equal((await Payment.findById(quota.id)).paidAmount, 40.25);
  checks++;
  await post(
    "/payments/pay/" + quota.id,
    {
      amount: "61",
      date: "2024-01-31",
      method: "Efectivo",
      operationId: randomUUID(),
    },
    400,
  );
  await post(
    "/payments/edit/" + quota.id,
    { amount: "30", dueDate: "2024-01-31", reason: "Descuento" },
    400,
  );
  await post("/payments/edit/" + quota.id, {
    amount: "90.25",
    dueDate: "2024-02-01",
    reason: "Descuento acordado",
    notes: "Nota corregida",
  });
  await post("/payments/pay/" + quota.id, {
    amount: "50",
    date: "2024-02-29",
    method: "Transferencia",
    operationId: randomUUID(),
  });
  assert.equal((await Payment.findById(quota.id)).status, "paid");
  checks++;
  const movement = await Movement.findOne({ payment: quota._id, amount: 50 });
  await post("/payments/reverse/" + movement.id, {
    reason: "Registrado por error",
  });
  await post("/payments/reverse/" + movement.id, { reason: "Repetido" }, 400);
  assert.equal((await Payment.findById(quota.id)).paidAmount, 40.25);
  checks++;
  await get("/payments/detail/" + quota.id);
  await get("/payments/history");
  const month = await get("/?year=2024&month=0");
  assert.ok(month.includes("40,25"));
  checks++;
  await post("/contracts/regenerate/" + old.id);
  assert.equal(await Payment.countDocuments({ contract: old._id }), 5);
  assert.equal(await Movement.countDocuments({ payment: quota._id }), 2);
  checks++;
  await post("/contracts/edit/" + old.id, {
    tenantName: old.tenantName,
    endDate: "2024-07-31",
  });
  assert.equal(await Payment.countDocuments({ contract: old._id }), 7);
  checks++;
  await post("/contracts/edit/" + old.id, {
    tenantName: old.tenantName,
    endDate: "2024-07-31",
  });
  assert.equal(await Payment.countDocuments({ contract: old._id }), 7);
  checks++;
  await post("/contracts/adjust-contract/" + old.id, {
    newAmount: "120",
    fromDate: "2024-03-01",
    reason: "Aumento anterior",
  });
  assert.equal(
    (await Payment.findOne({ contract: old._id, period: "2024-03" })).amount,
    120,
  );
  checks++;
  await get("/contracts/edit/" + old.id);
  await get("/contracts/adjust/" + old.id);
  await post("/contracts", {
    local: b.id,
    tenantName: "Inquilino actual",
    baseRent: "200",
    paymentDay: "10",
    startDate: "2026-01-01",
    endDate: "2027-12-31",
  });
  const active = await Contract.findOne({ local: b._id });
  await post(
    "/contracts",
    {
      local: b.id,
      tenantName: "Superpuesto",
      baseRent: "100",
      paymentDay: "10",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    },
    400,
  );
  await post("/contracts/finish/" + active.id);
  assert.ok((await get("/payments")).includes("Inquilino actual"));
  checks++;
  await post("/taxes", {
    locals: [a.id, b.id],
    type: "Agua",
    amount: "300.50",
    period: "Bimestre anterior",
    dueDate: "2024-01-31",
    notes: "Factura compartida",
  });
  const tax = await Tax.findOne();
  assert.equal(tax.locals.length, 2);
  assert.equal(await Tax.countDocuments(), 1);
  checks++;
  await get("/taxes/detail/" + tax.id);
  await get("/taxes/new");
  await get("/taxes");
  const expenseOp = randomUUID();
  await post("/taxes/pay/" + tax.id, {
    amount: "100.50",
    date: "2024-01-31",
    method: "Transferencia",
    operationId: expenseOp,
  });
  await post(
    "/taxes/pay/" + tax.id,
    {
      amount: "100.50",
      date: "2024-01-31",
      method: "Transferencia",
      operationId: expenseOp,
    },
    400,
  );
  await post(
    "/taxes/pay/" + tax.id,
    {
      amount: "201",
      date: "2024-01-31",
      method: "Efectivo",
      operationId: randomUUID(),
    },
    400,
  );
  await post("/taxes/edit/" + tax.id, {
    amount: "320.50",
    dueDate: "2024-02-29",
    reason: "Corrección de factura",
  });
  await post("/taxes/pay/" + tax.id, {
    amount: "220",
    date: "2024-02-29",
    method: "Efectivo",
    operationId: randomUUID(),
  });
  assert.equal((await Tax.findById(tax.id)).status, "paid");
  await get("/taxes?view=history");
  checks++;
  let paid = await Tax.findById(tax.id);
  const m = paid.movements[1];
  await post("/taxes/reverse/" + tax.id + "/" + m.id, {
    reason: "Error de registro",
  });
  assert.equal((await Tax.findById(tax.id)).paidAmount, 100.5);
  checks++;
  await post("/taxes/delete/" + tax.id, {}, 400);
  await post("/locals/delete/" + a.id, {}, 400);
  await get("/taxes/detail/" + tax.id);
  await get("/locals");
  await get("/locals/edit/" + a.id);
  await get("/contracts");
  await get("/contracts/history");
  await get("/");
  // Operaciones simultáneas no pueden perder cobros ni superar el saldo.
  const q = await Payment.findOne({ contract: active._id });
  const results = await Promise.all(
    [60, 80].map((amount) =>
      fetch(origin + "/payments/pay/" + q.id, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          amount: String(amount),
          date: "2026-01-10",
          method: "Efectivo",
          operationId: randomUUID(),
        }),
        redirect: "manual",
      }),
    ),
  );
  assert.ok(results.every((r) => r.status === 302));
  assert.equal((await Payment.findById(q.id)).paidAmount, 140);
  checks++;
  const partial = await fetch(origin + "/?year=2024&month=1", {
    headers: { "X-Requested-With": "month-navigation" },
  });
  assert.equal(partial.status, 200);
  const fragment = await partial.text();
  assert.ok(fragment.includes('id="dashboard-content"'));
  assert.ok(!fragment.includes("<html"));
  assert.ok(fragment.includes("Febrero 2024"));
  checks++;
  console.log(
    "OK: " +
      checks +
      " verificaciones de pantallas, datos históricos, cobros, gastos compartidos, anulaciones, cuotas y concurrencia.",
  );
  if (browserMode) {
    clearTimeout(timeout);
    console.log("Vista de pruebas: " + origin);
    await browserFinished;
  }
} finally {
  if (server) await new Promise((r) => server.close(r));
  if (mongoose.connection.readyState === 1) {
    assert.ok(
      mongoose.connection.name === dbName &&
        /^local_manager_test_[0-9]+$/.test(dbName),
    );
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  clearTimeout(timeout);
}
