"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
exports.connectDB = connectDB;
exports.getDB = getDB;
const mongodb_1 = require("mongodb");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const uri = process.env.MONGODB_URI;
const client = new mongodb_1.MongoClient(uri);
exports.client = client;
let db = null;
async function connectDB() {
    if (db)
        return db;
    await client.connect();
    db = client.db("StayNest");
    console.log("Connected to MongoDB");
    return db;
}
function getDB() {
    if (!db)
        throw new Error("Database not connected. Call connectDB() first.");
    return db;
}
