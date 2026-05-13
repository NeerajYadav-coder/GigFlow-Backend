import Gig from "../models/gig.js";

/**
 * SmartMatch Engine
 * Calculates a matching score between a user and a gig.
 */
export const getRecommendations = async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== "freelancer") {
            return res.status(403).json({ message: "Only freelancers can get recommendations" });
        }

        // Get all open gigs
        const openGigs = await Gig.find({ status: "open" }).lean();

        const recommendations = openGigs.map(gig => {
            let score = 0;
            const reasons = [];

            // 1. Skill Match (Weight: 60%)
            if (gig.skillsRequired && gig.skillsRequired.length > 0) {
                const userSkills = user.skills || [];
                const matchedSkills = gig.skillsRequired.filter(skill => 
                    userSkills.some(us => us.toLowerCase() === skill.toLowerCase())
                );
                
                const skillScore = (matchedSkills.length / gig.skillsRequired.length) * 60;
                score += skillScore;
                
                if (matchedSkills.length > 0) {
                    reasons.push(`Matches ${matchedSkills.length} of your skills`);
                }
            } else {
                score += 30; // Default score if no skills specified
            }

            // 2. Category Match (Weight: 20%)
            if (user.preferredCategory && gig.category === user.preferredCategory) {
                score += 20;
                reasons.push(`In your preferred category: ${user.preferredCategory}`);
            }

            // 3. Budget Match (Weight: 20%)
            if (gig.budget >= (user.preferredMinBudget || 0)) {
                score += 20;
                reasons.push(`Meets your budget requirements`);
            } else {
                // Partial points if budget is close
                const ratio = gig.budget / (user.preferredMinBudget || 1);
                score += (ratio * 20);
            }

            return {
                ...gig,
                matchScore: Math.round(score),
                matchReasons: reasons.slice(0, 2) // Top 2 reasons
            };
        });

        // Sort by highest match score
        const sortedRecommendations = recommendations
            .filter(r => r.matchScore > 20) // Only show relevant ones
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 10); // Top 10 matches

        res.json(sortedRecommendations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
