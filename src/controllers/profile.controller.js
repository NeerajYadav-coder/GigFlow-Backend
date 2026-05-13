import User from "../models/User.js";

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
        const { name, bio, skills, location, avatar } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (bio !== undefined) updateData.bio = bio;
        if (skills !== undefined) updateData.skills = skills;
        if (location !== undefined) updateData.location = location;
        if (avatar !== undefined) updateData.avatar = avatar;

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
            "name bio skills location avatar role totalGigsPosted totalHires totalBidsPlaced createdAt"
        );
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
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
