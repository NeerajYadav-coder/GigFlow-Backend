import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import dotenv from "dotenv";

dotenv.config();

// Validate critical environment variables
if (!process.env.JWT_SECRET) {
  console.error("❌ ERROR: JWT_SECRET environment variable is missing!");
}

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
