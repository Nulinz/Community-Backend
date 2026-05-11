import Company from "../models/companyModel.js";
import mongoose from "mongoose"

export const seedCompanyByUserId = async ({
  userId,
  companyData,
}) => {
  try {
    // check existing company
    const existingCompany = await Company.findOne({ userId });

    if (existingCompany) {
      console.log("⚠️ Company already exists");
      return existingCompany;
    }

    const companyPayload = {
      c_by: new mongoose.Types.ObjectId(userId),
      userId: new mongoose.Types.ObjectId(userId),

      companyName: companyData?.companyName || "",
      companyType: companyData?.companyType || "",
      companyTagLine: companyData?.companyTagLine || "",

      companyCultureTags: companyData?.companyCultureTags || [],

      yearFounded: companyData?.yearFounded || "",
      websiteLink: companyData?.websiteLink || "",

      companyLogo: companyData?.companyLogo || "",
      coverImage: companyData?.coverImage || "",

      employees: companyData?.employees || "",

      contactPersonName: companyData?.contactPersonName || "",

      address: companyData?.address || "",
      city: companyData?.city || "",
      state: companyData?.state || "",
      pincode: companyData?.pincode || "",

      technologies: companyData?.technologies || [],
      whatWeDo: companyData?.whatWeDo || [],
      learningBenefits: companyData?.learningBenefits || [],
      learningOutcomes: companyData?.learningOutcomes || [],

      aboutUs: companyData?.aboutUs || "",
      certificateAvailability:
        companyData?.certificateAvailability || "",

      posts: companyData?.posts || [],
      rawPayload: companyData?.rawPayload || null,

      isActive: true,
    };

    const company = await Company.create(companyPayload);

    console.log("✅ Company seeded successfully");

    return company;
  } catch (error) {
    console.error("❌ Seeder Error:", error.message);
  }
};