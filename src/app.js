import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import authRoutes from "./routes/auth.routes.js";
import gigRoutes from "./routes/gig.routes.js";
import bidRoutes from "./routes/bid.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import recommendationRoutes from "./routes/recommendation.routes.js";
import aiRoutes from "./routes/ai.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();

/* 🔥 TRUST PROXY for secure cookies on Render/Heroku */
app.set("trust proxy", 1);

/* 🔥 CORS CONFIG */
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://gigflow.netlify.app"
      ];

      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".netlify.app") ||
        origin.startsWith("http://localhost:")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* Middlewares */
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(uploadDir));

/* Health Check */
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

/* Routes */
app.use("/api/auth", authRoutes);
app.use("/api/gigs", gigRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/ai", aiRoutes);

/* Global Error Handler */
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle Multer upload limits or file type errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File size exceeds 5MB limit" });
  }
  if (err.message && err.message.includes("allowed!")) {
    return res.status(400).json({ message: err.message });
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal server error"
  });
});

export default app;
