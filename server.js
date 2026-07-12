const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
require("dotenv").config();

const { connectDB, getDB } = require("./db");

const app = express();
const port = process.env.PORT || 5000;

// Configure CORS to support credentials (session cookies) from the Next.js frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Helper to extract session token from cookies or auth header
function getSessionToken(req) {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  // Check Cookies
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const parts = cookie.split("=");
    const key = parts[0].trim();
    const val = parts.slice(1).join("=");
    acc[key] = val;
    return acc;
  }, {});
  return cookies["better-auth.session_token"] || null;
}

// Authentication middleware using Better Auth session tables in MongoDB
async function authenticate(req, res, next) {
  try {
    const token = getSessionToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized: No session token provided" });
    }

    const db = getDB();

    // Verify session
    const session = await db.collection("session").findOne({ token });
    if (!session) {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid session" });
    }

    // Check expiration
    if (new Date() > new Date(session.expiresAt)) {
      return res.status(401).json({ success: false, message: "Unauthorized: Session expired" });
    }

    // Build conditions for matching session.userId
    const orConditions = [{ id: session.userId }];
    try {
      orConditions.push({ _id: new ObjectId(session.userId) });
    } catch (e) {
      orConditions.push({ _id: session.userId });
    }

    // Find user (checking both user and users collections as fallback)
    let user = await db.collection("user").findOne({ $or: orConditions });
    if (!user) {
      user = await db.collection("users").findOne({ $or: orConditions });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized: User not found" });
    }

    // Attach user to request
    req.user = {
      id: user.id || user._id.toString(),
      name: user.name,
      email: user.email,
      image: user.image,
    };
    next();
  } catch (error) {
    console.error("Backend auth middleware error:", error);
    res.status(500).json({ success: false, message: "Internal server error during authentication" });
  }
}


function formatProperty(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    title: doc.title,
    shortDescription: doc.shortDescription,
    fullDescription: doc.fullDescription,
    rent: doc.rent,
    type: doc.type,
    bedrooms: doc.bedrooms,
    bathrooms: doc.bathrooms,
    area: doc.area,
    city: doc.city,
    address: doc.address,
    images: doc.images,
    amenities: doc.amenities,
    rating: doc.rating,
    reviewCount: doc.reviewCount,
    ownerId: doc.ownerId?.toString(),
    ownerName: doc.ownerName,
    ownerImage: doc.ownerImage,
    ownerPhone: doc.ownerPhone,
    ownerEmail: doc.ownerEmail,
    available: doc.available,
    status: doc.status,
    featured: doc.featured,
    createdAt: doc.createdAt,
  };
}

function formatReview(doc) {
  return {
    id: doc._id.toString(),
    propertyId: doc.propertyId.toString(),
    userName: doc.userName,
    userImage: doc.userImage,
    rating: doc.rating,
    comment: doc.comment,
    date: doc.date,
  };
}

function buildSort(sort) {
  switch (sort) {
    case "price-asc":
      return { rent: 1 };
    case "price-desc":
      return { rent: -1 };
    case "rating":
      return { rating: -1 };
    default:
      return { createdAt: -1 };
  }
}

// GET /properties — search, filter, sort, pagination
app.get("/properties", async (req, res) => {
  try {
    const db = getDB();
    const {
      q,
      type,
      minPrice,
      maxPrice,
      beds,
      sort = "newest",
      page = "1",
      limit = "12",
      ownerId,
      featured,
      city,
    } = req.query;

    const filter = {};

    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [
        { title: regex },
        { city: regex },
        { address: regex },
        { shortDescription: regex },
      ];
    }

    if (type && type !== "all") filter.type = type;
    if (city) filter.city = new RegExp(city, "i");
    if (featured === "true") filter.featured = true;
    if (ownerId) {
      filter.ownerId = ownerId; // Owner ID can be a string from Better Auth
    }

    if (minPrice || maxPrice) {
      filter.rent = {};
      if (minPrice) filter.rent.$gte = Number(minPrice);
      if (maxPrice) filter.rent.$lte = Number(maxPrice);
    }

    if (beds && beds !== "any") {
      if (beds === "5+") {
        filter.bedrooms = { $gte: 5 };
      } else {
        filter.bedrooms = Number(beds);
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const collection = db.collection("properties");
    const total = await collection.countDocuments(filter);
    const properties = await collection
      .find(filter)
      .sort(buildSort(sort))
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      message: "Properties fetched successfully",
      data: properties.map(formatProperty),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("GET /properties error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch properties" });
  }
});

