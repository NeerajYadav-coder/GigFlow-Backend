import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please fill a valid email address"]
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"]
    },
    role: {
      type: String,
      enum: ["client", "freelancer"],
      required: true
    },
    // Profile fields
    bio: {
      type: String,
      default: "",
      maxlength: 500
    },
    skills: {
      type: [String],
      default: []
    },
    avatar: {
      type: String, // URL or initials fallback
      default: ""
    },
    location: {
      type: String,
      default: ""
    },
    // Stats (denormalized for performance)
    totalGigsPosted: {
      type: Number,
      default: 0
    },
    totalBidsPlaced: {
      type: Number,
      default: 0
    },
    totalHires: {
      type: Number,
      default: 0
    },
    // Preferences for SmartMatch
    preferredCategory: {
      type: String,
      default: "Other"
    },
    preferredMinBudget: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// hash password
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// compare password
userSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
