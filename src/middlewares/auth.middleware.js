import { asyncHandler } from "../utils/asyncHandler.js ";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/users.model.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies.accessToken ||
      req.header("Authorization").replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorzied token ");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const userVerify = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!userVerify) {
      throw new ApiError(400, "Invalid Access Token");
    }

    req.user = userVerify;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message);
  }
});
