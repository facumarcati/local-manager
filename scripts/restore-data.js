import fs from "node:fs/promises";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
const { EJSON } = mongoose.mongo.BSON;
const names = [
  "locals",
  "contracts",
  "payments",
  "paymenttransactions",
  "taxes",
];
if (process.argv[3] !== "RESTORE_LOCAL_MANAGER" || !process.argv[2])
  throw new Error(
    "Indicá el archivo y el argumento explícito RESTORE_LOCAL_MANAGER.",
  );
const copy = EJSON.parse(await fs.readFile(process.argv[2], "utf8"));
if (!copy.collections || names.some((n) => !Array.isArray(copy.collections[n])))
  throw new Error("Copia inválida.");
await mongoose.connect(process.env.URI_MONGODB, {
  serverSelectionTimeoutMS: 10000,
});
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    if (copy.database !== mongoose.connection.name)
      throw new Error("La copia pertenece a otra base de datos.");
    for (const name of names)
      if (
        await mongoose.connection.db
          .collection(name)
          .countDocuments({}, { session })
      )
        throw new Error("La base debe estar vacía para recuperar la copia.");
    for (const name of names)
      if (copy.collections[name].length)
        await mongoose.connection.db
          .collection(name)
          .insertMany(copy.collections[name], { session });
  });
  console.log("Copia recuperada.");
} finally {
  await session.endSession();
  await mongoose.disconnect();
}
