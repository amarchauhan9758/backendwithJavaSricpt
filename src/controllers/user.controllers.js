import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/users.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefereshTokens = async (userId) => {
  console.log(userId, "line no 28");
  try {
    const user = await User.findById(userId);
    console.log(user, "line no 31");
    const accessToken = user.generateAccessToken();
    console.log(accessToken, "accessToken");
    const refreshToken = user.generateRefreshToken();
    console.log(refreshToken, "refreshToken");

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

const userRegister = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  const { email, username, password } = req.body;

  if ([email, username, password].some((field) => field.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username, email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  console.log(req.files, "line no 52");

  const avatarLocalPath = req?.files?.avatar[0]?.path;
  // console.log(avatarLocalPath, "line no 55");
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }
  //const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  // console.log(avatar, "line no 72");

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    email,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password,
    username: username.toLowerCase(),
  });
  console.log(user);
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(200, createdUser, "User registered Successfully", "")
    );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  // console.log(user, "line no 129");

  if (!user) {
    throw new ApiError(400, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect("kaaptain@123");
  // console.log(isPasswordValid, "line no 136");
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // console.log(user, "line no 141");
  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );
  console.log(accessToken, "line no 149");

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldpassword, newPassword, cofirmPass } = req.body;
  console.log(oldpassword, newPassword, "line  no 232");
  // if (!(newPassword === cofirmPass)) {
  //   throw new ApiError(400, "new password doest not match cofirm password");
  // }

  const user = await User.findById(req?.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldpassword);

  console.log(user, isPasswordCorrect, "line no 240");
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changes successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, " User Fetch Successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "All field Required");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Uese Update SuccessFully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req?.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file Missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar?.url) {
    throw new ApiError(400, "Error while uploading  Avatar File");
  }

  const user = await User.findById(
    req?.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Image  updated Successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Error while  uplaoding  Cover Image");
  }

  //TODO: delete old image - assignment

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage?.url) {
    throw new ApiError(400, "CoverImage is missing");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req?.params;

  if (!username?.trim()) {
    throw new ApiError(400, "User name missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelSubscriberCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user_id, "$subscribers.subscribe"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        isSubscribed: 1,
        subscriberCount: 1,
        channelSubscriberCount: 1,
      },
    },
  ]);
  console.log(channel, "line no 388");

  if (!channel.length) {
    throw new ApiError(400, "Channel doest not exists");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User Channel Fetch Successfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  console.log(req, "line no 403");
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    email: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owners",
              },
            },
          },
        ],
      },
    },
  ]);

  console.log(user, "line no 444");
  if (!user) {
    throw new ApiError("400", "watch History  missing");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, user[0].watchHistory, "Watch History successfully")
    );
});

// const changeCurrentPassword = asyncHandler(async (req, res) => {
//   const { oldPassword, newPassword } = req.body;

//   const user = await User.findById(req.user?._id);
//   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

//   if (!isPasswordCorrect) {
//     throw new ApiError(400, "Invalid old password");
//   }

//   user.password = newPassword;
//   await user.save({ validateBeforeSave: false });

//   return res
//     .status(200)
//     .json(new ApiResponse(200, {}, "Password changed successfully"));
// });

// const getCurrentUser = asyncHandler(async (req, res) => {
//   return res
//     .status(200)
//     .json(new ApiResponse(200, req.user, "User fetched successfully"));
// });

// const updateAccountDetails = asyncHandler(async (req, res) => {
//   const { fullName, email } = req.body;

//   if (!fullName || !email) {
//     throw new ApiError(400, "All fields are required");
//   }

//   const user = await User.findByIdAndUpdate(
//     req.user?._id,
//     {
//       $set: {
//         fullName,
//         email: email,
//       },
//     },
//     { new: true }
//   ).select("-password");

//   return res
//     .status(200)
//     .json(new ApiResponse(200, user, "Account details updated successfully"));
// });

// const updateUserAvatar = asyncHandler(async (req, res) => {
//   const avatarLocalPath = req.file?.path;

//   if (!avatarLocalPath) {
//     throw new ApiError(400, "Avatar file is missing");
//   }

//   //TODO: delete old image - assignment