// GET /properties/:id
app.get("/properties/:id", async (req, res) => {
  try {
    const db = getDB();
    let objectId;

    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    const property = await db.collection("properties").findOne({ _id: objectId });

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const reviews = await db
      .collection("reviews")
      .find({ propertyId: objectId })
      .sort({ date: -1 })
      .toArray();

    const formatted = formatProperty(property);
    formatted.reviews = reviews.map(formatReview);

    res.json({ success: true, message: "Property fetched successfully", data: formatted });
  } catch (error) {
    console.error("GET /properties/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch property" });
  }
});

const VALID_TYPES = ["apartment", "house", "villa", "studio", "loft", "cabin"];

// Request body validator for property creation
function validateProperty(body) {
  const errors = [];
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    errors.push("Title is required and must be a string");
  }
  if (!body.shortDescription || typeof body.shortDescription !== "string" || !body.shortDescription.trim()) {
    errors.push("Short description is required and must be a string");
  }
  if (body.rent === undefined || isNaN(Number(body.rent)) || Number(body.rent) <= 0) {
    errors.push("Rent must be a number greater than 0");
  }
  if (!body.city || typeof body.city !== "string" || !body.city.trim()) {
    errors.push("City is required and must be a string");
  }
  if (!body.address || typeof body.address !== "string" || !body.address.trim()) {
    errors.push("Address is required and must be a string");
  }
  if (body.type && !VALID_TYPES.includes(body.type)) {
    errors.push(`Type must be one of: ${VALID_TYPES.join(", ")}`);
  }
  if (body.bedrooms !== undefined && (isNaN(Number(body.bedrooms)) || Number(body.bedrooms) < 0)) {
    errors.push("Bedrooms must be a non-negative number");
  }
  if (body.bathrooms !== undefined && (isNaN(Number(body.bathrooms)) || Number(body.bathrooms) < 0)) {
    errors.push("Bathrooms must be a non-negative number");
  }
  if (body.area !== undefined && (isNaN(Number(body.area)) || Number(body.area) < 0)) {
    errors.push("Area must be a non-negative number");
  }
  if (body.available && isNaN(Date.parse(body.available))) {
    errors.push("Available date must be a valid date format");
  }
  return errors;
}

// POST /properties
app.post("/properties", authenticate, async (req, res) => {
  try {
    const errors = validateProperty(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed: " + errors.join("; ") });
    }

    const db = getDB();
    const {
      title,
      shortDescription,
      fullDescription,
      rent,
      type,
      bedrooms,
      bathrooms,
      area,
      city,
      address,
      images,
      amenities,
      available,
      status = "available",
      featured = false,
      ownerPhone = "",
    } = req.body;

    const property = {
      title,
      shortDescription,
      fullDescription: fullDescription || shortDescription,
      rent: Number(rent),
      type: type || "apartment",
      bedrooms: Number(bedrooms) || 1,
      bathrooms: Number(bathrooms) || 1,
      area: Number(area) || 0,
      city,
      address,
      images: images?.length
        ? images
        : ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=560&fit=crop"],
      amenities: amenities || [],
      rating: 0,
      reviewCount: 0,
      ownerId: req.user.id, // Authenticated user ID from Better Auth
      ownerName: req.user.name || "Host",
      ownerImage: req.user.image || "",
      ownerPhone: ownerPhone,
      ownerEmail: req.user.email,
      available: available || new Date().toISOString().split("T")[0],
      status,
      featured,
      createdAt: new Date().toISOString().split("T")[0],
    };

    const result = await db.collection("properties").insertOne(property);

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: formatProperty({ _id: result.insertedId, ...property }),
    });
  } catch (error) {
    console.error("POST /properties error:", error);
    res.status(500).json({ success: false, message: "Failed to create property" });
  }
});

// Helper to verify property ownership
function isPropertyOwner(property, user) {
  const propertyOwnerId = property.ownerId ? property.ownerId.toString() : null;
  return (
    propertyOwnerId === user.id ||
    (property.ownerEmail &&
      user.email &&
      property.ownerEmail.toLowerCase() === user.email.toLowerCase())
  );
}

