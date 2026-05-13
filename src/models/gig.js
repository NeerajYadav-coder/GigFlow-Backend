import mongoose from "mongoose";

const GIG_CATEGORIES = [
  "Web Development",
  "Mobile Development",
  "UI/UX Design",
  "Graphic Design",
  "Content Writing",
  "Digital Marketing",
  "Video & Animation",
  "Data Science & AI",
  "DevOps & Cloud",
  "Cybersecurity",
  "Database",
  "Other"
];

const gigSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    budget: {
      type: Number,
      required: true
    },
    category: {
      type: String,
      enum: GIG_CATEGORIES,
      default: "Other"
    },
    tags: {
      type: [String],
      default: []
    },
    deadline: {
      type: Date,
      default: null
    },
    skillsRequired: {
      type: [String],
      default: []
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["open", "assigned", "completed"],
      default: "open"
    },
    hiredFreelancerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    bidCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Index for search performance
gigSchema.index({ title: "text", description: "text", tags: "text" });
gigSchema.index({ category: 1, status: 1 });
gigSchema.index({ createdAt: -1 });

export { GIG_CATEGORIES };
export default mongoose.model("Gig", gigSchema);
