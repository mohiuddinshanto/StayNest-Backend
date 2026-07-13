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
      role: user.role || "user",
    };
    next();
  } catch (error) {
    console.error("Backend auth middleware error:", error);
    res.status(500).json({ success: false, message: "Internal server error during authentication" });
  }
}

// Optional authentication middleware — verifies token if present, but never blocks the request.
// If there's no token, or it's invalid/expired/no matching user, req.user is just set to null
// and the request continues (unlike `authenticate`, which returns 401 in those cases).
async function optionalAuthenticate(req, res, next) {
  try {
    const token = getSessionToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    const db = getDB();

    const session = await db.collection("session").findOne({ token });
    if (!session) {
      req.user = null;
      return next();
    }

    if (new Date() > new Date(session.expiresAt)) {
      req.user = null;
      return next();
    }

    const orConditions = [{ id: session.userId }];
    try {
      orConditions.push({ _id: new ObjectId(session.userId) });
    } catch (e) {
      orConditions.push({ _id: session.userId });
    }

    let user = await db.collection("user").findOne({ $or: orConditions });
    if (!user) {
      user = await db.collection("users").findOne({ $or: orConditions });
    }

    if (!user) {
      req.user = null;
      return next();
    }

    req.user = {
      id: user.id || user._id.toString(),
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role || "user",
    };
    next();
  } catch (error) {
    console.error("Backend optionalAuthenticate error:", error);
    // Fail open (as a guest), never block the request due to an auth-check error
    req.user = null;
    next();
  }
}

