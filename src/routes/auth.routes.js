import express from "express";
import {
  register,
  login,
  googleAuth,
  logout
} from "../controllers/auth.controller.js";
import protect from "../middleware/auth.middleware.js";

const router = express.Router();

/* ── Auth ── */
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/logout", logout);

/* Restore logged-in user (IMPORTANT) */
router.get("/me", protect, (req, res) => {
  res.json({ user: req.user });
});

export default router;
