import { aiToolsData } from "../../data/aiToolsData.js";
import { awardXP } from "../../services/xpService.js";

/**
 * GET /api/users/ai-tools
 * Optional query param: ?category=Coding
 */
export const getAiTools = async (req, res) => {
  try {
    const { category } = req.query;

    // Award AI_STATION XP once per calendar day if user is authenticated
    if (req.user?._id) {
      await awardXP({ userId: req.user._id, actionKey: "AI_STATION" });
    }

    let tools = aiToolsData;

    if (category) {
      tools = tools.filter(
        (t) => t.category.toLowerCase() === category.toLowerCase()
      );
    }

    // 🔹 Group AI tools by category into an array format: [{ category: "Writing", tools: [...] }]
    const grouped = {};
    tools.forEach((tool) => {
      const cat = tool.category;
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      const { category: _, ...toolItem } = tool;
      grouped[cat].push(toolItem);
    });

    const categorizedTools = Object.keys(grouped).map((catName) => ({
      category: catName,
      tools: grouped[catName],
    }));

    return res.status(200).json({
      status: true,
      count: categorizedTools.length,
      data: categorizedTools,
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