// Middleware for Admin check
const requireAdmin = async (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

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
    approvalStatus: doc.approvalStatus || "pending",
    rejectionReason: doc.rejectionReason || "",
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

// Helper for formatting inquiries
function formatInquiry(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    propertyId: doc.propertyId.toString(),
    propertyTitle: doc.propertyTitle,
    ownerId: doc.ownerId?.toString(),
    senderId: doc.senderId?.toString(),
    senderName: doc.senderName,
    senderEmail: doc.senderEmail,
    type: doc.type,
    message: doc.message,
    preferredDate: doc.preferredDate || null,
    status: doc.status || "unread",
    createdAt: doc.createdAt,
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

// GET /properties — search, filter, sort, pagination (Public - only shows approved)
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

    const filter = { approvalStatus: "approved" };

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
      filter.ownerId = ownerId;
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

// GET /my-properties - Get user's own properties (including pending/rejected)
app.get("/my-properties", authenticate, async (req, res) => {
  try {
    const db = getDB();
    const properties = await db.collection("properties").find({
      $or: [{ ownerId: req.user.id }, { ownerEmail: req.user.email }]
    }).toArray();
    
    res.json({ 
      success: true, 
      message: "Your properties fetched successfully",
      data: properties.map(formatProperty) 
    });
  } catch (error) {
    console.error("GET /my-properties error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch your properties" });
  }
});

// GET /properties/:id
app.get("/properties/:id", optionalAuthenticate, async (req, res) => {
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

    // Non-approved properties are only visible to the owner or an admin.
    if (property.approvalStatus !== "approved") {
      const user = req.user; // null for guests (optionalAuthenticate never blocks)
      const isOwner =
        !!user &&
        (user.id === property.ownerId || user.email === property.ownerEmail);
      const isAdmin = !!user && user.role === "admin";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "This property is not approved yet",
        });
      }
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
    if (req.user.role === "user") {
      return res.status(403).json({ 
        success: false, 
        message: "Only owners or admins can list properties. Please upgrade your account." 
      });
    }

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
      ownerId: req.user.id,
      ownerName: req.user.name || "Host",
      ownerImage: req.user.image || "",
      ownerPhone: ownerPhone,
      ownerEmail: req.user.email,
      available: available || new Date().toISOString().split("T")[0],
      status,
      featured,
      approvalStatus: req.user.role === "admin" ? "approved" : "pending",
      rejectionReason: "",
      createdAt: new Date().toISOString().split("T")[0],
    };

    const result = await db.collection("properties").insertOne(property);

    res.status(201).json({
      success: true,
      message: req.user.role === "admin" 
        ? "Property created and approved successfully" 
        : "Property created successfully. It will be visible after admin approval.",
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
      approvalStatus: req.user.role === "admin" ? existing.approvalStatus : "pending",
    };

    await db.collection("properties").updateOne({ _id: objectId }, { $set: updates });

    const updated = await db.collection("properties").findOne({ _id: objectId });

    res.json({
      success: true,
      message: req.user.role === "admin" 
        ? "Property updated successfully" 
        : "Property updated successfully. It will be reviewed again by admin.",
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
    // Delete associated inquiries
    await db.collection("inquiries").deleteMany({ propertyId: objectId });

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

// PATCH /users/me/become-owner
app.patch("/users/me/become-owner", authenticate, async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;

    // Build the same dual id/_id lookup conditions used in the authenticate middleware,
    // since better-auth users may be keyed by a string `id` field or a Mongo ObjectId `_id`.
    const orConditions = [{ id: userId }];
    try {
      orConditions.push({ _id: new ObjectId(userId) });
    } catch (e) {
      orConditions.push({ _id: userId });
    }

    let user = await db.collection("user").findOne({ $or: orConditions });
    let collectionName = "user";
    if (!user) {
      user = await db.collection("users").findOne({ $or: orConditions });
      collectionName = "users";
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "owner" || user.role === "admin") {
      return res.json({ success: true, role: user.role });
    }

    await db.collection(collectionName).updateOne(
      { _id: user._id },
      { $set: { role: "owner" } }
    );

    res.json({ success: true, role: "owner" });
  } catch (error) {
    console.error("PATCH /users/me/become-owner error:", error);
    res.status(500).json({ success: false, message: "Failed to update role" });
  }
});

// ============================================
// INQUIRY ENDPOINTS
// ============================================

// 1. POST /inquiries — Send a new inquiry
app.post("/inquiries", authenticate, async (req, res) => {
  try {
    const db = getDB();
    const { propertyId, type, message, preferredDate } = req.body;

    if (!propertyId || !type || !message) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: propertyId, type, and message are required" 
      });
    }

    let objectId;
    try {
      objectId = new ObjectId(propertyId);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    const property = await db.collection("properties").findOne({ _id: objectId });
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Owner cannot send inquiry for their own property
    if (property.ownerId === req.user.id || property.ownerEmail === req.user.email) {
      return res.status(403).json({ 
        success: false, 
        message: "You cannot send an inquiry for your own property" 
      });
    }

    // Only allow inquiries on approved properties
    if (property.approvalStatus !== "approved") {
      return res.status(403).json({ 
        success: false, 
        message: "Cannot send inquiry for unapproved property" 
      });
    }

    const inquiry = {
      propertyId: property._id,
      propertyTitle: property.title,
      ownerId: property.ownerId,
      senderId: req.user.id,
      senderName: req.user.name || "Anonymous",
      senderEmail: req.user.email,
      type: type, // "message" or "schedule_viewing"
      message: message.trim(),
      preferredDate: preferredDate || null,
      status: "unread",
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection("inquiries").insertOne(inquiry);
    
    res.status(201).json({ 
      success: true, 
      message: "Inquiry sent successfully", 
      data: formatInquiry({ _id: result.insertedId, ...inquiry }) 
    });
  } catch (error) {
    console.error("POST /inquiries error:", error);
    res.status(500).json({ success: false, message: "Failed to send inquiry" });
  }
});

// 2. GET /inquiries/received — Get inquiries received by the owner
app.get("/inquiries/received", authenticate, async (req, res) => {
  try {
    const db = getDB();
    const { page = "1", limit = "20", status } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { ownerId: req.user.id };
    if (status && ["unread", "read"].includes(status)) {
      filter.status = status;
    }

    const total = await db.collection("inquiries").countDocuments(filter);
    const inquiries = await db.collection("inquiries")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      message: "Received inquiries fetched successfully",
      data: inquiries.map(formatInquiry),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("GET /inquiries/received error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inquiries" });
  }
});

// 3. GET /inquiries/sent — Get inquiries sent by the user
app.get("/inquiries/sent", authenticate, async (req, res) => {
  try {
    const db = getDB();
    const { page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { senderId: req.user.id };
    const total = await db.collection("inquiries").countDocuments(filter);
    const inquiries = await db.collection("inquiries")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      message: "Sent inquiries fetched successfully",
      data: inquiries.map(formatInquiry),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("GET /inquiries/sent error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inquiries" });
  }
});

