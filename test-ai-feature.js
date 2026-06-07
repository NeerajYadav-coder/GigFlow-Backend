import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/User.js";
import Gig from "./src/models/gig.js";
import Bid from "./src/models/bid.js";
import { aiRecommendBidders } from "./src/controllers/ai.controller.js";

dotenv.config();

// Helper mock response object to capture status and returned data
const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

async function runTest() {
  console.log("==========================================================");
  console.log("🚀 STARTING AUTOMATED AI RECOMMENDATION INTEGRATION TEST");
  console.log("==========================================================\n");

  if (!process.env.MONGO_URI) {
    console.error("❌ Error: MONGO_URI is missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");
  } catch (err) {
    console.error("❌ Failed to connect to database:", err.message);
    process.exit(1);
  }

  // --- 1. SEED TEST USERS & GIG ---
  console.log("\n1. Seeding mock client, job, and candidates...");
  
  let clientUser, candidate1, candidate2, testGig;
  
  try {
    // Create client
    clientUser = await User.create({
      name: "Tesla Inc.",
      email: `tesla-client-${Date.now()}@test.com`,
      password: "password123",
      role: "client"
    });

    // Create job listing
    testGig = await Gig.create({
      title: "Senior AI Engineer",
      description: "We are looking for a senior developer to build real-time AI agents. Must know Python, LLMs, and vector databases.",
      budget: 80000,
      category: "Data Science & AI",
      skillsRequired: ["Python", "LLMs", "Vector Databases"],
      ownerId: clientUser._id,
      type: "job"
    });

    // Candidate 1: Highly qualified, customized application
    candidate1 = await User.create({
      name: "Elena Rostova",
      email: `elena-${Date.now()}@test.com`,
      password: "password123",
      role: "freelancer",
      skills: ["Python", "LLMs", "Vector Databases", "LangChain", "PyTorch"],
      bio: "AI researcher and developer with 5+ years of experience in production NLP models."
    });

    // Candidate 2: Unqualified, low-effort application
    candidate2 = await User.create({
      name: "Dave Lazy",
      email: `dave-${Date.now()}@test.com`,
      password: "password123",
      role: "freelancer",
      skills: ["HTML"],
      bio: "Web developer."
    });

    // Bids / Applications
    await Bid.create({
      gigId: testGig._id,
      freelancerId: candidate1._id,
      message: "Hello Tesla team! I have built several production AI workflows using LangChain and pinecone vector databases. My custom prompt injection defense systems align perfectly with your safety guidelines.",
      price: null
    });

    await Bid.create({
      gigId: testGig._id,
      freelancerId: candidate2._id,
      message: "plz give job i need money",
      price: null
    });

    console.log("✅ Seed completed. Listing and 2 candidates ready.");

  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
    await cleanup();
    process.exit(1);
  }

  // --- 2. EXECUTE AI SHORTLIST CONTROLLER ---
  console.log("\n2. Invoking AI recommendation engine...");
  
  const req = {
    params: { gigId: testGig._id.toString() },
    user: { _id: clientUser._id }
  };
  const res = mockResponse();

  try {
    const startTime = Date.now();
    await aiRecommendBidders(req, res);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`⏱️  API Response received in ${duration} seconds.`);
    console.log(`📡 Status Code: ${res.statusCode || 200}`);

    if (res.statusCode && res.statusCode !== 200) {
      throw new Error(res.jsonData?.message || "Non-200 response returned");
    }

    // --- 3. ASSERT & OUTPUT REPORT ---
    console.log("\n3. Validating Recommendation Quality...");
    
    const analysis = res.jsonData?.analysis;
    if (!analysis) {
      throw new Error("Missing 'analysis' field in API response");
    }

    console.log(`   · Total candidates evaluated: ${res.jsonData.totalCandidates}`);
    console.log(`   · Overall Pool Rating: ${analysis.overallPoolRating}`);
    console.log(`   · Pool Summary: "${analysis.summary}"`);
    
    console.log(`\n🥇 TOP PICK: ${analysis.topPick?.name}`);
    console.log(`   · Reason: "${analysis.topPick?.headlineReason}"`);
    console.log(`   · Skill score: ${analysis.topPick?.scores?.skillAlignment}/10`);
    console.log(`   · Proposal score: ${analysis.topPick?.scores?.proposalQuality}/10`);
    console.log(`   · Hiring Advice: "${analysis.topPick?.hiringAdvice}"`);

    console.log(`\n🥈 RUNNER UP: ${analysis.runnerUp?.name}`);
    console.log(`   · Reason: "${analysis.runnerUp?.headlineReason}"`);
    console.log(`   · Proposal score: ${analysis.runnerUp?.scores?.proposalQuality}/10`);

    if (analysis.redFlags?.length > 0) {
      console.log("\n⚠️  RED FLAGS IDENTIFIED:");
      analysis.redFlags.forEach(flag => console.log(`   · ${flag}`));
    }

    // Assertions
    const passed = analysis.topPick?.name === "Elena Rostova" && analysis.runnerUp?.name === "Dave Lazy";
    if (passed) {
      console.log("\n🎉 TEST SUCCESSFUL! AI correctly identified and scored candidates.");
    } else {
      console.log("\n❌ TEST FAILED: AI did not pick candidates correctly.");
    }

  } catch (err) {
    console.error("❌ Recommendation test failed:", err.message);
  } finally {
    await cleanup();
  }

  // Helper cleanup function
  async function cleanup() {
    console.log("\n4. Cleaning up test database records...");
    if (testGig) {
      await Bid.deleteMany({ gigId: testGig._id });
      await Gig.deleteOne({ _id: testGig._id });
    }
    if (clientUser) await User.deleteOne({ _id: clientUser._id });
    if (candidate1) await User.deleteOne({ _id: candidate1._id });
    if (candidate2) await User.deleteOne({ _id: candidate2._id });
    await mongoose.disconnect();
    console.log("Disconnected database. Done.");
  }
}

runTest();
