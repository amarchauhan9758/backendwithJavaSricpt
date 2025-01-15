import mongoose, { Schema } from "mongoose";
import bcrpyt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowecase: true,
      trim: true,
    },
    fullName: {
      type: String,
      requiredd: true,
      trim: true,
      index: true,
    },

    avatar: {
      type: String,
      required: true,
    },
    coverImage: {
      type: String, // cloudinary url
    },
    watchHistory: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true, versionKey: false }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrpyt.hash(this.password, 10);

  next();
});
// console.log(this?.password, "line no 58");
userSchema.methods.isPasswordCorrect = async function (password) {
  // await console.log(password, this.password, "line no 59");
  return await bcrpyt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function (id) {
  // console.log(id, this._id, "line no 65");
  // console.log(process.env.ACCESS_TOKEN_SECRET, "line no 66");
  return jwt.sign(
    {
      _id: this._id,
      username: this.username,
      password: this.password,
    },
    // `${process.env.ACCESS_TOKEN_SECRET}`,
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);
