import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { ObjectId, Filter } from "mongodb";
import dotenv from "dotenv";

import { connectDB, getDB } from "./db";
// server.ts এর শুরুতে
import {
  AuthRequest,
  OptionalAuthRequest,
  AuthUser,
  FormattedProperty,
  FormattedReview,
  FormattedInquiry,
  PropertyDoc,
  ReviewDoc,
  InquiryDoc,
  CreatePropertyBody,
  CreateReviewBody,
  CreateInquiryBody,
  UpdateApprovalStatusBody,
  PropertyType,
  ApprovalStatus,
} from "./types";
dotenv.config();

const app = express();
const port = process.env.PORT ?? 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").reduce<Record<string, string>>((acc, cookie) => {
    const parts = cookie.split("=");
    const key = parts[0].trim();
    const val = parts.slice(1).join("=");
    acc[key] = val;
    return acc;
  }, {});
  return cookies["better-auth.session_token"] ?? null;
}

function buildSort(sort: string): Record<string, 1 | -1> {
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

function isPropertyOwner(property: PropertyDoc, user: AuthUser): boolean {
  const propertyOwnerId = property.ownerId ? property.ownerId.toString() : null;
  return (
    propertyOwnerId === user.id ||
    (!!property.ownerEmail &&
      !!user.email &&
      property.ownerEmail.toLowerCase() === user.email.toLowerCase())
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatProperty(doc: PropertyDoc): FormattedProperty {
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
    approvalStatus: doc.approvalStatus ?? "pending",
    rejectionReason: doc.rejectionReason ?? "",
    createdAt: doc.createdAt,
  };
}

function formatReview(doc: ReviewDoc): FormattedReview {
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

function formatInquiry(doc: InquiryDoc): FormattedInquiry {
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
    preferredDate: doc.preferredDate ?? null,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

// ─── Validators ───────────────────────────────────────────────────────────────

const VALID_TYPES: PropertyType[] = ["apartment", "house", "villa", "studio", "loft", "cabin"];

function validateProperty(body: Partial<CreatePropertyBody>): string[] {
  const errors: string[] = [];
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

function validateReview(body: Partial<CreateReviewBody>): string[] {
  const errors: string[] = [];
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

// ─── Middleware ───────────────────────────────────────────────────────────────

async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = getSessionToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: "Unauthorized: No session token provided" });
      return;
    }

    const db = getDB();
    const session = await db.collection("session").findOne({ token });
    if (!session) {
      res.status(401).json({ success: false, message: "Unauthorized: Invalid session" });
      return;
    }

    if (new Date() > new Date(session.expiresAt as string)) {
      res.status(401).json({ success: false, message: "Unauthorized: Session expired" });
      return;
    }

    const orConditions: object[] = [{ id: session.userId }];
    try {
      orConditions.push({ _id: new ObjectId(session.userId as string) });
    } catch {
      orConditions.push({ _id: session.userId });
    }

    let user = await db.collection("user").findOne({ $or: orConditions });
    if (!user) user = await db.collection("users").findOne({ $or: orConditions });

    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized: User not found" });
      return;
    }

    (req as AuthRequest).user = {
      id: (user.id as string) ?? user._id.toString(),
      name: user.name as string,
      email: user.email as string,
      image: user.image as string | undefined,
      role: (user.role as string) ?? "user",
    } as AuthUser;

    next();
  } catch (error) {
    console.error("Backend auth middleware error:", error);
    res.status(500).json({ success: false, message: "Internal server error during authentication" });
  }
}

async function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = getSessionToken(req);
    if (!token) {
      (req as OptionalAuthRequest).user = null;
      return next();
    }

    const db = getDB();
    const session = await db.collection("session").findOne({ token });
    if (!session || new Date() > new Date(session.expiresAt as string)) {
      (req as OptionalAuthRequest).user = null;
      return next();
    }

    const orConditions: object[] = [{ id: session.userId }];
    try {
      orConditions.push({ _id: new ObjectId(session.userId as string) });
    } catch {
      orConditions.push({ _id: session.userId });
    }

    let user = await db.collection("user").findOne({ $or: orConditions });
    if (!user) user = await db.collection("users").findOne({ $or: orConditions });

    if (!user) {
      (req as OptionalAuthRequest).user = null;
      return next();
    }

    (req as OptionalAuthRequest).user = {
      id: (user.id as string) ?? user._id.toString(),
      name: user.name as string,
      email: user.email as string,
      image: user.image as string | undefined,
      role: (user.role as string) ?? "user",
    } as AuthUser;

    next();
  } catch (error) {
    console.error("Backend optionalAuthenticate error:", error);
    (req as OptionalAuthRequest).user = null;
    next();
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if ((req as AuthRequest).user.role !== "admin") {
    res.status(403).json({ success: false, message: "Admin access required" });
    return;
  }
  next();
}

