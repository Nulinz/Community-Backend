import Feedback from "../models/feedbackModel.js";

/**
 * POST /api/feedback/submit
 * Allows users / students to submit feedback
 */
export const submitFeedback = async (req, res) => {
  try {
    const { name, email, category, rating, message } = req.body;
    const userId = req.user?._id || req.user?.id || null;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Feedback message is required.",
      });
    }

    const feedback = await Feedback.create({
      userId,
      name: name || req.user?.name || "",
      email: email || req.user?.email || "",
      category: category || "General",
      rating: rating ? Number(rating) : 5,
      message: message.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Thank you for your feedback!",
      data: feedback,
    });
  } catch (error) {
    console.error("Submit Feedback Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit feedback. Please try again.",
    });
  }
};

/**
 * GET /api/feedback/all
 * Fetch all feedback entries sorted by newest first
 */
export const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name email role");

    return res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    console.error("Get Feedbacks Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch feedback list.",
    });
  }
};
