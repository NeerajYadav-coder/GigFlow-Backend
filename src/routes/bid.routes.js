import express from "express";
import protect from "../middleware/auth.middleware.js";
import {
  createBid,
  getBidsForGig,
  hireBid
} from "../controllers/bid.controller.js";

const router = express.Router();

router.post("/", protect, createBid);
router.get("/:gigId", protect, getBidsForGig);
router.patch("/:bidId/hire", protect, hireBid);

export default router;