// ─── Properties ───────────────────────────────────────────────────────────────

// GET /properties
app.get("/properties", async (req: Request, res: Response): Promise<void> => {
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
    } = req.query as Record<string, string | undefined>;

    const filter: Filter<PropertyDoc> = { approvalStatus: "approved" };

    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [
        { title: regex },
        { city: regex },
        { address: regex },
        { shortDescription: regex },
      ];
    }

    if (type && type !== "all") filter.type = type as PropertyType;
    if (city) filter.city = new RegExp(city, "i");
    if (featured === "true") filter.featured = true;
    if (ownerId) filter.ownerId = ownerId;

    if (minPrice || maxPrice) {
      const rent: Record<string, number> = {};
      if (minPrice) rent.$gte = Number(minPrice);
      if (maxPrice) rent.$lte = Number(maxPrice);
      filter.rent = rent;
    }

    if (beds && beds !== "any") {
      filter.bedrooms = beds === "5+" ? { $gte: 5 } : Number(beds);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const collection = db.collection<PropertyDoc>("properties");
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
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("GET /properties error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch properties" });
  }
});

// GET /my-properties
app.get("/my-properties", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    const properties = await db
      .collection<PropertyDoc>("properties")
      .find({ $or: [{ ownerId: user.id }, { ownerEmail: user.email }] })
      .toArray();

    res.json({
      success: true,
      message: "Your properties fetched successfully",
      data: properties.map(formatProperty),
    });
  } catch (error) {
    console.error("GET /my-properties error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch your properties" });
  }
});

// GET /properties/:id
app.get("/properties/:id", optionalAuthenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as OptionalAuthRequest).user;
  try {
    const db = getDB();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      res.status(400).json({ success: false, message: "Invalid property ID" });
      return;
    }

    const property = await db.collection<PropertyDoc>("properties").findOne({ _id: objectId });
    if (!property) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    if (property.approvalStatus !== "approved") {
      const isOwner = !!user && (user.id === property.ownerId || user.email === property.ownerEmail);
      const isAdmin = !!user && user.role === "admin";
      if (!isOwner && !isAdmin) {
        res.status(403).json({ success: false, message: "This property is not approved yet" });
        return;
      }
    }

    const reviews = await db
      .collection<ReviewDoc>("reviews")
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

// POST /properties
app.post("/properties", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    if (user.role === "user") {
      res.status(403).json({
        success: false,
        message: "Only owners or admins can list properties. Please upgrade your account.",
      });
      return;
    }

    const body = req.body as CreatePropertyBody;
    const errors = validateProperty(body);
    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed: " + errors.join("; ") });
      return;
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
    } = body;

    const property = {
      title,
      shortDescription,
      fullDescription: fullDescription ?? shortDescription,
      rent: Number(rent),
      type: type ?? "apartment",
      bedrooms: Number(bedrooms) || 1,
      bathrooms: Number(bathrooms) || 1,
      area: Number(area) || 0,
      city,
      address,
      images: images?.length
        ? images
        : ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=560&fit=crop"],
      amenities: amenities ?? [],
      rating: 0,
      reviewCount: 0,
      ownerId: user.id,
      ownerName: user.name ?? "Host",
      ownerImage: user.image ?? "",
      ownerPhone,
      ownerEmail: user.email,
      available: available ?? new Date().toISOString().split("T")[0],
      status,
      featured,
      approvalStatus: (user.role === "admin" ? "approved" : "pending") as ApprovalStatus,
      rejectionReason: "",
      createdAt: new Date().toISOString().split("T")[0],
    };

    const result = await db.collection("properties").insertOne(property);

    res.status(201).json({
      success: true,
      message:
        user.role === "admin"
          ? "Property created and approved successfully"
          : "Property created successfully. It will be visible after admin approval.",
      data: formatProperty({ _id: result.insertedId, ...property } as PropertyDoc),
    });
  } catch (error) {
    console.error("POST /properties error:", error);
    res.status(500).json({ success: false, message: "Failed to create property" });
  }
});

