import bcrypt from "bcrypt";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
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
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },

    isActive:{
        type:Boolean,
        default:true
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
    }
  },
  {
    timestamps: true,
  }
);


// hashpassword
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  next();
});


// comparepassword
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};



const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
