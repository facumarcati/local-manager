import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
const { EJSON } = mongoose.mongo.BSON;
import dotenv from "dotenv";
dotenv.config({ quiet: true });
if (process.argv[2] !== "RESET_LOCAL_MANAGER")
  throw new Error("Se requiere el argumento explícito RESET_LOCAL_MANAGER.");
const names = [
  "locals",
  "contracts",
  "payments",
  "paymenttransactions",
  "taxes",
];
await mongoose.connect(process.env.URI_MONGODB, {
  serverSelectionTimeoutMS: 10000,
});
const session = await mongoose.startSession();
let backup;
try {
  await session.withTransaction(async () => {
    const data = {};
    for (const name of names)
      data[name] = await mongoose.connection.db
        .collection(name)
        .find({}, { session })
        .toArray();
    const root = path.resolve(".backups");
    await fs.mkdir(root, { recursive: true });
    backup = path.join(root, "before-reset-" + Date.now() + ".ejson");
    await fs.writeFile(
      backup,
      EJSON.stringify(
        {
          createdAt: new Date(),
          database: mongoose.connection.name,
          collections: data,
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    const check = EJSON.parse(await fs.readFile(backup, "utf8"));
    for (const name of names) {
      if (check.collections[name].length !== data[name].length)
        throw new Error("La copia no pudo verificarse.");
    }
    for (const name of names)
      await mongoose.connection.db.collection(name).deleteMany({}, { session });
    console.log(
      "Copia verificada. Registros retirados:",
      Object.fromEntries(names.map((n) => [n, data[n].length])),
    );
  });
  for (const name of names)
    if ((await mongoose.connection.db.collection(name).countDocuments()) !== 0)
      throw new Error("La base no quedó vacía.");
  console.log("Base vacía verificada. Copia:", backup);
} finally {
  await session.endSession();
  await mongoose.disconnect();
}