// PUT /properties/:id
app.put("/properties/:id", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const body = req.body as CreatePropertyBody;
    const errors = validateProperty(body);
    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed: " + errors.join("; ") });
      return;
    }

    const db = getDB();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      res.status(400).json({ success: false, message: "Invalid property ID" });
      return;
    }

    const existing = await db.collection<PropertyDoc>("properties").findOne({ _id: objectId });
    if (!existing) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    if (!isPropertyOwner(existing, user)) {
      res.status(403).json({ success: false, message: "Forbidden: You do not own this property" });
      return;
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
    } = body;

    const updates = {
      title,
      shortDescription,
      fullDescription: fullDescription ?? shortDescription,
      rent: Number(rent),
      type: type ?? existing.type,
      bedrooms: Number(bedrooms) ?? existing.bedrooms,
      bathrooms: Number(bathrooms) ?? existing.bathrooms,
      area: Number(area) ?? existing.area,
      city,
      address,
      images: images?.length ? images : existing.images,
      amenities: amenities ?? existing.amenities,
      available: available ?? existing.available,
      status: status ?? existing.status,
      featured: featured ?? existing.featured,
      ownerPhone: ownerPhone ?? existing.ownerPhone,
      approvalStatus: user.role === "admin" ? existing.approvalStatus : ("pending" as ApprovalStatus),
    };

    await db.collection("properties").updateOne({ _id: objectId }, { $set: updates });
    const updated = await db.collection<PropertyDoc>("properties").findOne({ _id: objectId });

    res.json({
      success: true,
      message:
        user.role === "admin"
          ? "Property updated successfully"
          : "Property updated successfully. It will be reviewed again by admin.",
      data: formatProperty(updated!),
    });
  } catch (error) {
    console.error("PUT /properties/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to update property" });
  }
});

// DELETE /properties/:id
app.delete("/properties/:id", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      res.status(400).json({ success: false, message: "Invalid property ID" });
      return;
    }

    const property = await db.collection<PropertyDoc>("properties").findOne({ _id: objectId });
    if (!property) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    if (!isPropertyOwner(property, user)) {
      res.status(403).json({ success: false, message: "Forbidden: You do not own this property" });
      return;
    }

    const result = await db.collection("properties").deleteOne({ _id: objectId });
    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    await db.collection("reviews").deleteMany({ propertyId: objectId });
    await db.collection("inquiries").deleteMany({ propertyId: objectId });

    res.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    console.error("DELETE /properties/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to delete property" });
  }
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

// GET /reviews/:propertyId
app.get("/reviews/:propertyId", async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDB();
    let propertyId: ObjectId;
    try {
      propertyId = new ObjectId(req.params.propertyId);
    } catch {
      res.status(400).json({ success: false, message: "Invalid property ID" });
      return;
    }

    const reviews = await db
      .collection<ReviewDoc>("reviews")
      .find({ propertyId })
      .sort({ date: -1 })
      .toArray();

    res.json({ success: true, message: "Reviews fetched successfully", data: reviews.map(formatReview) });
  } catch (error) {
    console.error("GET /reviews/:propertyId error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
});

