import express from "express";
import protect from "../middleware/auth.middleware.js";
import {
  createBid,
  getBidsForGig,
  getMyBids,
  hireBid,
  withdrawBid
} from "../controllers/bid.controller.js";

const router = express.Router();

router.post("/", protect, createBid);
router.get("/my-bids", protect, getMyBids);
router.get("/:gigId", protect, getBidsForGig);
router.patch("/:bidId/hire", protect, hireBid);
router.delete("/:bidId/withdraw", protect, withdrawBid);

export default router;
