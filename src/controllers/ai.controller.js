import { GoogleGenerativeAI } from "@google/generative-ai";
import Bid from "../models/bid.js";
import Gig from "../models/gig.js";

/*
|--------------------------------------------------------------------------
| AI BIDDER RECOMMENDATION ENGINE
|--------------------------------------------------------------------------
| Evaluates all applicants on a gig and uses Gemini to shortlist the top 2.
|
| Evaluation Dimensions (the 6 that actually matter):
|   1. Skill match score      — how many required skills does the candidate have?
|   2. Proposal quality       — is the cover letter specific, thoughtful, relevant?
|   3. Experience credibility — hire track record, bio depth, resume presence
|   4. Budget fit             — for gigs: is their price competitive AND reasonable?
|   5. Response speed         — early applicants are often more motivated
|   6. Profile completeness   — bio, location, skills array, resume uploaded
*/
export const aiRecommendBidders = async (req, res) => {
  try {
    const { gigId } = req.params;

    // --- GUARD: Only gig owner can request AI recommendation ---
    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({ message: "Listing not found" });
    }
    if (gig.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied — only the listing owner can use AI recommendations" });
    }

    // --- GUARD: Minimum viable bidder count ---
    const bids = await Bid.find({ gigId })
      .populate("freelancerId", "name bio skills location totalHires totalBidsPlaced resume resumeOriginalName preferredCategory createdAt")
      .sort({ createdAt: 1 }) // oldest first = fastest responder gets credit
      .lean();

    if (bids.length === 0) {
      return res.status(400).json({ message: "No applicants yet. Wait for candidates to apply before running AI analysis." });
    }
    if (bids.length === 1) {
      return res.status(400).json({ message: "Only 1 applicant so far. AI shortlisting needs at least 2 candidates to compare." });
    }

    // --- GUARD: Check API keys (Prioritize GROQ) ---
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    
    if ((!groqKey || groqKey === "your_groq_api_key_here") && (!geminiKey || geminiKey === "your_gemini_api_key_here")) {
      return res.status(503).json({
        message: "AI service is not configured. Please add a GROQ_API_KEY or GEMINI_API_KEY to the server .env file.",
        setupRequired: true
      });
    }

    // --- BUILD RICH CONTEXT OBJECT ---
    const gigContext = buildGigContext(gig);
    const candidateProfiles = bids.map((bid, index) => buildCandidateProfile(bid, index + 1, gig));

    // --- PROMPT ENGINEERING ---
    const prompt = buildEvaluationPrompt(gigContext, candidateProfiles);
    let rawText = "";

    if (groqKey && groqKey !== "your_groq_api_key_here") {
      // --- CALL GROQ ---
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile", // active, high-performance Llama 70B model
          messages: [
            {
              role: "system",
              content: "You are a expert hiring assistant. You must return only a valid JSON object matching the requested schema."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Groq API returned status ${response.status}`);
      }

      const resData = await response.json();
      rawText = resData.choices?.[0]?.message?.content || "";
    } else {
      // --- FALLBACK: CALL GEMINI ---
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens: 2048
        }
      });
      const result = await model.generateContent(prompt);
      rawText = result.response.text();
    }

    // --- PARSE & VALIDATE RESPONSE ---
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("AI returned non-JSON:", rawText);
      return res.status(502).json({ message: "AI returned an unexpected response format. Please try again." });
    }

    // Map candidate numbers back to bid _ids so frontend can highlight them
    const enriched = enrichResponseWithBidData(parsed, bids);

    res.json({
      gigTitle: gig.title,
      totalCandidates: bids.length,
      analysis: enriched
    });

  } catch (error) {
    console.error("AI Recommendation error:", error);
    if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("API key")) {
      return res.status(401).json({ message: "Invalid API key. Please check your GROQ_API_KEY or GEMINI_API_KEY in .env" });
    }
    if (error.message?.includes("quota") || error.message?.includes("429")) {
      return res.status(429).json({ message: "API rate limit reached. Please wait a moment and try again." });
    }
    res.status(500).json({ message: "AI analysis failed: " + error.message });
  }
};

/* --------------------------------------------------------------------------
   HELPER: Build structured gig context for the prompt
-------------------------------------------------------------------------- */
function buildGigContext(gig) {
  const isJob = gig.type === "job";
  const isInternship = gig.type === "internship";

  return {
    type: gig.type || "gig",
    title: gig.title,
    description: gig.description,
    category: gig.category,
    requiredSkills: gig.skillsRequired || [],
    tags: gig.tags || [],
    budget: gig.budget,
    budgetLabel: isJob
      ? `₹${gig.budget.toLocaleString()} per ${gig.salaryType === "yearly" ? "year (CTC)" : "month"}`
      : isInternship
        ? `₹${gig.budget.toLocaleString()} per month (stipend)`
        : `₹${gig.budget.toLocaleString()} fixed price`,
    experienceLevel: gig.experienceLevel || "Not specified",
    jobType: isJob || isInternship ? (gig.jobType || "Full-time") : null,
    locationType: gig.locationType || "Remote",
    location: gig.location || null,
    companyName: gig.companyName || null,
    deadline: gig.deadline ? new Date(gig.deadline).toLocaleDateString("en-IN") : null
  };
}

/* --------------------------------------------------------------------------
   HELPER: Build rich candidate profile from bid + user data
-------------------------------------------------------------------------- */
function buildCandidateProfile(bid, number, gig) {
  const f = bid.freelancerId;
  const isFreelanceGig = gig.type === "gig" || !gig.type;

  // Calculate skill overlap
  const requiredSkills = (gig.skillsRequired || []).map(s => s.toLowerCase());
  const candidateSkills = (f?.skills || []).map(s => s.toLowerCase());
  const matchedSkills = requiredSkills.filter(s => candidateSkills.includes(s));
  const skillOverlapPct = requiredSkills.length > 0
    ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
    : null;

  // Response speed: how many hours after posting did they apply?
  const gigPostedAt = new Date(bid.gigId?.createdAt || Date.now());
  const appliedAt = new Date(bid.createdAt);
  const hoursToRespond = Math.round((appliedAt - gigPostedAt) / (1000 * 60 * 60));

  // Profile completeness score (0–5)
  let completeness = 0;
  if (f?.bio && f.bio.length > 30) completeness++;
  if (f?.skills?.length >= 3) completeness++;
  if (f?.location) completeness++;
  if (f?.resume) completeness++;
  if (bid.message && bid.message.length > 100) completeness++;

  return {
    candidateNumber: number,
    bidId: bid._id.toString(),
    freelancerId: f?._id?.toString() || "",
    name: f?.name || "Unknown",

    // Profile signals
    bio: f?.bio || "No bio provided",
    skills: f?.skills || [],
    skillCount: f?.skills?.length || 0,
    location: f?.location || "Not specified",
    hasResume: !!f?.resume,
    resumeName: f?.resumeOriginalName || null,

    // Experience signals
    totalHires: f?.totalHires || 0, // times they've been hired — strongest signal
    totalBidsPlaced: f?.totalBidsPlaced || 0,
    hireRate: f?.totalBidsPlaced > 0
      ? `${Math.round((f.totalHires / f.totalBidsPlaced) * 100)}%`
      : "0%",
    memberSince: f?.createdAt ? new Date(f.createdAt).getFullYear() : "Unknown",

    // Skill match
    matchedRequiredSkills: matchedSkills,
    skillOverlapPercent: skillOverlapPct,

    // Bid-specific
    coverLetter: bid.message, // the most important single signal
    bidPrice: isFreelanceGig ? bid.price : null,
    priceDiffFromBudget: isFreelanceGig && bid.price
      ? Math.round(((bid.price - gig.budget) / gig.budget) * 100)
      : null,
    deliveryDays: bid.deliveryDays || null,

    // Behavioral
    hoursToRespond: hoursToRespond > 0 ? hoursToRespond : 1,
    profileCompletenessScore: completeness, // out of 5
    status: bid.status
  };
}

/* --------------------------------------------------------------------------
   HELPER: Build the evaluation prompt — THIS IS THE CORE OF THE FEATURE
-------------------------------------------------------------------------- */
function buildEvaluationPrompt(gig, candidates) {
  const isFreelanceGig = gig.type === "gig";

  return `You are an expert hiring manager and talent evaluator at a top tech company. 
Your job is to analyze ${candidates.length} candidates who applied for a ${gig.type} and identify the TOP 2 BEST candidates with genuine reasoning.

## THE LISTING

**Title:** ${gig.title}
**Type:** ${gig.type.toUpperCase()}${gig.companyName ? ` at ${gig.companyName}` : ""}
**Category:** ${gig.category}
**Required Skills:** ${gig.requiredSkills.length > 0 ? gig.requiredSkills.join(", ") : "Not specified"}
**Tags/Keywords:** ${gig.tags.length > 0 ? gig.tags.join(", ") : "None"}
**Compensation:** ${gig.budgetLabel}
**Experience Level Required:** ${gig.experienceLevel}
${gig.jobType ? `**Employment Type:** ${gig.jobType}` : ""}
**Work Setup:** ${gig.locationType}${gig.location ? ` (${gig.location})` : ""}
**Description:** ${gig.description}

---

## CANDIDATES (${candidates.length} total)

${candidates.map(c => `### CANDIDATE ${c.candidateNumber}: ${c.name}

**Profile:**
- Bio: "${c.bio}"
- Skills listed: ${c.skills.length > 0 ? c.skills.join(", ") : "None"}
- Location: ${c.location}
- Has uploaded resume: ${c.hasResume ? "YES ✓" : "NO ✗"}
- Member since: ${c.memberSince}

**Experience Signals:**
- Total times hired on platform: ${c.totalHires} (this is the most reliable credibility signal)
- Total bids placed: ${c.totalBidsPlaced}
- Platform hire rate: ${c.hireRate}
- Profile completeness (0-5): ${c.profileCompletenessScore}/5

**Skill Match:**
- Matched required skills: ${c.matchedRequiredSkills.length > 0 ? c.matchedRequiredSkills.join(", ") : "None matched"}
- Skill overlap with requirements: ${c.skillOverlapPercent !== null ? `${c.skillOverlapPercent}%` : "N/A (no skills specified)"}

${isFreelanceGig ? `**Bid Economics:**
- Quoted price: ₹${c.bidPrice?.toLocaleString() || "N/A"}
- vs. Client budget: ${c.priceDiffFromBudget !== null ? (c.priceDiffFromBudget > 0 ? `${c.priceDiffFromBudget}% ABOVE budget` : c.priceDiffFromBudget < 0 ? `${Math.abs(c.priceDiffFromBudget)}% BELOW budget` : "Exactly on budget") : "N/A"}
- Delivery timeline: ${c.deliveryDays ? `${c.deliveryDays} days` : "Not specified"}` : ""}

**Response Speed:** Applied within ${c.hoursToRespond} hours of posting

**Cover Letter / Application (READ CAREFULLY — this is the most telling signal):**
"${c.coverLetter}"

---`).join("\n")}

---

## YOUR EVALUATION TASK

Evaluate each candidate OBJECTIVELY and CRITICALLY on these 6 dimensions:

1. **Skill Alignment** (0-10): Do their skills specifically match what's required? Generic skills score low.
2. **Proposal Quality** (0-10): Is the cover letter specific to THIS job? Does it show genuine understanding of the requirements? Generic copy-paste proposals score very low (1-2). Personalized, detailed ones score high (8-10).
3. **Proven Track Record** (0-10): Platform hire history is real social proof. More hires = more trustworthy.
4. **Profile Credibility** (0-10): Bio depth, resume uploaded, profile completeness — professional candidates invest in these.
${isFreelanceGig ? "5. **Budget Fitness** (0-10): Price within 20% of budget scores well. Way over = bad. Way under = might signal low quality or desperation." : "5. **Role Fit** (0-10): Experience level, employment type match, location compatibility."}
6. **Motivation Signal** (0-10): Fast response, detailed proposal, all fields filled = highly motivated.

**IMPORTANT RULES:**
- A generic cover letter like "I am interested in this job" should score 1-2 on Proposal Quality — do not be lenient.
- A candidate with 0 hires but an excellent, specific proposal should rank higher than a hired candidate with a lazy proposal.
- If two candidates have similar scores, pick the one whose SKILLS match more specifically.
- Return EXACTLY the top 2 candidates.

## REQUIRED OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation outside JSON):

{
  "summary": "2-3 sentence executive summary of the applicant pool quality",
  "topPick": {
    "candidateNumber": <number>,
    "name": "<name>",
    "headlineReason": "<one punchy sentence why they are #1>",
    "scores": {
      "skillAlignment": <0-10>,
      "proposalQuality": <0-10>,
      "trackRecord": <0-10>,
      "profileCredibility": <0-10>,
      "budgetOrRoleFit": <0-10>,
      "motivationSignal": <0-10>
    },
    "totalScore": <sum of all 6 scores>,
    "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
    "concerns": ["<honest concern if any, or 'None identified'>"],
    "whyBetter": "<2-3 sentences explaining why they beat the runner-up specifically>",
    "hiringAdvice": "<practical advice for the client on how to proceed with this candidate>"
  },
  "runnerUp": {
    "candidateNumber": <number>,
    "name": "<name>",
    "headlineReason": "<one punchy sentence why they are #2>",
    "scores": {
      "skillAlignment": <0-10>,
      "proposalQuality": <0-10>,
      "trackRecord": <0-10>,
      "profileCredibility": <0-10>,
      "budgetOrRoleFit": <0-10>,
      "motivationSignal": <0-10>
    },
    "totalScore": <sum of all 6 scores>,
    "strengths": ["<specific strength 1>", "<specific strength 2>"],
    "concerns": ["<honest concern if any>"],
    "whyConsider": "<why this is a solid backup option>"
  },
  "redFlags": ["<any candidates with clear red flags and why — helps client avoid bad hires>"],
  "overallPoolRating": "<Excellent|Good|Average|Weak> — with a one-line reason"
}`;
}

/* --------------------------------------------------------------------------
   HELPER: Attach bid IDs and freelancer IDs to the parsed AI response
-------------------------------------------------------------------------- */
function enrichResponseWithBidData(parsed, bids) {
  const enrich = (pick) => {
    if (!pick?.candidateNumber) return pick;
    const idx = pick.candidateNumber - 1;
    const bid = bids[idx];
    if (!bid) return pick;
    return {
      ...pick,
      bidId: bid._id.toString(),
      freelancerId: bid.freelancerId?._id?.toString() || ""
    };
  };

  return {
    ...parsed,
    topPick: enrich(parsed.topPick),
    runnerUp: enrich(parsed.runnerUp)
  };
}
