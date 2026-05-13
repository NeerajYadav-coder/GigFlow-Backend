import mongoose from "mongoose";
import Bid from "../models/bid.js";
import Gig from "../models/gig.js";
import User from "../models/User.js";

/*
|--------------------------------------------------------------------------
| APPLY / BID ON A GIG
|--------------------------------------------------------------------------
| Freelancer applies to an open gig
*/
export const createBid = async (req, res) => {
  try {
    const { gigId, message, price, deliveryDays } = req.body;

    if (!gigId || !message || !price) {
      return res.status(400).json({ message: "Gig ID, message, and price are required" });
    }

    const gig = await Gig.findById(gigId);
    if (!gig || gig.status !== "open") {
      return res.status(400).json({ message: "Gig not available for bidding" });
    }

    // Prevent owner from bidding on own gig
    if (gig.ownerId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot bid on your own gig" });
    }

    // Prevent duplicate bids
    const existingBid = await Bid.findOne({
      gigId,
      freelancerId: req.user._id
    });

    if (existingBid) {
      return res.status(400).json({ message: "You have already placed a bid on this gig" });
    }

    const bid = await Bid.create({
      gigId,
      freelancerId: req.user._id,
      message,
      price,
      deliveryDays: deliveryDays || null
    });

    // Increment bid count on gig and stats on user
    await Gig.findByIdAndUpdate(gigId, { $inc: { bidCount: 1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalBidsPlaced: 1 } });

    res.status(201).json(bid);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| VIEW BIDS FOR A GIG (OWNER ONLY)
|--------------------------------------------------------------------------
| Client sees all bids on their gig
*/
export const getBidsForGig = async (req, res) => {
  try {
    const { gigId } = req.params;

    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    // Only owner can view bids
    if (gig.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied — only the gig owner can view bids" });
    }

    const bids = await Bid.find({ gigId })
      .populate("freelancerId", "name email avatar bio skills location totalHires")
      .sort({ createdAt: -1 });

    res.json(bids);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET MY BIDS (FREELANCER)
|--------------------------------------------------------------------------
| Freelancer sees all their own bids with gig details
*/
export const getMyBids = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const bids = await Bid.find({ freelancerId: req.user._id })
      .populate({
        path: "gigId",
        model: "Gig",
        select: "title budget status category deadline ownerId"
      })
      .sort({ createdAt: -1 })
      .lean();

    res.json(bids);
  } catch (error) {
    console.error("🔥 Error in getMyBids:", error);
    res.status(500).json({ message: "Failed to fetch bids: " + error.message });
  }
};

/*
|--------------------------------------------------------------------------
| HIRE A BID (CRUCIAL LOGIC)
|--------------------------------------------------------------------------
| Client hires one freelancer
| - Gig → assigned
| - One bid → hired
| - Other bids → rejected
| - Uses MongoDB transaction (atomic)
*/
export const hireBid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bidId } = req.params;

    const bid = await Bid.findById(bidId).session(session);
    if (!bid) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Bid not found" });
    }

    const gig = await Gig.findById(bid.gigId).session(session);
    if (!gig) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Gig not found" });
    }

    // Only gig owner can hire
    if (gig.ownerId.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Access denied — you are not the gig owner" });
    }

    // Prevent double hiring
    if (gig.status === "assigned") {
      await session.abortTransaction();
      return res.status(400).json({ message: "A freelancer has already been hired for this gig" });
    }

    // 1️⃣ Assign gig
    gig.status = "assigned";
    gig.hiredFreelancerId = bid.freelancerId;
    await gig.save({ session });

    // 2️⃣ Hire selected bid
    bid.status = "hired";
    await bid.save({ session });

    // 3️⃣ Reject all other bids
    await Bid.updateMany(
      { gigId: gig._id, _id: { $ne: bid._id } },
      { status: "rejected" },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Freelancer hired successfully!", bid, gig });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

/*
|--------------------------------------------------------------------------
| WITHDRAW A BID (FREELANCER)
|--------------------------------------------------------------------------
| Freelancer can withdraw a pending bid
*/
export const withdrawBid = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    if (bid.freelancerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (bid.status !== "pending") {
      return res.status(400).json({ message: "Only pending bids can be withdrawn" });
    }

    await bid.deleteOne();
    await Gig.findByIdAndUpdate(bid.gigId, { $inc: { bidCount: -1 } });

    res.json({ message: "Bid withdrawn successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
