import bcrypt from "bcrypt";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    role:{
      type:String,
      enum:["user","admin","college","company"],
      default:"user"
    },
    password: {
      type: String,
      default:null
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },


    otp: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    otpStatus: {
      type: String,
      default: null,
    },
    fcmToken:{
        type:String,
        default:null
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);


// hashpassword
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  next();
});


// comparepassword
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};



const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
