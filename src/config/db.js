import mongoose from "mongoose";
export default async function connectMongoDB() {
  if (!process.env.URI_MONGODB)
    throw new Error("Falta configurar la conexión a la base de datos.");
  await mongoose.connect(process.env.URI_MONGODB, {
    serverSelectionTimeoutMS: 10000,
  });
}
