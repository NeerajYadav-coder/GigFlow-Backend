import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gig",
      required: true
    },
    freelancerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    message: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    deliveryDays: {
      type: Number,
      default: null // estimated delivery in days
    },
    status: {
      type: String,
      enum: ["pending", "hired", "rejected"],
      default: "pending"
    }
  },
  { timestamps: true }
);

bidSchema.index({ gigId: 1, freelancerId: 1 }, { unique: true });
bidSchema.index({ freelancerId: 1, status: 1 });

export default mongoose.model("Bid", bidSchema);
