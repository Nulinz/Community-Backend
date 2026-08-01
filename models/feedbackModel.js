import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    category: {
      type: String,
      default: "General",
      enum: ["General", "Event", "College", "App Feedback", "Bug Report"],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    message: {
      type: String,
      required: [true, "Feedback message is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Feedback = mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);
export default Feedback;
