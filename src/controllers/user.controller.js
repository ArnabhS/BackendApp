import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js"
import {User} from "../models/user.model.js";

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation- not empty
    // check if user exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return response

   const {fullName, email, username, password}= req.body;
   console.log(fullName, email, username, password);

  if (
    [fullName, email, username, password].some((field)=> field?.trim() === "")
  ) {
    throw new ApiError(400, "Please fill in all fields");
  }

 const existedUser= User.findOne({
    $or:[{ email },{ username }]
  })
  console.log(existedUser);
  if(existedUser){
    throw new ApiError(409, "User already exists");
  } 

  const avatarLocalPath= req.files?.avatar[0]?.path;
  const coverImageLocalPath= req.files?.coverImage[0]?.path;
  console.log(avatarLocalPath, coverImageLocalPath);

});

export { registerUser };