// 4. GET /inquiries/:id — Get a specific inquiry
app.get("/inquiries/:id", authenticate, async (req, res) => {
  try {
    const db = getDB();
    let objectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid inquiry ID" });
    }

    const inquiry = await db.collection("inquiries").findOne({ _id: objectId });
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    // Check if user is sender or receiver (owner)
    if (inquiry.senderId !== req.user.id && inquiry.ownerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    res.json({ success: true, data: formatInquiry(inquiry) });
  } catch (error) {
    console.error("GET /inquiries/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inquiry" });
  }
});

// 5. PATCH /inquiries/:id/read — Mark inquiry as read (Owner only)
app.patch("/inquiries/:id/read", authenticate, async (req, res) => {
  try {
    const db = getDB();
    let objectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid inquiry ID" });
    }

    const inquiry = await db.collection("inquiries").findOne({ _id: objectId });
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    // Only the owner can mark as read
    if (inquiry.ownerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    await db.collection("inquiries").updateOne(
      { _id: objectId },
      { $set: { status: "read" } }
    );

    res.json({ success: true, message: "Inquiry marked as read" });
  } catch (error) {
    console.error("PATCH /inquiries/:id/read error:", error);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

// 6. DELETE /inquiries/:id — Delete an inquiry (Sender only)
app.delete("/inquiries/:id", authenticate, async (req, res) => {
  try {
    const db = getDB();
    let objectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid inquiry ID" });
    }

    const inquiry = await db.collection("inquiries").findOne({ _id: objectId });
    if (!inquiry) {
      return res.status(404).json({ success: false, message: "Inquiry not found" });
    }

    // Only the sender can delete the inquiry
    if (inquiry.senderId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    await db.collection("inquiries").deleteOne({ _id: objectId });

    res.json({ success: true, message: "Inquiry deleted successfully" });
  } catch (error) {
    console.error("DELETE /inquiries/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to delete inquiry" });
  }
});

// 7. GET /inquiries/property/:propertyId — Get inquiries for a specific property (Owner only)
app.get("/inquiries/property/:propertyId", authenticate, async (req, res) => {
  try {
    const db = getDB();
    let propertyObjectId;
    try {
      propertyObjectId = new ObjectId(req.params.propertyId);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    // Check if property exists and user is the owner
    const property = await db.collection("properties").findOne({ _id: propertyObjectId });
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    if (!isPropertyOwner(property, req.user)) {
      return res.status(403).json({ success: false, message: "You don't own this property" });
    }

    const inquiries = await db.collection("inquiries")
      .find({ propertyId: propertyObjectId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      message: "Property inquiries fetched successfully",
      data: inquiries.map(formatInquiry),
    });
  } catch (error) {
    console.error("GET /inquiries/property/:propertyId error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch property inquiries" });
  }
});

// 8. GET /inquiries/unread/count — Get unread inquiry count (Owner only)
app.get("/inquiries/unread/count", authenticate, async (req, res) => {
  try {
    const db = getDB();
    const count = await db.collection("inquiries").countDocuments({
      ownerId: req.user.id,
      status: "unread"
    });

    res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error("GET /inquiries/unread/count error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch unread count" });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

// 1. GET /owner/analytics — Owner এর নিজের প্রপার্টির হিসাব
app.get("/owner/analytics", authenticate, async (req, res) => {
  try {
    const db = getDB();
    const ownerId = req.user.id;

    // Aggregation pipeline for owner stats
    const stats = await db.collection("properties").aggregate([
      { $match: { ownerId: ownerId } },
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 },
          pendingCount: { $sum: { $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0] } },
          rejectedCount: { $sum: { $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ["$status", "rented"] }, "$rent", 0] } },
          totalReviews: { $sum: "$reviewCount" }
        }
      }
    ]).toArray();

    // Get Inquiry Count separately
    const totalInquiries = await db.collection("inquiries").countDocuments({ ownerId: ownerId });

    // Get property status breakdown
    const statusBreakdown = await db.collection("properties").aggregate([
      { $match: { ownerId: ownerId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Format status breakdown
    const statusStats = {};
    statusBreakdown.forEach(item => {
      statusStats[item._id || "unknown"] = item.count;
    });

    res.json({
      success: true,
      data: stats.length > 0 ? { 
        ...stats[0], 
        totalInquiries, 
        statusStats,
        _id: undefined 
      } : {
        totalProperties: 0, 
        pendingCount: 0, 
        approvedCount: 0, 
        rejectedCount: 0, 
        totalRevenue: 0, 
        totalReviews: 0, 
        totalInquiries,
        statusStats: {}
      }
    });
  } catch (error) {
    console.error("GET /owner/analytics error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch owner analytics" });
  }
});

// 2. GET /admin/analytics — Admin এর প্ল্যাটফর্ম ওয়াইড হিসাব
app.get("/admin/analytics", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDB();

    // Grouping by Owner
    const ownerAnalytics = await db.collection("properties").aggregate([
      {
        $group: {
          _id: "$ownerId",
          ownerName: { $first: "$ownerName" },
          ownerEmail: { $first: "$ownerEmail" },
          propertyCount: { $sum: 1 },
          approvedCount: { $sum: { $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0] } },
          rejectedCount: { $sum: { $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ["$status", "rented"] }, "$rent", 0] } },
          totalReviews: { $sum: "$reviewCount" }
        }
      },
      {
        $lookup: {
          from: "inquiries",
          localField: "_id",
          foreignField: "ownerId",
          as: "inquiries"
        }
      },
      {
        $project: {
          ownerId: "$_id",
          ownerName: 1,
          ownerEmail: 1,
          propertyCount: 1,
          approvedCount: 1,
          pendingCount: 1,
          rejectedCount: 1,
          totalRevenue: 1,
          totalReviews: 1,
          totalInquiries: { $size: "$inquiries" },
          _id: 0
        }
      },
      { $sort: { propertyCount: -1 } }
    ]).toArray();

    // Grand Totals
    const platformStats = await db.collection("properties").aggregate([
      {
        $group: {
          _id: null,
          platformTotalRevenue: { $sum: { $cond: [{ $eq: ["$status", "rented"] }, "$rent", 0] } },
          platformTotalProperties: { $sum: 1 },
          platformTotalApproved: { $sum: { $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0] } },
          platformTotalPending: { $sum: { $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0] } },
          platformTotalRejected: { $sum: { $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0] } },
          platformTotalReviews: { $sum: "$reviewCount" }
        }
      }
    ]).toArray();

    // Get property type distribution
    const typeDistribution = await db.collection("properties").aggregate([
      { $match: { approvalStatus: "approved" } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    // Get city distribution
    const cityDistribution = await db.collection("properties").aggregate([
      { $match: { approvalStatus: "approved" } },
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    // Get monthly trends (last 12 months)
    const monthlyTrends = await db.collection("properties").aggregate([
      {
        $match: {
          createdAt: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: { $dateFromString: { dateString: "$createdAt" } } },
            month: { $month: { $dateFromString: { dateString: "$createdAt" } } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 }
    ]).toArray();

    const totalUsers = await db.collection("user").countDocuments();
    const totalOwners = await db.collection("user").countDocuments({ role: "owner" });
    const totalAdmins = await db.collection("user").countDocuments({ role: "admin" });
    const totalInquiries = await db.collection("inquiries").countDocuments();

    // Format monthly trends
    const formattedMonthlyTrends = monthlyTrends.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      count: item.count
    }));

    res.json({
      success: true,
      data: {
        ownerAnalytics,
        grandTotal: {
          platformTotalRevenue: platformStats[0]?.platformTotalRevenue || 0,
          platformTotalProperties: platformStats[0]?.platformTotalProperties || 0,
          platformTotalApproved: platformStats[0]?.platformTotalApproved || 0,
          platformTotalPending: platformStats[0]?.platformTotalPending || 0,
          platformTotalRejected: platformStats[0]?.platformTotalRejected || 0,
          platformTotalReviews: platformStats[0]?.platformTotalReviews || 0,
          platformTotalUsers: totalUsers,
          platformTotalOwners: totalOwners,
          platformTotalAdmins: totalAdmins,
          platformTotalInquiries: totalInquiries,
        },
        distributions: {
          typeDistribution,
          cityDistribution,
        },
        monthlyTrends: formattedMonthlyTrends
      }
    });
  } catch (error) {
    console.error("GET /admin/analytics error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch admin analytics" });
  }
});

