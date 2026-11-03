import test from "node:test";
import assert from "node:assert/strict";
import { generatePayments } from "../src/utils/generatePayments.js";
import {
  money,
  dateOnly,
  balance,
  state,
  validContract,
} from "../src/utils/finance.js";
const base = {
  _id: "c",
  local: "l",
  baseRent: 100,
  paymentDay: 31,
  startDate: "2024-01-31",
  endDate: "2024-05-31",
};
test("Incluye todos los meses aunque comience un día 31 y limita febrero bisiesto", () => {
  const p = generatePayments(base);
  assert.deepEqual(
    p.map((p) => p.period),
    ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05"],
  );
  assert.equal(p[1].dueDate.toISOString().slice(0, 10), "2024-02-29");
});
test("Incluye el primer mes, con vencimiento al inicio si ya pasó", () => {
  const p = generatePayments({
    ...base,
    paymentDay: 10,
    startDate: "2026-01-31",
    endDate: "2026-03-31",
  });
  assert.equal(p.length, 3);
  assert.equal(p[0].dueDate.toISOString().slice(0, 10), "2026-01-31");
});
test("No crea una cuota después del fin del contrato", () =>
  assert.equal(
    generatePayments({
      ...base,
      startDate: "2026-01-01",
      endDate: "2026-03-05",
      paymentDay: 10,
    }).length,
    2,
  ));
test("Rechaza fechas inexistentes e importes inválidos", () => {
  for (const d of ["2026-02-30", "bad", ""]) assert.throws(() => dateOnly(d));
  for (const n of [-1, 0, Infinity, "abc", 1.001])
    assert.throws(() => money(n));
  assert.equal(money("10.25"), 10.25);
  assert.equal(money("1.10"), 1.1);
});
test("Saldos y estados conservan centavos", () => {
  assert.equal(balance({ amount: 0.3, paidAmount: 0.1 }), 0.2);
  assert.equal(state({ amount: 100, paidAmount: 10 }), "partial");
  assert.equal(state({ amount: 100, paidAmount: 100 }), "paid");
});
test("Valida rangos y día de vencimiento del contrato", () => {
  assert.throws(() =>
    validContract({
      tenantName: "A",
      baseRent: 100,
      paymentDay: 32,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    }),
  );
  assert.throws(() =>
    validContract({
      tenantName: "A",
      baseRent: 100,
      paymentDay: 10,
      startDate: "2026-12-31",
      endDate: "2026-01-01",
    }),
  );
});
