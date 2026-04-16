import mongoose from "mongoose";

const contractSchema = new mongoose.Schema({
  local: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Local",
    required: true,
  },
  tenantName: {
    type: String,
    required: true,
  },
  baseRent: {
    type: Number,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  paymentDay: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "finished", "cancelled"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Contract = mongoose.model("Contract", contractSchema);

export default Contract;
