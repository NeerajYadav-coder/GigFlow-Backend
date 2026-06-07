import User from "../models/User.js";
import jwt from "jsonwebtoken";

/* Generate JWT */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/* REGISTER */
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (!["client", "freelancer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ name, email, password, role });

    const token = generateToken(user._id);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Return the full user object so the frontend AuthContext is complete
    const fullUser = await User.findById(user._id).select("-password");
    res.status(201).json({
      message: "User registered successfully",
      user: fullUser
    });
  } catch (error) {
    const isValidationError = error.name === "ValidationError" || error.code === 11000;
    const statusCode = isValidationError ? 400 : 500;
    const message = error.code === 11000 
      ? "Email address already registered" 
      : (error.name === "ValidationError" ? Object.values(error.errors)[0].message : error.message);
    res.status(statusCode).json({ message });
  }
};

/* LOGIN */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Return the full user object so the frontend AuthContext is complete
    const fullUser = await User.findById(user._id).select("-password");
    res.json({
      message: "Login successful",
      user: fullUser
    });
  } catch (error) {
    const isValidationError = error.name === "ValidationError";
    const statusCode = isValidationError ? 400 : 500;
    res.status(statusCode).json({ message: isValidationError ? Object.values(error.errors)[0].message : error.message });
  }
};

/* LOGOUT ✅ (THIS WAS MISSING) */
export const logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    expires: new Date(0)
  });

  res.json({ message: "Logged out successfully" });
};
