import { aiToolsData } from "../../data/aiToolsData.js";

/**
 * GET /api/users/ai-tools
 * Optional query param: ?category=Coding
 */
export const getAiTools = async (req, res) => {
  try {
    const { category } = req.query;

    let tools = aiToolsData;

    if (category) {
      tools = tools.filter(
        (t) => t.category.toLowerCase() === category.toLowerCase()
      );
    }

    return res.status(200).json({
      status: true,
      count: tools.length,
      data: tools,
    });
  } catch (error) {
    console.error("AI Tools API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch AI tools data",
      error: error.message,
    });
  }
};
