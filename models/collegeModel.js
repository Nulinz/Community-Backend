import mongoose from "mongoose";

const collegeSchema = new mongoose.Schema(
    {
        c_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        collegeName: {
            type: String,
            required: true,
            trim: true,
        },
        collegeType: {
            type: String,
            required: true,
            trim: true,
        },
        establishedYear: {
            type: String,
            default: "",
            trim: true,
        },
        affiliatedUniversity: {
            type: String,
            default: "",
            trim: true,
        },
        totalDepartments: {
            type: String,
            default: "",
        },
        collegeLogo: {
            type: String,
            required: true,
            trim: true,
        },
        contactPersonName: {
            type: String,
            required: true,
            trim: true,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        city: {
            type: String,
            required: true,
            trim: true,
        },
        state: {
            type: String,
            required: true,
            trim: true,
        },
        pincode: {
            type: String,
            required: true,
            trim: true,
        },
        departments: {
            type: [String],
            default: [],
        },
        coursesAvailable: {
            type: [String],
            default: [],
        },
        totalStudents: {
            type: String,
            default: "",
        },
        placementAvailable: {
            type: String,
            default: "",
        },
        aboutUs: {
            type: String,
            default: "",
            trim: true,
        },


    },
    {
        timestamps: true,
    }
);

const College = mongoose.models.College || mongoose.model("College", collegeSchema);

export default College;