//   const avatar = await uploadOnCloudinary(avatarLocalPath);

//   if (!avatar.url) {
//     throw new ApiError(400, "Error while uploading on avatar");
//   }

//   const user = await User.findByIdAndUpdate(
//     req.user?._id,
//     {
//       $set: {
//         avatar: avatar.url,
//       },
//     },
//     { new: true }
//   ).select("-password");

//   return res
//     .status(200)
//     .json(new ApiResponse(200, user, "Avatar image updated successfully"));
// });

// const updateUserCoverImage = asyncHandler(async (req, res) => {
//   const coverImageLocalPath = req.file?.path;

//   if (!coverImageLocalPath) {
//     throw new ApiError(400, "Cover image file is missing");
//   }

//   //TODO: delete old image - assignment

//   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

//   if (!coverImage.url) {
//     throw new ApiError(400, "Error while uploading on avatar");
//   }

//   const user = await User.findByIdAndUpdate(
//     req.user?._id,
//     {
//       $set: {
//         coverImage: coverImage.url,
//       },
//     },
//     { new: true }
//   ).select("-password");

//   return res
//     .status(200)
//     .json(new ApiResponse(200, user, "Cover image updated successfully"));
// });

// const getUserChannelProfile = asyncHandler(async (req, res) => {
//   const { username } = req.params;

//   if (!username?.trim()) {
//     throw new ApiError(400, "username is missing");
//   }

//   const channel = await User.aggregate([
//     {
//       $match: {
//         username: username?.toLowerCase(),
//       },
//     },
//     {
//       $lookup: {
//         from: "subscriptions",
//         localField: "_id",
//         foreignField: "channel",
//         as: "subscribers",
//       },
//     },
//     {
//       $lookup: {
//         from: "subscriptions",
//         localField: "_id",
//         foreignField: "subscriber",
//         as: "subscribedTo",
//       },
//     },
//     {
//       $addFields: {
//         subscribersCount: {
//           $size: "$subscribers",
//         },
//         channelsSubscribedToCount: {
//           $size: "$subscribedTo",
//         },
//         isSubscribed: {
//           $cond: {
//             if: { $in: [req.user?._id, "$subscribers.subscriber"] },
//             then: true,
//             else: false,
//           },
//         },
//       },
//     },
//     {
//       $project: {
//         fullName: 1,
//         username: 1,
//         subscribersCount: 1,
//         channelsSubscribedToCount: 1,
//         isSubscribed: 1,
//         avatar: 1,
//         coverImage: 1,
//         email: 1,
//       },
//     },
//   ]);

//   if (!channel?.length) {
//     throw new ApiError(404, "channel does not exists");
//   }

//   return res
//     .status(200)
//     .json(
//       new ApiResponse(200, channel[0], "User channel fetched successfully")
//     );
// });

// const getWatchHistory = asyncHandler(async (req, res) => {
//   const user = await User.aggregate([
//     {
//       $match: {
//         _id: new mongoose.Types.ObjectId(req.user._id),
//       },
//     },
//     {
//       $lookup: {
//         from: "videos",
//         localField: "watchHistory",
//         foreignField: "_id",
//         as: "watchHistory",
//         pipeline: [
//           {
//             $lookup: {
//               from: "users",
//               localField: "owner",
//               foreignField: "_id",
//               as: "owner",
//               pipeline: [
//                 {
//                   $project: {
//                     fullName: 1,
//                     username: 1,
//                     avatar: 1,
//                   },
//                 },
//               ],
//             },
//           },
//           {
//             $addFields: {
//               owner: {
//                 $first: "$owner",
//               },
//             },
//           },
//         ],
//       },
//     },
//   ]);

//   return res
//     .status(200)
//     .json(
//       new ApiResponse(
//         200,
//         user[0].watchHistory,
//         "Watch history fetched successfully"
//       )
//     );
// });

export {
  userRegister,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};

// import { asyncHandler } from "../utils/asyncHandler.js";

// const userRegister = asyncHandler(async (req, res) => {
//   res.status(200).json({
//     message: "ok",
//     status: "success",
//     data: {
//       user: "Kaaptan",
//     },
//   });
// });

// export { userRegister };
