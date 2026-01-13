import mongoose from "mongoose";
import Bid from "../models/bid.js";
import Gig from "../models/gig.js";

/*
|--------------------------------------------------------------------------
| APPLY / BID ON A GIG
|--------------------------------------------------------------------------
| Freelancer applies to an open gig
*/
export const createBid = async (req, res) => {
  try {
    const { gigId, message, price } = req.body;

    if (!gigId || !message || !price) {
      return res.status(400).json({ message: "All fields required" });
    }

    const gig = await Gig.findById(gigId);
    if (!gig || gig.status !== "open") {
      return res.status(400).json({ message: "Gig not available" });
    }

    // Prevent owner from bidding on own gig
    if (gig.ownerId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot bid on your own gig" });
    }

    // Prevent duplicate bids
    const existingBid = await Bid.findOne({
      gigId,
      freelancerId: req.user._id
    });

    if (existingBid) {
      return res.status(400).json({ message: "Already bid on this gig" });
    }

    const bid = await Bid.create({
      gigId,
      freelancerId: req.user._id,
      message,
      price
    });

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
      return res.status(403).json({ message: "Access denied" });
    }

    const bids = await Bid.find({ gigId }).populate(
      "freelancerId",
      "name email"
    );

    res.json(bids);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      return res.status(403).json({ message: "Access denied" });
    }

    // Prevent double hiring
    if (gig.status === "assigned") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Gig already assigned" });
    }

    // 1️⃣ Assign gig
gig.status = "assigned";
gig.hiredFreelancerId = bid.freelancerId; // ✅ THIS LINE
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

    res.json({ message: "Freelancer hired successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};
