import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";


/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const setTokenCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
};

/* ────────────────────────────────────────────────────────
   REGISTER  — create user, issue JWT cookie, return user
   ──────────────────────────────────────────────────────── */
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // ── Validate required fields ──
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!["client", "freelancer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'client' or 'freelancer'" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // ── Check if email already exists ──
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      if (existingUser.authProvider === "google") {
        return res.status(400).json({
          message: "This email is linked to a Google account. Please sign in with Google."
        });
      }
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    // ── Create new user (automatically verified) ──
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      authProvider: "local",
      isVerified: true
    });

    // ── Issue JWT ──
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    const fullUser = await User.findById(user._id).select("-password");
    res.status(201).json({
      message: "Account created successfully",
      user: sanitizeUser(fullUser)
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



/* ────────────────────────────────────────────────────────
   LOGIN — only allow verified local users
   ──────────────────────────────────────────────────────── */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Google-only user trying to log in with password
    if (user.authProvider === "google" && !user.password) {
      return res.status(400).json({
        message: "This account uses Google sign-in. Please continue with Google."
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user._id);
    setTokenCookie(res, token);

    // Return the full user object so the frontend AuthContext is complete
    const fullUser = await User.findById(user._id).select("-password");
    res.json({
      message: "Login successful",
      user: sanitizeUser(fullUser)
    });
  } catch (error) {
    const isValidationError = error.name === "ValidationError";
    const statusCode = isValidationError ? 400 : 500;
    res.status(statusCode).json({
      message: isValidationError
        ? Object.values(error.errors)[0].message
        : error.message
    });
  }
};

/* ────────────────────────────────────────────────────────
   GOOGLE AUTH — verify Google ID token, find/create user
   ──────────────────────────────────────────────────────── */
export const googleAuth = async (req, res) => {
  try {
    const { credential, role } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    // ── Verify token with Google ──
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ message: "Google authentication is not configured" });
    }

    const client = new OAuth2Client(clientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId
      });
    } catch (verifyErr) {
      console.error("Google token verification failed:", verifyErr.message);
      return res.status(401).json({ message: "Invalid Google credential. Please try again." });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: "Google email is not verified" });
    }

    // ── Find or create user ──
    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }]
    });

    if (user) {
      // User exists — link Google if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = user.authProvider === "local" ? "local" : "google";
      }
      // Ensure verified for Google users
      if (!user.isVerified) {
        user.isVerified = true;
      }
      // Update avatar if empty
      if (!user.avatar && picture) {
        user.avatar = picture;
      }
      await user.save();
    } else {
      // New user — role is required for first-time Google signup
      if (!role) {
        return res.status(200).json({
          needsRole: true,
          tempUser: { name, email, picture }
        });
      }

      const userRole = role;
      if (!["client", "freelancer"].includes(userRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        authProvider: "google",
        role: userRole,
        avatar: picture || "",
        isVerified: true // Google-verified emails need no OTP
      });
    }

    // ── Issue JWT ──
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    const fullUser = await User.findById(user._id).select("-password");
    res.status(200).json({
      message: user.createdAt.getTime() === user.updatedAt.getTime()
        ? "Account created successfully"
        : "Login successful",
      user: sanitizeUser(fullUser),
      isNewUser: user.createdAt.getTime() === user.updatedAt.getTime()
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Google authentication failed. Please try again." });
  }
};

/* ────────────────────────────────────────────────────────
   LOGOUT
   ──────────────────────────────────────────────────────── */
export const logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    expires: new Date(0)
  });

  res.json({ message: "Logged out successfully" });
};
