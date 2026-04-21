import mongoose from "mongoose";

const userDetailsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      unique: true,
    },
    dob: {
      type: Date,
      required: [true, "Date of birth is required"],
      default: null,
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["Male", "Female"],
      trim: true,
    },
    currentStatus: {
      type: String,
      required: [true, "Current status is required"],
      enum: ["Student", "Employee", "Unemployed", "Professor / Mentor"],
      trim: true,
    },
    education: {
      type: String,
      required: [true, "Education is required"],
      enum: ["UG", "PG"],
      trim: true,
    },
    ugDegree: {
      type: String,
      trim: true,
      default: null,
    },
    ugFieldOfStudy: {
      type: String,
      trim: true,
      default: null,
    },
    ugYear: {
      type: Number,
      default: null,
    },
    pgDegree: {
      type: String,
      trim: true,
      default: null,
    },
    pgFieldOfStudy: {
      type: String,
      trim: true,
      default: null,
    },
    pgYear: {
      type: Number,
      default: null,
    },
    companyName: {
      type: String,
      trim: true,
      default: null,
    },
    jobTitle: {
      type: String,
      trim: true,
      default: null,
    },
    yearOfExperience: {
      type: Number,
      default: null,
    },
    hearAboutUs: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true
    },
    others: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


const UserDetails =
  mongoose.models.UserDetails ||
  mongoose.model("UserDetails", userDetailsSchema);

export default UserDetails;
