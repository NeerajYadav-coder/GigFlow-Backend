import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import gigRoutes from "./routes/gig.routes.js";
import bidRoutes from "./routes/bid.routes.js";
import profileRoutes from "./routes/profile.routes.js";

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

/* Health Check */
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

/* Routes */
app.use("/api/auth", authRoutes);
app.use("/api/gigs", gigRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/profile", profileRoutes);

/* Global Error Handler */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error"
  });
});

export default app;
