// migrate.js
import { MongoClient } from "mongodb";

const oldUri =
  "mongodb+srv://mamutaliyev95:poppolizol@cluster0.wln0nrt.mongodb.net";
const newUri = "mongodb+srv://crud:polizoltest@cluster0.rkniwuz.mongodb.net";

const dbName = "test"; // Eski va yangi bazaning nomi (ikkalasida ham test)

async function migrate() {
  const oldClient = new MongoClient(oldUri);
  const newClient = new MongoClient(newUri);

  try {
    await oldClient.connect();
    await newClient.connect();

    const oldDb = oldClient.db(dbName);
    const newDb = newClient.db(dbName);

    const collections = await oldDb.listCollections().toArray();

    for (const { name } of collections) {
      console.log(`⏳ ${name} collection ko‘chirilmoqda...`);

      const docs = await oldDb.collection(name).find().toArray();

      if (docs.length > 0) {
        await newDb.collection(name).deleteMany({}); // Avval tozalash (agar kerak bo‘lsa)
        await newDb.collection(name).insertMany(docs);
        console.log(`✅ ${name} (${docs.length} ta hujjat) ko‘chirildi`);
      } else {
        console.log(`⚠️ ${name} bo‘sh, o‘tkazib yuborildi`);
      }
    }

    console.log("🎉 Migration tugadi!");
  } catch (err) {
    console.error("❌ Xato:", err);
  } finally {
    await oldClient.close();
    await newClient.close();
  }
}

migrate();
