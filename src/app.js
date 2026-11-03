import { randomUUID } from "node:crypto";
import express from "express";
import { engine } from "express-handlebars";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";
import connectMongoDB from "./config/db.js";
import localsRouter from "./routes/locals.route.js";
import contractsRouter from "./routes/contracts.route.js";
import paymentsRouter from "./routes/payments.route.js";
import taxesRouter from "./routes/taxes.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import { todayString, todayUTC } from "./utils/finance.js";
dotenv.config({ quiet: true });
export const app = express();
app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("src/public"));
const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
app.engine(
  "handlebars",
  engine({
    helpers: {
      concat: (...args) => args.slice(0, -1).join(""),
      eq: (a, b) => a?.toString() === b?.toString(),
      gt: (a, b) => a > b,
      lt: (a, b) => a < b,
      isLate: (d) => d && new Date(d) < todayUTC(),
      subtract: (a, b) => (Number(a) || 0) - (Number(b) || 0),
      formatDate: (d) =>
        d
          ? new Intl.DateTimeFormat("es-AR", { timeZone: "UTC" }).format(
              new Date(d),
            )
          : "—",
      formatDateInput: (d) => (d ? new Date(d).toISOString().slice(0, 10) : ""),
      formatMoney: (v) =>
        new Intl.NumberFormat("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(v) || 0),
      monthName: (m) => months[m],
      periodName: (p) =>
        /^\d{4}-\d{2}$/.test(p || "")
          ? months[Number(p.slice(5)) - 1] + " " + p.slice(0, 4)
          : p,
    },
  }),
);
app.set("view engine", "handlebars");
app.set("views", "./src/views");
app.use((req, res, next) => {
  res.locals.operationId = randomUUID();
  res.locals.today = todayString();
  res.locals.saved = req.query.saved === "1";
  res.locals.isDashboard = req.path === "/";
  res.locals.isLocals = req.path.startsWith("/locals");
  res.locals.isContracts = req.path.startsWith("/contracts");
  res.locals.isPayments = req.path.startsWith("/payments");
  res.locals.isTaxes = req.path.startsWith("/taxes");
  next();
});
app.use("/locals", localsRouter);
app.use("/contracts", contractsRouter);
app.use("/payments", paymentsRouter);
app.use("/taxes", taxesRouter);
app.use("/", dashboardRouter);
app.use((req, res) =>
  res.status(404).render("error", {
    message:
      "No encontramos esta página. Podés volver al inicio y continuar desde allí.",
  }),
);
app.use((error, req, res, next) => {
  const validation =
    error.name === "ValidationError" || error.name === "CastError";
  const message = validation
    ? "Revisá los datos del formulario. Hay un valor inválido o falta un campo obligatorio."
    : error.name === "Error" && !error.code
      ? error.message
      : "No pudimos guardar la operación. Tus datos anteriores se conservan; volvé a intentarlo.";
  console.error("Operación no completada:", error.name);
  res.status(400).render("error", { message });
});
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await connectMongoDB();
    app.listen(process.env.PORT || 8081, () =>
      console.log(
        "Alquileres disponible en http://localhost:" +
          (process.env.PORT || 8081),
      ),
    );
  } catch {
    console.error(
      "No se pudo conectar a la base de datos. Revisá la configuración y la conexión.",
    );
    process.exitCode = 1;
  }
}