// POST /reviews
app.post("/reviews", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const body = req.body as CreateReviewBody;
    const errors = validateReview(body);
    if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Validation failed: " + errors.join("; ") });
      return;
    }

    const db = getDB();
    const { propertyId, rating, comment, date } = body;
    const objectId = new ObjectId(propertyId);

    const property = await db.collection<PropertyDoc>("properties").findOne({ _id: objectId });
    if (!property) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    if (property.approvalStatus !== "approved") {
      res.status(403).json({ success: false, message: "Cannot review property that is not approved" });
      return;
    }

    const review = {
      propertyId: objectId,
      userName: user.name,
      userImage: user.image ?? "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop",
      rating: Number(rating),
      comment,
      date: date ?? new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection("reviews").insertOne(review);

    const allReviews = await db.collection<ReviewDoc>("reviews").find({ propertyId: objectId }).toArray();
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await db.collection("properties").updateOne(
      { _id: objectId },
      { $set: { rating: Math.round(avgRating * 10) / 10, reviewCount: allReviews.length } }
    );

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: formatReview({ _id: result.insertedId, ...review } as ReviewDoc),
    });
  } catch (error) {
    console.error("POST /reviews error:", error);
    res.status(500).json({ success: false, message: "Failed to add review" });
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────

// PATCH /users/me/become-owner
app.patch("/users/me/become-owner", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    const userId = user.id;

    const orConditions: object[] = [{ id: userId }];
    try {
      orConditions.push({ _id: new ObjectId(userId) });
    } catch {
      orConditions.push({ _id: userId });
    }

    let foundUser = await db.collection("user").findOne({ $or: orConditions });
    let collectionName = "user";
    if (!foundUser) {
      foundUser = await db.collection("users").findOne({ $or: orConditions });
      collectionName = "users";
    }

    if (!foundUser) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (foundUser.role === "owner" || foundUser.role === "admin") {
      res.json({ success: true, role: foundUser.role });
      return;
    }

    await db.collection(collectionName).updateOne({ _id: foundUser._id }, { $set: { role: "owner" } });
    res.json({ success: true, role: "owner" });
  } catch (error) {
    console.error("PATCH /users/me/become-owner error:", error);
    res.status(500).json({ success: false, message: "Failed to update role" });
  }
});

// ─── Inquiries ────────────────────────────────────────────────────────────────

// POST /inquiries
app.post("/inquiries", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    const { propertyId, type, message, preferredDate } = req.body as CreateInquiryBody;

    if (!propertyId || !type || !message) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: propertyId, type, and message are required",
      });
      return;
    }

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(propertyId);
    } catch {
      res.status(400).json({ success: false, message: "Invalid property ID" });
      return;
    }

    const property = await db.collection<PropertyDoc>("properties").findOne({ _id: objectId });
    if (!property) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    if (property.ownerId === user.id || property.ownerEmail === user.email) {
      res.status(403).json({ success: false, message: "You cannot send an inquiry for your own property" });
      return;
    }

    if (property.approvalStatus !== "approved") {
      res.status(403).json({ success: false, message: "Cannot send inquiry for unapproved property" });
      return;
    }

    const inquiry = {
      propertyId: property._id,
      propertyTitle: property.title,
      ownerId: property.ownerId as string,
      senderId: user.id,
      senderName: user.name ?? "Anonymous",
      senderEmail: user.email,
      type,
      message: message.trim(),
      preferredDate: preferredDate ?? null,
      status: "unread" as const,
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection("inquiries").insertOne(inquiry);
    res.status(201).json({
      success: true,
      message: "Inquiry sent successfully",
      data: formatInquiry({ _id: result.insertedId, ...inquiry } as InquiryDoc),
    });
  } catch (error) {
    console.error("POST /inquiries error:", error);
    res.status(500).json({ success: false, message: "Failed to send inquiry" });
  }
});

// GET /inquiries/received
app.get("/inquiries/received", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    const { page = "1", limit = "20", status } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = { ownerId: user.id };
    if (status && ["unread", "read"].includes(status)) filter.status = status;

    const total = await db.collection("inquiries").countDocuments(filter);
    const inquiries = await db
      .collection<InquiryDoc>("inquiries")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      message: "Received inquiries fetched successfully",
      data: inquiries.map(formatInquiry),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("GET /inquiries/received error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inquiries" });
  }
});

// GET /inquiries/sent
app.get("/inquiries/sent", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    const { page = "1", limit = "20" } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { senderId: user.id };
    const total = await db.collection("inquiries").countDocuments(filter);
    const inquiries = await db
      .collection<InquiryDoc>("inquiries")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      message: "Sent inquiries fetched successfully",
      data: inquiries.map(formatInquiry),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("GET /inquiries/sent error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inquiries" });
  }
});

