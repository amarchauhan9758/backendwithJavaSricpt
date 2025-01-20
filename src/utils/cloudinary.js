import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration

// CLOUDINARY_ClOUD_NAME= kaaptancloud07
// CLOUDINARY_API_KEY = 558212642673766
// CLOUDINARY_API_SECRET = kyjfgqet2uLcOYHaCl4eXFJil5M
cloudinary.config({
  cloud_name: "kaaptancloud07",
  api_key: "558212642673766",
  api_secret: "kyjfgqet2uLcOYHaCl4eXFJil5M",
});

const uploadOnCloudinary = async (localFilePath) => {
  console.log(localFilePath, "line no 16");
  try {
    if (!localFilePath) {
      throw new Error("No file path provided.");
    }

    console.log(`Uploading file: ${localFilePath}`);

    // Upload the file to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto", // Allows any file type (e.g., image, video, etc.)
    });

    console.log("File uploaded to Cloudinary:", response);

    // Remove the file from the local system
    try {
      fs.unlinkSync(localFilePath);
    } catch (unlinkError) {
      console.error("Error removing local file:", unlinkError);
    }

    return response;
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);

    // Attempt to remove the file even if upload fails
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (unlinkError) {
      console.error("Error removing local file after failure:", unlinkError);
    }

    return null;
  }
};

export { uploadOnCloudinary };
