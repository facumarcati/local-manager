import mongoose from "mongoose";

const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.URI_MONGODB);

    console.log("MongoDB conectado");
  } catch (error) {
    console.log("Error conectando MongoDB", error);
  }
};

export default connectMongoDB;
