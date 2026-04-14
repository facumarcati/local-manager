import express from "express";
import { engine } from "express-handlebars";
import { Server } from "socket.io";
import { createServer } from "http";
import connectMongoDB from "./config/db.js";
import dotenv from "dotenv";

import localsRouter from "./routes/locals.route.js";
import contractsRouter from "./routes/contracts.route.js";
import paymentsRouter from "./routes/payments.route.js";
import taxesRouter from "./routes/taxes.route.js";
import dashboardRouter from "./routes/dashboard.route.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8081;

connectMongoDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("src/public"));

app.engine(
  "handlebars",
  engine({
    helpers: {
      eq: (a, b) => a?.toString() === b?.toString(),
      gt: (a, b) => a > b,
      formatDate: (date) => {
        if (!date) return "";
        const d = new Date(date);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      },
      monthName: (month) => {
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
        return months[month - 1];
      },
    },
  }),
);
app.set("view engine", "handlebars");
app.set("views", "./src/views");

app.use("/locals", localsRouter);
app.use("/contracts", contractsRouter);
app.use("/payments", paymentsRouter);
app.use("/taxes", taxesRouter);
app.use("/", dashboardRouter);

app.listen(PORT, () => {
  console.log("Servidor iniciado en http://localhost:" + PORT);
});
