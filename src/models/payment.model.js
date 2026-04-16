import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contract",
    required: true,
  },
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Local",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  paidAmount: {
    type: Number,
    default: 0,
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
    enum: ["pending", "partial", "paid"],
    default: "pending",
  },
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
