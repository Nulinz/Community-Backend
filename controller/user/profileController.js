import Resume from "../../models/resumeModel.js";
import Notification from "../../models/notificationModel.js";


const uploadResume = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "Resume file is required",
      });
    }

    const { originalname, path, size, mimetype } = req.file;

    const resume = await Resume.create({
      userId,
      fileName: originalname,
      fileUrl: path,       // replace with cloud URL (S3/Cloudinary) if needed
      fileSize: size,
      mimeType: mimetype,
    });

    return res.status(201).json({
      status: true,
      message: "Resume uploaded successfully",
      data: resume,
    });
  } catch (error) {
    console.error("Resume Upload Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to upload resume",
      error: error.message,
    });
  }
};
const getUserResumes = async (req, res) => {
  try {
    const userId = req.user._id;

    const resumes = await Resume.find({ userId })
      .sort({ createdAt: -1 })
      .select("fileName fileUrl fileSize mimeType createdAt");

    return res.status(200).json({
      status: true,
      count: resumes.length,
      data: resumes,
    });
  } catch (error) {
    console.error("Get Resumes Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch resumes",
      error: error.message,
    });
  }
};
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({
      receiver: userId,
      is_deleted: false,
    })
      .sort({ createdAt: -1 })
      .select("title message body type reference_id is_read read_at metadata createdAt");

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return res.status(200).json({
      status: true,
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    console.error("Get Notifications Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};
const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.body;

    if (notificationId) {
      // Mark single notification as read
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, receiver: userId },
        { is_read: true, read_at: new Date() },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          status: false,
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        status: true,
        message: "Notification marked as read",
        data: notification,
      });
    } else {
      // Mark ALL as read
      await Notification.updateMany(
        { receiver: userId, is_read: false },
        { is_read: true, read_at: new Date() }
      );

      return res.status(200).json({
        status: true,
        message: "All notifications marked as read",
      });
    }
  } catch (error) {
    console.error("Mark As Read Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to mark notifications as read",
      error: error.message,
    });
  }
};
const updateProfilePic = async (req, res) => {
  try {
    const userId = req.user._id;
 
    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "Profile picture file is required",
      });
    }
 
    const fileUrl = req.file.path; // replace with cloud URL if using S3/Cloudinary
 
    const userDetails = await UserDetails.findOneAndUpdate(
      { userId },
      { profile_pic: fileUrl },
      { new: true }
    ).select("userId profile_pic updatedAt");
 
    if (!userDetails) {
      return res.status(404).json({
        status: false,
        message: "User details not found",
      });
    }
 
    return res.status(200).json({
      status: true,
      message: "Profile picture updated successfully",
      data: userDetails,
    });
  } catch (error) {
    console.error("Update Profile Pic Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to update profile picture",
      error: error.message,
    });
  }
};
 

export { uploadResume, getUserResumes,getNotifications, markAsRead,updateProfilePic };