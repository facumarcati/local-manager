import mongoose from "mongoose";

const taxSchema = new mongoose.Schema({
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Local",
    required: true,
  },
  type: {
    type: String,
    enum: ["ABL", "Ingresos Brutos", "Municipal", "Luz", "Gas", "Agua", "Otro"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  period: {
    type: String,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  paidDate: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "paid", "late"],
    default: "pending",
  },
  notes: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Tax = mongoose.model("Tax", taxSchema);

export default Tax;
