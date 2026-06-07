import User from "../models/User.js";
import Bid from "../models/bid.js";
import Gig from "../models/gig.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GET PROFILE (self or by ID)
export const getProfile = async (req, res) => {
    try {
        const userId = req.params.id || req.user._id;
        const user = await User.findById(userId).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// UPDATE PROFILE (self only)
export const updateProfile = async (req, res) => {
    try {
        const { name, bio, skills, location, avatar, preferredCategory, preferredMinBudget } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (bio !== undefined) updateData.bio = bio;
        if (skills !== undefined) {
            if (Array.isArray(skills) && skills.length > 15) {
                return res.status(400).json({ message: "You can add a maximum of 15 skills" });
            }
            updateData.skills = skills;
        }
        if (location !== undefined) updateData.location = location;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (preferredCategory !== undefined) updateData.preferredCategory = preferredCategory;
        if (preferredMinBudget !== undefined) updateData.preferredMinBudget = Number(preferredMinBudget) || 0;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true, runValidators: true }
        ).select("-password");

        res.json({ message: "Profile updated successfully", user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET PUBLIC PROFILE
export const getPublicProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select(
            "name bio skills location avatar role totalGigsPosted totalHires totalBidsPlaced createdAt resume resumeOriginalName"
        );
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DOWNLOAD OWN RESUME (freelancer downloads their own resume)
export const downloadMyResume = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user || !user.resume) {
            return res.status(404).json({ message: "No resume found on your profile" });
        }

        const absolutePath = path.join(__dirname, "../..", user.resume);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ message: "Resume file not found on server" });
        }

        const filename = user.resumeOriginalName || path.basename(absolutePath);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/octet-stream");
        fs.createReadStream(absolutePath).pipe(res);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DOWNLOAD BIDDER RESUME (client downloads resume of a candidate who applied to their gig)
export const downloadBidderResume = async (req, res) => {
    try {
        const { bidderId, gigId } = req.params;

        // Security: verify the requester owns the gig this bidder applied to
        const gig = await Gig.findById(gigId);
        if (!gig) {
            return res.status(404).json({ message: "Gig not found" });
        }
        if (gig.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied — you are not the listing owner" });
        }

        // Verify the bidder actually applied to this gig
        const bid = await Bid.findOne({ gigId, freelancerId: bidderId });
        if (!bid) {
            return res.status(404).json({ message: "No application found for this candidate on this listing" });
        }

        // Fetch the bidder's resume
        const bidder = await User.findById(bidderId);
        if (!bidder || !bidder.resume) {
            return res.status(404).json({ message: "This candidate has not uploaded a resume" });
        }

        const absolutePath = path.join(__dirname, "../..", bidder.resume);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ message: "Resume file not found on server" });
        }

        const filename = bidder.resumeOriginalName || `resume_${bidder.name.replace(/\s+/g, "_")}.pdf`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/octet-stream");
        fs.createReadStream(absolutePath).pipe(res);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// CHANGE PASSWORD
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Both fields are required" });
        }

        const user = await User.findById(req.user._id);
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// UPLOAD RESUME
export const uploadResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded or file type is invalid" });
        }

        // Clean up previous resume file if it exists
        const currentUser = await User.findById(req.user._id);
        if (currentUser && currentUser.resume) {
            const oldResumePath = path.join(__dirname, "../..", currentUser.resume);
            if (fs.existsSync(oldResumePath)) {
                try {
                    fs.unlinkSync(oldResumePath);
                } catch (err) {
                    console.error("Failed to delete old resume file:", err.message);
                }
            }
        }

        const relativePath = `/uploads/resumes/${req.file.filename}`;
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                resume: relativePath,
                resumeOriginalName: req.file.originalname
            },
            { new: true }
        ).select("-password");

        res.json({
            message: "Resume uploaded successfully",
            user
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE RESUME
export const deleteResume = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.resume) {
            const absolutePath = path.join(__dirname, "../..", user.resume);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
        }

        user.resume = "";
        user.resumeOriginalName = "";
        await user.save();

        res.json({
            message: "Resume removed successfully",
            user: await User.findById(req.user._id).select("-password")
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