// GET /inquiries/unread/count
app.get("/inquiries/unread/count", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    const count = await db.collection("inquiries").countDocuments({ ownerId: user.id, status: "unread" });
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error("GET /inquiries/unread/count error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch unread count" });
  }
});

// GET /inquiries/property/:propertyId
app.get("/inquiries/property/:propertyId", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    let propertyObjectId: ObjectId;
    try {
      propertyObjectId = new ObjectId(req.params.propertyId);
    } catch {
      res.status(400).json({ success: false, message: "Invalid property ID" });
      return;
    }

    const property = await db.collection<PropertyDoc>("properties").findOne({ _id: propertyObjectId });
    if (!property) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    if (!isPropertyOwner(property, user)) {
      res.status(403).json({ success: false, message: "You don't own this property" });
      return;
    }

    const inquiries = await db
      .collection<InquiryDoc>("inquiries")
      .find({ propertyId: propertyObjectId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, message: "Property inquiries fetched successfully", data: inquiries.map(formatInquiry) });
  } catch (error) {
    console.error("GET /inquiries/property/:propertyId error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch property inquiries" });
  }
});

// GET /inquiries/:id
app.get("/inquiries/:id", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      res.status(400).json({ success: false, message: "Invalid inquiry ID" });
      return;
    }

    const inquiry = await db.collection<InquiryDoc>("inquiries").findOne({ _id: objectId });
    if (!inquiry) {
      res.status(404).json({ success: false, message: "Inquiry not found" });
      return;
    }

    if (inquiry.senderId !== user.id && inquiry.ownerId !== user.id) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    res.json({ success: true, data: formatInquiry(inquiry) });
  } catch (error) {
    console.error("GET /inquiries/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inquiry" });
  }
});

// PATCH /inquiries/:id/read
app.patch("/inquiries/:id/read", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      res.status(400).json({ success: false, message: "Invalid inquiry ID" });
      return;
    }

    const inquiry = await db.collection<InquiryDoc>("inquiries").findOne({ _id: objectId });
    if (!inquiry) {
      res.status(404).json({ success: false, message: "Inquiry not found" });
      return;
    }

    if (inquiry.ownerId !== user.id) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    await db.collection("inquiries").updateOne({ _id: objectId }, { $set: { status: "read" } });
    res.json({ success: true, message: "Inquiry marked as read" });
  } catch (error) {
    console.error("PATCH /inquiries/:id/read error:", error);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

// DELETE /inquiries/:id
app.delete("/inquiries/:id", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      res.status(400).json({ success: false, message: "Invalid inquiry ID" });
      return;
    }

    const inquiry = await db.collection<InquiryDoc>("inquiries").findOne({ _id: objectId });
    if (!inquiry) {
      res.status(404).json({ success: false, message: "Inquiry not found" });
      return;
    }

    if (inquiry.senderId !== user.id) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    await db.collection("inquiries").deleteOne({ _id: objectId });
    res.json({ success: true, message: "Inquiry deleted successfully" });
  } catch (error) {
    console.error("DELETE /inquiries/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to delete inquiry" });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

// GET /owner/analytics
app.get("/owner/analytics", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    const ownerId = user.id;

    const stats = await db.collection("properties").aggregate([
      { $match: { ownerId } },
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 },
          pendingCount: { $sum: { $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0] } },
          rejectedCount: { $sum: { $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ["$status", "rented"] }, "$rent", 0] } },
          totalReviews: { $sum: "$reviewCount" },
        },
      },
    ]).toArray();

    const totalInquiries = await db.collection("inquiries").countDocuments({ ownerId });

    const statusBreakdown = await db.collection("properties").aggregate([
      { $match: { ownerId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).toArray();

    const statusStats: Record<string, number> = {};
    statusBreakdown.forEach((item) => {
      statusStats[(item._id as string) ?? "unknown"] = item.count as number;
    });

    res.json({
      success: true,
      data: stats.length > 0
        ? { ...stats[0], totalInquiries, statusStats, _id: undefined }
        : { totalProperties: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0, totalRevenue: 0, totalReviews: 0, totalInquiries, statusStats: {} },
    });
  } catch (error) {
    console.error("GET /owner/analytics error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch owner analytics" });
  }
});

