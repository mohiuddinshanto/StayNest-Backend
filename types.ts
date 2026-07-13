import { ObjectId } from "mongodb";
import { Request } from "express";

// ─── Domain Types ────────────────────────────────────────────────────────────

export type PropertyType = "apartment" | "house" | "villa" | "studio" | "loft" | "cabin";
export type PropertyStatus = "available" | "rented" | "pending";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "host" | "owner" | "admin";
export type InquiryType = "message" | "schedule_viewing";
export type InquiryStatus = "unread" | "read";

// ─── MongoDB Document Types ───────────────────────────────────────────────────

export interface UserDoc {
  _id: ObjectId;
  id?: string; // better-auth may store a string id
  name: string;
  email: string;
  image?: string;
  phone?: string;
  role: UserRole;
  createdAt?: string;
}

export interface SessionDoc {
  _id: ObjectId;
  token: string;
  userId: string;
  expiresAt: string | Date;
}

export interface PropertyDoc {
  _id: ObjectId;
  title: string;
  shortDescription: string;
  fullDescription: string;
  rent: number;
  type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  area: number;
  city: string;
  address: string;
  images: string[];
  amenities: string[];
  rating: number;
  reviewCount: number;
  ownerId: string | ObjectId;
  ownerName: string;
  ownerImage?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  available?: string;
  status: PropertyStatus;
  featured: boolean;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  createdAt: string;
}

export interface ReviewDoc {
  _id: ObjectId;
  propertyId: ObjectId;
  userName: string;
  userImage?: string;
  rating: number;
  comment: string;
  date: string;
  createdAt: string;
}

export interface InquiryDoc {
  _id: ObjectId;
  propertyId: ObjectId;
  propertyTitle: string;
  ownerId: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  type: InquiryType;
  message: string;
  preferredDate?: string | null;
  status: InquiryStatus;
  createdAt: string;
}

// ─── Formatted (API Response) Types ──────────────────────────────────────────

export interface FormattedProperty {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  rent: number;
  type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  area: number;
  city: string;
  address: string;
  images: string[];
  amenities: string[];
  rating: number;
  reviewCount: number;
  ownerId?: string;
  ownerName: string;
  ownerImage?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  available?: string;
  status: PropertyStatus;
  featured: boolean;
  approvalStatus: ApprovalStatus;
  rejectionReason: string;
  createdAt: string;
  reviews?: FormattedReview[];
}

export interface FormattedReview {
  id: string;
  propertyId: string;
  userName: string;
  userImage?: string;
  rating: number;
  comment: string;
  date: string;
}

export interface FormattedInquiry {
  id: string;
  propertyId: string;
  propertyTitle: string;
  ownerId?: string;
  senderId?: string;
  senderName: string;
  senderEmail: string;
  type: InquiryType;
  message: string;
  preferredDate: string | null;
  status: InquiryStatus;
  createdAt: string;
}

// ─── Auth & Request Extensions ────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}

export interface OptionalAuthRequest extends Request {
  user: AuthUser | null;
}

// ─── Request Body Types ───────────────────────────────────────────────────────

export interface CreatePropertyBody {
  title: string;
  shortDescription: string;
  fullDescription?: string;
  rent: number | string;
  type?: PropertyType;
  bedrooms?: number | string;
  bathrooms?: number | string;
  area?: number | string;
  city: string;
  address: string;
  images?: string[];
  amenities?: string[];
  available?: string;
  status?: PropertyStatus;
  featured?: boolean;
  ownerPhone?: string;
}

export interface UpdatePropertyBody extends CreatePropertyBody {}

export interface CreateReviewBody {
  propertyId: string;
  rating: number | string;
  comment: string;
  date?: string;
}

export interface CreateInquiryBody {
  propertyId: string;
  type: InquiryType;
  message: string;
  preferredDate?: string;
}

export interface UpdateApprovalStatusBody {
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
}