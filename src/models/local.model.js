import mongoose from "mongoose";

const localSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: "available",
  },
});

const Local = mongoose.model("Local", localSchema);

export default Local;
