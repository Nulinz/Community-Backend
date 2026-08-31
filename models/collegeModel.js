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
        accountHolderName: {
            type: String,
            default: "",
            trim: true,
        },

        bankName: {
            type: String,
            default: "",
            trim: true,
        },

        branchName: {
            type: String,
            default: "",
            trim: true,
        },

        accountNumber: {
            type: String,
            default: "",
            trim: true,
        },

        ifscCode: {
            type: String,
            default: "",
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
        officialWebsite: {
            type: String,
            default: "",
            trim: true,
        },
        aisheCode: {
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
        designation: {
            type: String,
            default: "",
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
        accreditation: {
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
        signatureUrl: {
            type: String,
            default: "",
            trim: true,
        },
        signatoryName: {
            type: String,
            default: "",
            trim: true,
        },
        signatoryDesignation: {
            type: String,
            default: "",
            trim: true,
        },
        certificateContentBody: {
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
