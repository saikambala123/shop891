// ──────────────────────────────────────────────────────────────
// ShopVerse — MongoDB connection + Mongoose models
// Single cached connection (safe for serverless / Vercel), with
// schemas that mirror the API contract in src/lib/types.ts.
// ──────────────────────────────────────────────────────────────
import mongoose, { Schema, Types } from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/shopverse";

// ── Connection (cached across requests / hot reloads) ────────

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  _shopverseMongoose?: MongooseCache;
};
const cached: MongooseCache =
  globalForMongoose._shopverseMongoose ?? { conn: null, promise: null };
globalForMongoose._shopverseMongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      bufferCommands: false,
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow a retry on the next request
    console.error(
      "[db] MongoDB connection failed:",
      err instanceof Error ? err.message : err
    );
    throw err;
  }
  return cached.conn;
}

// ── Document interfaces ───────────────────────────────────────

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: "USER" | "ADMIN";
  phone?: string | null;
  /** Address saved at checkout for faster re-ordering (legacy single slot). */
  savedAddress?: ISavedAddress | null;
  /** Address book — multiple saved addresses managed from the profile. */
  addresses?: ISavedAddressDoc[];
  /** Forgot-password one-time code (bcrypt hash) + expiry. */
  resetOtpHash?: string | null;
  resetOtpExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISavedAddress {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/** A stored address-book entry (extends the shipping shape with an
 *  id, an optional label like “Home” / “Office” and a default flag). */
export interface ISavedAddressDoc extends ISavedAddress {
  _id: Types.ObjectId;
  label: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface IProductSpec {
  name: string;
  value: string;
}

export interface IProduct {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  compareAtPrice?: number | null;
  images: string[];
  highlights: string[];
  specs: IProductSpec[];
  tags: string[];
  stock: number;
  isDigital: boolean;
  isActive: boolean;
  placements: string[];
  rating: number;
  reviewCount: number;
  soldCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICartItem {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  product: Types.ObjectId;
  quantity: number;
  createdAt: Date;
}

export interface IOrderItem {
  _id: Types.ObjectId;
  product?: Types.ObjectId | null;
  name: string;
  image: string;
  price: number;
  quantity: number;
  isDigital: boolean;
  licenseKey?: string | null;
}

export interface IOrder {
  _id: Types.ObjectId;
  orderNumber: string;
  user: Types.ObjectId;
  status:
    | "PENDING"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
    | "RETURN_REQUESTED"
    | "RETURNED";
  paymentMethod: "COD" | "CARD" | "UPI";
  /** PENDING → PAID → (REFUND_PENDING → REFUNDED | back to PAID when declined). */
  paymentStatus:
    | "PENDING"
    | "PAID"
    | "REFUND_PENDING"
    | "REFUNDED";
  subtotal: number;
  shippingFee: number;
  tax: number;
  /** Coupon discount (₹) applied at checkout. */
  discount: number;
  /** Coupon code redeemed on this order. */
  couponCode?: string | null;
  total: number;
  shippingName?: string | null;
  shippingPhone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  trackingNumber?: string | null;
  /** Who cancelled this order and why (null until cancelled). */
  cancelInfo?: {
    reason: string;
    comment?: string | null;
    by: "USER" | "ADMIN";
    at: Date;
  } | null;
  /** Cancellation refund lifecycle — refunds are never automatic:
   *  a paid order that gets cancelled moves to REFUND_PENDING and an
   *  admin must explicitly approve (→ REFUNDED) or decline it. */
  refundInfo?: {
    amount: number;
    origin: "USER_CANCEL" | "ADMIN_CANCEL";
    status: "PENDING" | "APPROVED" | "DECLINED";
    requestedAt: Date;
    resolvedAt?: Date | null;
    adminNote?: string | null;
  } | null;
  /** Return / refund request lifecycle (null until requested). */
  returnInfo?: {
    reason: string;
    comment?: string | null;
    status: "REQUESTED" | "APPROVED" | "REJECTED";
    refundAmount: number;
    requestedAt: Date;
    resolvedAt?: Date | null;
    adminNote?: string | null;
  } | null;
  items: IOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IReview {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  user: Types.ObjectId;
  rating: number;
  title?: string | null;
  comment: string;
  createdAt: Date;
}

export interface IWishlistItem {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  product: Types.ObjectId;
  createdAt: Date;
}

export interface ICoupon {
  _id: Types.ObjectId;
  code: string;
  description: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  expiresAt?: Date | null;
  isActive: boolean;
  /** Valid only on a customer's first completed order (e.g. WELCOME10). */
  firstOrderOnly?: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUpload {
  _id: Types.ObjectId;
  data: Buffer;
  contentType: string;
  createdAt: Date;
}

export type NotificationKind =
  | "placed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "welcome"
  | "return"
  | "refund";

export interface INotification {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  kind: NotificationKind;
  title: string;
  body: string;
  amount?: number | null;
  orderNumber?: string | null;
  read: boolean;
  createdAt: Date;
}

// ── Schemas ───────────────────────────────────────────────────

const AddressFieldsSchema = {
  fullName: { type: String, default: "" },
  phone: { type: String, default: "" },
  street: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  zipCode: { type: String, default: "" },
  country: { type: String, default: "India" },
};

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
    phone: { type: String, default: null },
    // Forgot-password one-time code (bcrypt hash) + expiry.
    resetOtpHash: { type: String, default: null },
    resetOtpExpires: { type: Date, default: null },
    savedAddress: {
      type: new Schema(AddressFieldsSchema, { _id: false }),
      default: null,
    },
    // Address book — multiple saved addresses managed from the
    // profile page and picked at checkout.
    addresses: {
      type: [
        new Schema(
          {
            ...AddressFieldsSchema,
            label: { type: String, default: "Home" },
            isDefault: { type: Boolean, default: false },
          },
          { timestamps: { createdAt: true, updatedAt: false } }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const ProductSpecSchema = new Schema<IProductSpec>(
  { name: { type: String, required: true }, value: { type: String, required: true } },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true },
    brand: { type: String, required: true },
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: null },
    images: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
    specs: { type: [ProductSpecSchema], default: [] },
    tags: { type: [String], default: [] },
    stock: { type: Number, default: 0 },
    isDigital: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    placements: { type: [String], default: [], index: true },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const CartItemSchema = new Schema<ICartItem>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
CartItemSchema.index({ user: 1, product: 1 }, { unique: true });

const OrderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    name: { type: String, required: true },
    image: { type: String, default: "" },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    isDigital: { type: Boolean, default: false },
    licenseKey: { type: String, default: null },
  },
  { _id: true }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "RETURN_REQUESTED",
        "RETURNED",
      ],
      default: "PENDING",
      index: true,
    },
    paymentMethod: { type: String, enum: ["COD", "CARD", "UPI"], required: true },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "REFUND_PENDING", "REFUNDED"],
      default: "PENDING",
    },
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    tax: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: null },
    total: { type: Number, required: true },
    shippingName: { type: String, default: null },
    shippingPhone: { type: String, default: null },
    addressLine: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    zipCode: { type: String, default: null },
    country: { type: String, default: null },
    trackingNumber: { type: String, default: null },
    cancelInfo: {
      type: new Schema(
        {
          reason: { type: String, required: true },
          comment: { type: String, default: null },
          by: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
          at: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
      default: null,
    },
    refundInfo: {
      type: new Schema(
        {
          amount: { type: Number, default: 0 },
          origin: {
            type: String,
            enum: ["USER_CANCEL", "ADMIN_CANCEL"],
            default: "USER_CANCEL",
          },
          status: {
            type: String,
            enum: ["PENDING", "APPROVED", "DECLINED"],
            default: "PENDING",
          },
          requestedAt: { type: Date, default: Date.now },
          resolvedAt: { type: Date, default: null },
          adminNote: { type: String, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    returnInfo: {
      type: new Schema(
        {
          reason: { type: String, required: true },
          comment: { type: String, default: null },
          status: {
            type: String,
            enum: ["REQUESTED", "APPROVED", "REJECTED"],
            default: "REQUESTED",
          },
          refundAmount: { type: Number, default: 0 },
          requestedAt: { type: Date, default: Date.now },
          resolvedAt: { type: Date, default: null },
          adminNote: { type: String, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    items: { type: [OrderItemSchema], default: [] },
  },
  { timestamps: true }
);

const ReviewSchema = new Schema<IReview>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: null },
    comment: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

const WishlistItemSchema = new Schema<IWishlistItem>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
WishlistItemSchema.index({ user: 1, product: 1 }, { unique: true });

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, default: "" },
    type: { type: String, enum: ["PERCENT", "FIXED"], default: "PERCENT" },
    value: { type: Number, required: true },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscountAmount: { type: Number, default: null },
    expiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    firstOrderOnly: { type: Boolean, default: false },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const UploadSchema = new Schema<IUpload>(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: {
      type: String,
      enum: [
        "placed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "welcome",
        "return",
        "refund",
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    amount: { type: Number, default: null },
    orderNumber: { type: String, default: null },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
NotificationSchema.index({ user: 1, createdAt: -1 });

// ── Models (hot-reload safe) ──────────────────────────────────

export const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

export const Product =
  (mongoose.models.Product as mongoose.Model<IProduct>) ||
  mongoose.model<IProduct>("Product", ProductSchema);

export const CartItem =
  (mongoose.models.CartItem as mongoose.Model<ICartItem>) ||
  mongoose.model<ICartItem>("CartItem", CartItemSchema);

export const Order =
  (mongoose.models.Order as mongoose.Model<IOrder>) ||
  mongoose.model<IOrder>("Order", OrderSchema);

export const Review =
  (mongoose.models.Review as mongoose.Model<IReview>) ||
  mongoose.model<IReview>("Review", ReviewSchema);

export const WishlistItem =
  (mongoose.models.WishlistItem as mongoose.Model<IWishlistItem>) ||
  mongoose.model<IWishlistItem>("WishlistItem", WishlistItemSchema);

export const Coupon =
  (mongoose.models.Coupon as mongoose.Model<ICoupon>) ||
  mongoose.model<ICoupon>("Coupon", CouponSchema);

export const Upload =
  (mongoose.models.Upload as mongoose.Model<IUpload>) ||
  mongoose.model<IUpload>("Upload", UploadSchema);

export const Notification =
  (mongoose.models.Notification as mongoose.Model<INotification>) ||
  mongoose.model<INotification>("Notification", NotificationSchema);

// ── ObjectId helpers ──────────────────────────────────────────

/** Parse a string into an ObjectId, or null when it is not a valid id. */
export function oid(v: string | undefined | null): Types.ObjectId | null {
  if (!v) return null;
  try {
    return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
  } catch {
    return null;
  }
}

/** String form of an ObjectId-ish value (populated doc or raw id). */
export function idOf(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v instanceof Types.ObjectId) return v.toHexString();
  if (typeof v === "object" && "_id" in (v as Record<string, unknown>)) {
    return idOf((v as { _id: unknown })._id);
  }
  return String(v);
}
