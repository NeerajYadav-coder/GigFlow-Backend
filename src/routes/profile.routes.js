import express from "express";
import protect from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import {
    getProfile,
    updateProfile,
    getPublicProfile,
    changePassword,
    uploadResume,
    deleteResume,
    downloadMyResume,
    downloadBidderResume
} from "../controllers/profile.controller.js";

const router = express.Router();

router.get("/me", protect, getProfile);
router.put("/me", protect, updateProfile);
router.patch("/me/password", protect, changePassword);
router.post("/me/resume", protect, upload.single("resume"), uploadResume);
router.delete("/me/resume", protect, deleteResume);
// Resume download routes (must be before /:id to avoid conflict)
router.get("/me/resume/download", protect, downloadMyResume);
router.get("/:id/resume/download/:gigId", protect, downloadBidderResume);
router.get("/:id", getPublicProfile);

export default router;