// 3. GET /owner/analytics/:propertyId — Owner: নির্দিষ্ট প্রপার্টির অ্যানালিটিক্স
app.get("/owner/analytics/:propertyId", authenticate, async (req, res) => {
  try {
    const db = getDB();
    const propertyId = req.params.propertyId;
    
    let objectId;
    try {
      objectId = new ObjectId(propertyId);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    // Check property ownership
    const property = await db.collection("properties").findOne({ _id: objectId });
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    if (!isPropertyOwner(property, req.user)) {
      return res.status(403).json({ success: false, message: "You don't own this property" });
    }

    // Get property inquiries
    const inquiries = await db.collection("inquiries")
      .find({ propertyId: objectId })
      .sort({ createdAt: -1 })
      .toArray();

    // Get property reviews
    const reviews = await db.collection("reviews")
      .find({ propertyId: objectId })
      .sort({ createdAt: -1 })
      .toArray();

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      success: true,
      data: {
        property: formatProperty(property),
        totalInquiries: inquiries.length,
        unreadInquiries: inquiries.filter(i => i.status === "unread").length,
        totalReviews: reviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
        inquiries: inquiries.map(formatInquiry),
        reviews: reviews.map(formatReview)
      }
    });
  } catch (error) {
    console.error("GET /owner/analytics/:propertyId error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch property analytics" });
  }
});

