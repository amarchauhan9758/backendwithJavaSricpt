import mongoose from "mongoose";
import { DB_NAME } from "../constent.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log(`Mongo DB connect  :${connectionInstance.connection.host}`);
  } catch (error) {
    console.log("Failed", error);
    process.exit(1);
  }
};

export default connectDB;