// PUT /properties/:id — update property (owner only)
app.put("/properties/:id", authenticate, async (req, res) => {
  try {
    const errors = validateProperty(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed: " + errors.join("; ") });
    }

    const db = getDB();
    let objectId;

    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    const existing = await db.collection("properties").findOne({ _id: objectId });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    if (!isPropertyOwner(existing, req.user)) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this property" });
    }

    const {
      title,
      shortDescription,
      fullDescription,
      rent,
      type,
      bedrooms,
      bathrooms,
      area,
      city,
      address,
      images,
      amenities,
      available,
      status,
      featured,
      ownerPhone,
    } = req.body;

    const updates = {
      title,
      shortDescription,
      fullDescription: fullDescription || shortDescription,
      rent: Number(rent),
      type: type || existing.type,
      bedrooms: Number(bedrooms) ?? existing.bedrooms,
      bathrooms: Number(bathrooms) ?? existing.bathrooms,
      area: Number(area) ?? existing.area,
      city,
      address,
      images: images?.length ? images : existing.images,
      amenities: amenities ?? existing.amenities,
      available: available || existing.available,
      status: status || existing.status,
      featured: featured ?? existing.featured,
      ownerPhone: ownerPhone ?? existing.ownerPhone,
    };

    await db.collection("properties").updateOne({ _id: objectId }, { $set: updates });

    const updated = await db.collection("properties").findOne({ _id: objectId });

    res.json({
      success: true,
      message: "Property updated successfully",
      data: formatProperty(updated),
    });
  } catch (error) {
    console.error("PUT /properties/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to update property" });
  }
});

// DELETE /properties/:id
app.delete("/properties/:id", authenticate, async (req, res) => {
  try {
    const db = getDB();
    let objectId;

    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    const property = await db.collection("properties").findOne({ _id: objectId });

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    if (!isPropertyOwner(property, req.user)) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this property" });
    }

    const result = await db.collection("properties").deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    await db.collection("reviews").deleteMany({ propertyId: objectId });

    res.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    console.error("DELETE /properties/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to delete property" });
  }
});

// GET /reviews/:propertyId
app.get("/reviews/:propertyId", async (req, res) => {
  try {
    const db = getDB();
    let propertyId;

    try {
      propertyId = new ObjectId(req.params.propertyId);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    const reviews = await db
      .collection("reviews")
      .find({ propertyId })
      .sort({ date: -1 })
      .toArray();

    res.json({
      success: true,
      message: "Reviews fetched successfully",
      data: reviews.map(formatReview),
    });
  } catch (error) {
    console.error("GET /reviews/:propertyId error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
});

// Request body validator for reviews
function validateReview(body) {
  const errors = [];
  if (!body.propertyId || typeof body.propertyId !== "string" || !body.propertyId.trim()) {
    errors.push("Property ID is required and must be a string");
  } else {
    try {
      new ObjectId(body.propertyId);
    } catch {
      errors.push("Property ID must be a valid ObjectId");
    }
  }
  if (body.rating === undefined || isNaN(Number(body.rating)) || Number(body.rating) < 1 || Number(body.rating) > 5) {
    errors.push("Rating must be a number between 1 and 5");
  }
  if (!body.comment || typeof body.comment !== "string" || !body.comment.trim()) {
    errors.push("Comment is required and must be a string");
  }
  return errors;
}

// POST /reviews
app.post("/reviews", authenticate, async (req, res) => {
  try {
    const errors = validateReview(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed: " + errors.join("; ") });
    }

    const db = getDB();
    const { propertyId, rating, comment, date } = req.body;

    let objectId = new ObjectId(propertyId);
    const property = await db.collection("properties").findOne({ _id: objectId });
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const review = {
      propertyId: objectId,
      userName: req.user.name,
      userImage: req.user.image || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop",
      rating: Number(rating),
      comment,
      date: date || new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection("reviews").insertOne(review);

    // Update property rating and reviewCount
    const allReviews = await db.collection("reviews").find({ propertyId: objectId }).toArray();
    const avgRating =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await db.collection("properties").updateOne(
      { _id: objectId },
      {
        $set: {
          rating: Math.round(avgRating * 10) / 10,
          reviewCount: allReviews.length,
        },
      }
    );

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: formatReview({ _id: result.insertedId, ...review }),
    });
  } catch (error) {
    console.error("POST /reviews error:", error);
    res.status(500).json({ success: false, message: "Failed to add review" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "StayNest API is running" });
});

async function start() {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`StayNest API running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
