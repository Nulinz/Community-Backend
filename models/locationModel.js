import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

locationSchema.index({ state: 1, city: 1 }, { unique: true });

const Location =
  mongoose.models.Location || mongoose.model("Location", locationSchema);

export default Location;