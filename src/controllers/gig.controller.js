// import Gig from "../models/gig.js";

// // CREATE GIG (Protected)
// export const createGig = async (req, res) => {
//   try {
//     const { title, description, budget } = req.body;

//     if (!title || !description || !budget) {
//       return res.status(400).json({ message: "All fields required" });
//     }

//     const gig = await Gig.create({
//       title,
//       description,
//       budget,
//       ownerId: req.user._id
//     });

//     res.status(201).json(gig);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // GET OPEN GIGS + SEARCH
// export const getGigs = async (req, res) => {
//   try {
//     const { search } = req.query;

//     let query = { status: "open" };

//     if (search) {
//       query.title = { $regex: search, $options: "i" };
//     }

//     const gigs = await Gig.find(query).populate(
//       "ownerId",
//       "name email"
//     );

//     res.json(gigs);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };


import Gig from "../models/gig.js";

// GET ALL GIGS
export const getGigs = async (req, res) => {
  try {
    const gigs = await Gig.find().sort({ createdAt: -1 });
    res.json(gigs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET SINGLE GIG BY ID ✅ REQUIRED
export const getGigById = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({ message: "Gig not found" });
    }

    res.json(gig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE GIG
export const createGig = async (req, res) => {
  try {
    const { title, description, budget } = req.body;

    if (!title || !description || !budget) {
      return res.status(400).json({ message: "All fields required" });
    }

    const gig = await Gig.create({
      title,
      description,
      budget,
      ownerId: req.user._id
    });

    res.status(201).json(gig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
