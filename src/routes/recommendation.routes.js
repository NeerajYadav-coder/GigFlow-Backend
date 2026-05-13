import express from "express";
import protect from "../middleware/auth.middleware.js";
import { getRecommendations } from "../controllers/recommendation.controller.js";

const router = express.Router();

// GET /api/recommendations - Get personalized gig matches
router.get("/", protect, getRecommendations);

export default router;
