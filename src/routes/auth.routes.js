import express from "express";
import {
  register,
  login,
  logout
} from "../controllers/auth.controller.js";
import protect from "../middleware/auth.middleware.js";

import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

/* ── Auth ── */
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

/* Restore logged-in user (IMPORTANT) */
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.json({ user: null });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.json({ user: null });
    }
    res.json({ user });
  } catch (error) {
    res.json({ user: null });
  }
});

export default router;
