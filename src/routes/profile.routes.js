import express from "express";
import protect from "../middleware/auth.middleware.js";
import {
    getProfile,
    updateProfile,
    getPublicProfile,
    changePassword
} from "../controllers/profile.controller.js";

const router = express.Router();

router.get("/me", protect, getProfile);
router.put("/me", protect, updateProfile);
router.patch("/me/password", protect, changePassword);
router.get("/:id", getPublicProfile);

export default router;
