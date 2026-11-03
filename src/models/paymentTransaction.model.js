import mongoose from "mongoose";

const paymentTransactionSchema = new mongoose.Schema({
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment",
    required: true,
  },
  operationId: { type: String, unique: true, sparse: true },
  notes: { type: String, default: "" },
  reversedAt: { type: Date, default: null },
  reversalReason: { type: String, default: "" },
  amount: {
    type: Number,
    required: true,
  },
  method: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const PaymentTransaction = mongoose.model(
  "PaymentTransaction",
  paymentTransactionSchema,
);

export default PaymentTransaction;
