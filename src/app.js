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
      lt: (a, b) => a < b,
      isLate: (dueDate) => {
        if (!dueDate) return false;

        const today = new Date();
        const due = new Date(dueDate);

        return due < today;
      },
      subtract: (a, b) => {
        return (Number(a) || 0) - (Number(b) || 0);
      },
      formatDate: (date) => {
        if (!date) return "";

        const d = new Date(date);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());

        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();

        return `${day}-${month}-${year}`;
      },
      formatDateInput: (date) => {
        if (!date) return "";

        const d = new Date(date);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());

        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();

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
