import express from "express";
import protect from "../middleware/auth.middleware.js";
import { aiRecommendBidders } from "../controllers/ai.controller.js";

const router = express.Router();

// POST /api/ai/recommend/:gigId — owner only, returns top-2 AI analysis
router.post("/recommend/:gigId", protect, aiRecommendBidders);

export default router;
