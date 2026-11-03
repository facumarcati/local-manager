import mongoose from "mongoose";

const taxSchema = new mongoose.Schema({
  isPersonal: { type: Boolean, default: false },
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Local",
    required: false,
  },
  locals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Local" }],
  paidAmount: { type: Number, default: 0 },
  movements: [
    {
      operationId: String,
      amount: Number,
      date: Date,
      method: String,
      notes: String,
      reversedAt: Date,
      reversalReason: String,
    },
  ],
  adjustments: [
    {
      date: Date,
      reason: String,
      previousAmount: Number,
      amount: Number,
      previousDueDate: Date,
      dueDate: Date,
    },
  ],
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
    enum: ["pending", "partial", "paid", "late"],
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
