import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI as string;
const client = new MongoClient(uri);

let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;
  await client.connect();
  db = client.db("StayNest");
  console.log("Connected to MongoDB");
  return db;
}

export function getDB(): Db {
  if (!db) throw new Error("Database not connected. Call connectDB() first.");
  return db;
}

export { client };