import Gig from "../models/gig.js";
import User from "../models/User.js";
import { GIG_CATEGORIES } from "../models/gig.js";

// GET ALL GIGS (with search, category filter, pagination)
export const getGigs = async (req, res) => {
  try {
    const { search, category, status = "open", page = 1, limit = 12 } = req.query;

    let query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (category && category !== "all") {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Gig.countDocuments(query);

    const gigs = await Gig.find(query)
      .populate("ownerId", "name email avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      gigs,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET SINGLE GIG BY ID
export const getGigById = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id).populate(
      "ownerId",
      "name email avatar bio location"
    ).populate("hiredFreelancerId", "name email avatar");

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    res.json(gig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE GIG (clients only)
export const createGig = async (req, res) => {
  try {
    const { title, description, budget, category, tags, deadline, skillsRequired } = req.body;

    if (!title || !description || !budget) {
      return res.status(400).json({ message: "Title, description and budget are required" });
    }

    const gig = await Gig.create({
      title,
      description,
      budget,
      category: category || "Other",
      tags: tags || [],
      deadline: deadline || null,
      skillsRequired: skillsRequired || [],
      ownerId: req.user._id
    });

    // Increment stats
    await User.findByIdAndUpdate(req.user._id, { $inc: { totalGigsPosted: 1 } });

    res.status(201).json(gig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE GIG (owner only)
export const deleteGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    if (gig.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (gig.status === "assigned") {
      return res.status(400).json({ message: "Cannot delete an assigned gig" });
    }

    await gig.deleteOne();
    res.json({ message: "Gig deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET CATEGORIES
export const getCategories = async (req, res) => {
  res.json({ categories: GIG_CATEGORIES });
};

// GET CLIENT'S OWN GIGS
export const getMyGigs = async (req, res) => {
  try {
    const gigs = await Gig.find({ ownerId: req.user._id })
      .populate("hiredFreelancerId", "name email avatar")
      .sort({ createdAt: -1 });
    res.json(gigs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// MARK GIG AS COMPLETED
export const completeGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return res.status(404).json({ message: "Gig not found" });

    if (gig.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (gig.status !== "assigned") {
      return res.status(400).json({ message: "Gig must be assigned before completing" });
    }

    gig.status = "completed";
    await gig.save();

    // Increment hires on freelancer
    await User.findByIdAndUpdate(gig.hiredFreelancerId, { $inc: { totalHires: 1 } });

    res.json({ message: "Gig marked as completed", gig });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
