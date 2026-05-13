import express from "express";
import protect from "../middleware/auth.middleware.js";
import {
  createGig,
  getGigs,
  getGigById,
  deleteGig,
  getCategories,
  getMyGigs,
  completeGig
} from "../controllers/gig.controller.js";

const router = express.Router();

// Public
router.get("/", getGigs);
router.get("/categories", getCategories);
router.get("/:id", getGigById);

// Protected
router.post("/", protect, createGig);
router.get("/my/list", protect, getMyGigs);
router.patch("/:id/complete", protect, completeGig);
router.delete("/:id", protect, deleteGig);

export default router;
