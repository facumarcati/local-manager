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
  periodMonth: {
    type: Number,
    required: true,
  },
  periodYear: {
    type: Number,
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
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
