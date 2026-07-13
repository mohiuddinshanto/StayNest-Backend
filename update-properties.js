const { connectDB, getDB } = require("./db"); // আপনার db ফাইলের পাথ চেক করে নিবেন

async function updateExistingProperties() {
  try {
    await connectDB();
    const db = getDB();

    console.log("Updating properties...");

    // যেগুলোতে approvalStatus নেই, শুধু সেগুলোতে আপডেট করবে
    const result = await db.collection("properties").updateMany(
      { approvalStatus: { $exists: false } },
      { $set: { approvalStatus: "approved" } }
    );

    console.log(`Successfully updated ${result.modifiedCount} properties.`);
    process.exit();
  } catch (error) {
    console.error("Error updating properties:", error);
    process.exit(1);
  }
}

updateExistingProperties();