// GET /owner/analytics/:propertyId
app.get("/owner/analytics/:propertyId", authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  try {
    const db = getDB();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(req.params.propertyId);
    } catch {
      res.status(400).json({ success: false, message: "Invalid property ID" });
      return;
    }

    const property = await db.collection<PropertyDoc>("properties").findOne({ _id: objectId });
    if (!property) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    if (!isPropertyOwner(property, user)) {
      res.status(403).json({ success: false, message: "You don't own this property" });
      return;
    }

    const inquiries = await db.collection<InquiryDoc>("inquiries")
      .find({ propertyId: objectId })
      .sort({ createdAt: -1 })
      .toArray();

    const reviews = await db.collection<ReviewDoc>("reviews")
      .find({ propertyId: objectId })
      .sort({ createdAt: -1 })
      .toArray();

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      success: true,
      data: {
        property: formatProperty(property),
        totalInquiries: inquiries.length,
        unreadInquiries: inquiries.filter((i) => i.status === "unread").length,
        totalReviews: reviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
        inquiries: inquiries.map(formatInquiry),
        reviews: reviews.map(formatReview),
      },
    });
  } catch (error) {
    console.error("GET /owner/analytics/:propertyId error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch property analytics" });
  }
});

// GET /admin/analytics
app.get("/admin/analytics", authenticate, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = getDB();

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
          totalReviews: { $sum: "$reviewCount" },
        },
      },
      { $lookup: { from: "inquiries", localField: "_id", foreignField: "ownerId", as: "inquiries" } },
      {
        $project: {
          ownerId: "$_id", ownerName: 1, ownerEmail: 1, propertyCount: 1,
          approvedCount: 1, pendingCount: 1, rejectedCount: 1,
          totalRevenue: 1, totalReviews: 1, totalInquiries: { $size: "$inquiries" }, _id: 0,
        },
      },
      { $sort: { propertyCount: -1 } },
    ]).toArray();

    const platformStats = await db.collection("properties").aggregate([
      {
        $group: {
          _id: null,
          platformTotalRevenue: { $sum: { $cond: [{ $eq: ["$status", "rented"] }, "$rent", 0] } },
          platformTotalProperties: { $sum: 1 },
          platformTotalApproved: { $sum: { $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0] } },
          platformTotalPending: { $sum: { $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0] } },
          platformTotalRejected: { $sum: { $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0] } },
          platformTotalReviews: { $sum: "$reviewCount" },
        },
      },
    ]).toArray();

    const typeDistribution = await db.collection("properties").aggregate([
      { $match: { approvalStatus: "approved" } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    const cityDistribution = await db.collection("properties").aggregate([
      { $match: { approvalStatus: "approved" } },
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray();

    const monthlyTrends = await db.collection("properties").aggregate([
      { $match: { createdAt: { $exists: true } } },
      {
        $group: {
          _id: {
            year: { $year: { $dateFromString: { dateString: "$createdAt" } } },
            month: { $month: { $dateFromString: { dateString: "$createdAt" } } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]).toArray();

    const totalUsers = await db.collection("user").countDocuments();
    const totalOwners = await db.collection("user").countDocuments({ role: "owner" });
    const totalAdmins = await db.collection("user").countDocuments({ role: "admin" });
    const totalInquiries = await db.collection("inquiries").countDocuments();

    const formattedMonthlyTrends = monthlyTrends.map((item) => ({
      month: `${(item._id as { year: number; month: number }).year}-${String((item._id as { year: number; month: number }).month).padStart(2, "0")}`,
      count: item.count as number,
    }));

    res.json({
      success: true,
      data: {
        ownerAnalytics,
        grandTotal: {
          platformTotalRevenue: (platformStats[0]?.platformTotalRevenue as number) ?? 0,
          platformTotalProperties: (platformStats[0]?.platformTotalProperties as number) ?? 0,
          platformTotalApproved: (platformStats[0]?.platformTotalApproved as number) ?? 0,
          platformTotalPending: (platformStats[0]?.platformTotalPending as number) ?? 0,
          platformTotalRejected: (platformStats[0]?.platformTotalRejected as number) ?? 0,
          platformTotalReviews: (platformStats[0]?.platformTotalReviews as number) ?? 0,
          platformTotalUsers: totalUsers,
          platformTotalOwners: totalOwners,
          platformTotalAdmins: totalAdmins,
          platformTotalInquiries: totalInquiries,
        },
        distributions: { typeDistribution, cityDistribution },
        monthlyTrends: formattedMonthlyTrends,
      },
    });
  } catch (error) {
    console.error("GET /admin/analytics error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch admin analytics" });
  }
});

// ─── Admin — Properties ───────────────────────────────────────────────────────

// GET /admin/properties/pending
app.get("/admin/properties/pending", authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDB();
    const { page = "1", limit = "10" } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter: Filter<PropertyDoc> = { approvalStatus: "pending" };
    const total = await db.collection<PropertyDoc>("properties").countDocuments(filter);
    const properties = await db.collection<PropertyDoc>("properties")
      .find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      data: properties.map(formatProperty),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("GET /admin/properties/pending error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch pending properties" });
  }
});

// GET /admin/properties/all
app.get("/admin/properties/all", authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDB();
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;

    const filter: Filter<PropertyDoc> = {};
    if (status && (["pending", "approved", "rejected"] as ApprovalStatus[]).includes(status as ApprovalStatus)) {
      filter.approvalStatus = status as ApprovalStatus;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const total = await db.collection<PropertyDoc>("properties").countDocuments(filter);
    const properties = await db.collection<PropertyDoc>("properties")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.json({
      success: true,
      data: properties.map(formatProperty),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("GET /admin/properties/all error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch properties" });
  }
});

// PATCH /admin/properties/:id/status
app.patch("/admin/properties/:id/status", authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDB();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      res.status(400).json({ success: false, message: "Invalid property ID" });
      return;
    }

    const { approvalStatus, rejectionReason } = req.body as UpdateApprovalStatusBody;
    const validStatuses: ApprovalStatus[] = ["pending", "approved", "rejected"];

    if (!approvalStatus || !validStatuses.includes(approvalStatus)) {
      res.status(400).json({
        success: false,
        message: "Invalid approval status. Must be 'pending', 'approved', or 'rejected'",
      });
      return;
    }

    const property = await db.collection<PropertyDoc>("properties").findOne({ _id: objectId });
    if (!property) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    const updateData: Record<string, string> = { approvalStatus };
    if (approvalStatus === "rejected") {
      updateData.rejectionReason = (rejectionReason ?? "").toString().trim() || "No reason provided";
    } else {
      updateData.rejectionReason = "";
    }

    await db.collection("properties").updateOne({ _id: objectId }, { $set: updateData });
    const updated = await db.collection<PropertyDoc>("properties").findOne({ _id: objectId });

    res.json({
      success: true,
      message: `Property status updated to ${approvalStatus}`,
      data: formatProperty(updated!),
    });
  } catch (error) {
    console.error("PATCH /admin/properties/:id/status error:", error);
    res.status(500).json({ success: false, message: "Failed to update property status" });
  }
});

// DELETE /admin/properties/:id
app.delete("/admin/properties/:id", authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDB();
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      res.status(400).json({ success: false, message: "Invalid property ID" });
      return;
    }

    const property = await db.collection("properties").findOne({ _id: objectId });
    if (!property) {
      res.status(404).json({ success: false, message: "Property not found" });
      return;
    }

    await db.collection("properties").deleteOne({ _id: objectId });
    await db.collection("reviews").deleteMany({ propertyId: objectId });
    await db.collection("inquiries").deleteMany({ propertyId: objectId });

    res.json({ success: true, message: "Property and associated data (reviews, inquiries) deleted by Admin" });
  } catch (error) {
    console.error("DELETE /admin/properties/:id error:", error);
    res.status(500).json({ success: false, message: "Failed to delete property" });
  }
});

// GET /admin/users
app.get("/admin/users", authenticate, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = getDB();
    const users = await db
      .collection("user")
      .find({}, { projection: { id: 1, name: 1, email: 1, role: 1, createdAt: 1 } })
      .toArray();

    res.json({ success: true, data: users });
  } catch (error) {
    console.error("GET /admin/users error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/", (_req: Request, res: Response) => {
  res.json({ success: true, message: "StayNest API is running" });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
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