// ============================================
// ADMIN ENDPOINTS FOR PROPERTY APPROVAL
// ============================================

// GET /admin/properties/pending - Get all pending properties (Admin only)
app.get("/admin/properties/pending", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { page = "1", limit = "10" } = req.query;
    
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = { approvalStatus: "pending" };
    const total = await db.collection("properties").countDocuments(filter);
    const properties = await db.collection("properties")
      .find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      data: properties.map(formatProperty),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("GET /admin/properties/pending error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch pending properties" });
  }
});

// GET /admin/properties — Admin: Get all properties with filters
app.get("/admin/properties/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { status, page = "1", limit = "20" } = req.query;
    
    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.approvalStatus = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const total = await db.collection("properties").countDocuments(filter);
    const properties = await db.collection("properties")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      data: properties.map(formatProperty),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("GET /admin/properties/all error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch properties" });
  }
});

// PATCH /admin/properties/:id/status - Change approval status (Admin only)
// Unified endpoint that replaces the old /approve and /reject endpoints.
// Admin can move any property to any approvalStatus ("approved" | "pending" | "rejected")
// regardless of its current status. If a property is un-approved (moved back to
// "pending" or "rejected"), it automatically stops appearing on GET /properties
// because that route already filters on approvalStatus === "approved" — no extra
// code needed here for that behavior.
app.patch("/admin/properties/:id/status", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    let objectId;

    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }

    const { approvalStatus, rejectionReason } = req.body;
    
    if (!approvalStatus || !["pending", "approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid approval status. Must be 'pending', 'approved', or 'rejected'" 
      });
    }

    const property = await db.collection("properties").findOne({ _id: objectId });
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const updateData = { approvalStatus };
    if (approvalStatus === "rejected") {
      updateData.rejectionReason = (rejectionReason || "").toString().trim() || "No reason provided";
    } else {
      // approved or pending: clear any previous rejection reason
      updateData.rejectionReason = "";
    }

    await db.collection("properties").updateOne(
      { _id: objectId },
      { $set: updateData }
    );

    const updated = await db.collection("properties").findOne({ _id: objectId });

    res.json({ 
      success: true, 
      message: `Property status updated to ${approvalStatus}`,
      data: formatProperty(updated)
    });
  } catch (error) {
    console.error("PATCH /admin/properties/:id/status error:", error);
    res.status(500).json({ success: false, message: "Failed to update property status" });
  }
});

// DELETE /admin/properties/:id — Admin: Delete property + reviews + inquiries
app.delete("/admin/properties/:id", authenticate, requireAdmin, async (req, res) => {
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

    await db.collection("properties").deleteOne({ _id: objectId });
    await db.collection("reviews").deleteMany({ propertyId: objectId });
    await db.collection("inquiries").deleteMany({ propertyId: objectId });

    res.json({ 
      success: true, 
      message: "Property and associated data (reviews, inquiries) deleted by Admin" 
    });
  } catch (error) {
    console.error("DELETE /admin/properties/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to delete property" });
  }
});

// GET /admin/users — Admin: Get all users
app.get("/admin/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const users = await db.collection("user").find({}, { 
      projection: { id: 1, name: 1, email: 1, role: 1, createdAt: 1 } 
    }).toArray();
    
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("GET /admin/users error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// ============================================
// REVIEWS
// ============================================

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

    // Only allow reviews on approved properties
    if (property.approvalStatus !== "approved") {
      return res.status(403).json({ 
        success: false, 
        message: "Cannot review property that is not approved" 
      });
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