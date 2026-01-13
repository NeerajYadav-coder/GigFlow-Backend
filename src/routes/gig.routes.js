import express from "express";
import protect from "../middleware/auth.middleware.js";
import {
  createGig,
  getGigs,
  getGigById
} from "../controllers/gig.controller.js";

const router = express.Router();

// Public
router.get("/", getGigs);
router.get("/:id", getGigById); // ✅ REQUIRED

// Protected
router.post("/", protect, createGig);

export default router;
