const { MongoClient } = require("mongodb");
require("dotenv").config();

async function run() {
  const uri = process.env.MONGODB_URI;
  console.log("URI:", uri);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("StayNest");
    const collections = await db.listCollections().toArray();
    console.log("Collections in DB:", collections.map(c => c.name));

    for (const col of collections) {
      const doc = await db.collection(col.name).findOne();
      console.log(`\nSample document in "${col.name}":`, doc);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
