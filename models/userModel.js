import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    // 🔹 BASIC INFO
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    // 🔹 ROLE / TYPE
    role: {
      type: String,
      enum: ["user", "admin", "college", "company", "influencer"],
      default: "user",
    },
    // 🔹 DEVICE INFO
    device_type: {
      type: String,
      default: null,
    },

    fcm_token: {
      type: String,
      default: null,
      alias: "fcmToken",
    },

    // 🔹 AUTH
    password: {
      type: String,
      default: null,
    },

    // 🔹 OTP (LOGIN / REGISTER)
    otp: {
      type: String,
      default: null,
    },

    otp_expire: {
      type: Date,
      default: null,
    },

    otp_verified: {
      type: Boolean,
      default: false,
    },

    // 🔹 FORGOT PASSWORD FLOW
    forgot_otp: {
      type: String,
      default: null,
    },

    forgot_otp_expire: {
      type: Date,
      default: null,
    },

    forgot_status: {
      type: String,
      enum: ["otp_pending", "otp_verified", "completed"],
      default: "otp_pending",
    },

    // 🔹 REGISTRATION STATE
    register_status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },

    // 🔹 ACCOUNT FLAGS
    is_active: {
      type: Boolean,
      default: false,
    },

    is_pending: {
      type: Boolean,
      default: true,
    },

    deactivation_reason: {
      type: String,
      default: null,
      trim: true,
    },

    deactivated_at: {
      type: Date,
      default: null,
    },

    last_login: {
      type: Date,
      default: null,
    },

    // 🔹 GAMIFICATION / XP SYSTEM
    xp: {
      type: Number,
      default: 0,
      index: true,
    },

    level: {
      type: Number,
      default: 1,
    },

    // 🔹 DAILY ACTIVE TIME TRACKING
    dailyActiveMinutes: {
      type: Number,
      default: 0,
    },

    lastActiveDate: {
      type: Date,
      default: Date.now,
    },

    lastAiStationDate: {
      type: Date,
      default: null,
    },

    lastJobsViewDate: {
      type: Date,
      default: null,
    },

    // 🔹 REFERRAL SYSTEM
    referralCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // 🔹 INFLUENCER SYSTEM
    influencerCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    influencerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // 🔹 PROFILE PHOTO & SOCIAL LINKS
    profileImage: {
      type: String,
      default: null,
    },
    instagram: { type: String, default: "" },
    youtube: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    twitter: { type: String, default: "" },

    // 🔹 SUBSCRIPTION / PLAN INFO
    subscription: {
      planName: { type: String, default: "Free" },
      isPlanActive: { type: Boolean, default: false },
      startDate: { type: Date, default: null },
      expiryDate: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique non-null string indexes for referral and influencer codes
userSchema.index(
  { referralCode: 1 },
  {
    unique: true,
    partialFilterExpression: { referralCode: { $type: "string" } },
  }
);

userSchema.index(
  { influencerCode: 1 },
  {
    unique: true,
    partialFilterExpression: { influencerCode: { $type: "string" } },
  }
);

// 🔐 HASH PASSWORD BEFORE SAVE
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  next();
});


// 🔐 COMPARE PASSWORD
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};


// ✅ MODEL EXPORT
const User = mongoose.models.User || mongoose.model("User", userSchema);

/**
 * Synchronizes User collection indexes with the schema and safely drops
 * any stale, non-sparse/conflicting unique indexes that block new user registrations.
 */
export const syncUserIndexes = async () => {
  try {
    const indexes = await User.collection.indexes();
    for (const index of indexes) {
      if (index.name !== "_id_" && index.name !== "email_1" && index.name !== "phone_1") {
        if (
          index.name === "referralCode_1" ||
          index.name === "influencerCode_1" ||
          (index.unique && !index.partialFilterExpression)
        ) {
          console.log(`[User] Dropping stale/colliding index: ${index.name}`);
          try {
            await User.collection.dropIndex(index.name);
          } catch (e) {
            console.warn(`[User] Could not drop index ${index.name}:`, e.message);
          }
        }
      }
    }
    await User.syncIndexes();
    console.log("✅ User indexes synchronized successfully");
  } catch (err) {
    console.warn("[User] syncUserIndexes notice:", err.message);
  }
};

export default User;