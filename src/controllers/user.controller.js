import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import  jwt  from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    }
    catch (error) {
        throw new ApiError(500, "Token generation failed");
    }
}

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

    const { fullName, email, username, password } = req.body;
    console.log(fullName, email, username, password);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "Please fill in all fields");
    }

    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    })
    console.log(existedUser);
    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    console.log(avatarLocalPath, coverImageLocalPath);

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(500, "Avatar upload failed");
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "User creation failed");
    }

    return res.status(201).json(
        new ApiResponse(201, "User created successfully", createdUser)
    )

});

const loginUser = asyncHandler(async (req, res) => {
    //get data from front-end (req -> body)
    // username or email
    //validation (not empty)
    //check if user exists(find user)
    //check if password is correct
    //generate token
    //send cookie
    //send response

    const { email, username, password } = req.body;

    if (!(email || username)) {
        throw new ApiError(400, "Username or email is required");
    }

    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    const user = await User.findOne({
        $or: [{ email, username }]
    })

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id);
    select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
                "User Logged in Succesfully"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {
    //clear cookies
    //send response
    await User.findByIdAndUpdate(req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    );
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out successfully")
        )

})

const refreshAccessToken = asyncHandler(async (req, res) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

   try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
 
    const user = await User.findById(decodedToken?._id)
    if(!user){
     throw new ApiError(401, "Invalid refresh token")
     }
 
     if(incomingRefreshToken !== user?.refreshToken ){
         throw new ApiError("401", "refresh token expired or used")
     }
 
     const options={
         httpOnly:true,
         secure:true
     }
 
    const { accessToken, newrefreshToken } = await generateAccessAndRefreshToken(user._id)
    
     return res
     .status(200)
     .cookie("accessToken",accessToken, options)
     .cookie("refreshToken",newrefreshToken, options )
     .json(
         new ApiResponse(
             200,
             { accessToken, newrefreshToken},
             "Access token refreshed"
             )
     )
   } catch (error) {
     throw new ApiError(401, error?.message || "invlaid token" )
   }
})

const changeCurrentPassword= asyncHandler(async( req , res )=>{
    const { oldPassword , newPassword, confirmPassword }= req.body;
    const user = await User.findById(req.user?._id)
   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

        
   if(!isPasswordCorrect){
    throw new ApiError(401, "Invalid Password")
   }

   user.password= newPassword
   await user.save({validateBeforeSave: false})

   if(!(confirmPassword === newPassword)){
    throw new ApiError(401, "Password does not match")
   }

   return res
   .status(200)
   .json( new ApiResponse(200,{},"Password changed succesfully"))
})

const  getCurrentUser=asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse
        (200, req.user , "current user fetched succesfully"))
})

const updateAccountDetails= asyncHandler(async(req, res)=>{
    const { fullName, email }= req.body
    if(!(fullName || email)){
        throw new ApiError(400,"All fields are required");
    }

  const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {new: true}
        
        ).select("-password")

        return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated"))    
})

const updateUserAvatar= asyncHandler(async(req, res)=>{
   const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file missing");
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(404,"Error while uplaoding")
    } 
    
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
        $set:{
            avatar: avatar.url
        }
    },
    {new: true }
   ).select("-password")

   res
   .status(200)
   .json(
      new ApiResponse(200, user, "Avatar updated")
   )
})

const updateUserCoverImage= asyncHandler(async(req, res)=>{
    const coverImageLocalPath = req.file?.path;
 
     if(!coverImageLocalPath){
         throw new ApiError(400, "Cover Image file missing");
     }
 
     const coverImage= await uploadOnCloudinary(coverImageLocalPath)
 
     if(!coverImage.url){
         throw new ApiError(404,"Error while uplaoding")
     } 
     
    const user= await User.findByIdAndUpdate(
     req.user?._id,
     {
         $set:{
            coverImage: coverImage.url
         }
     },
     {new: true }
    ).select("-password")
     
     res
     .status(200)
     .json(
        new ApiResponse(200, user, "Cover image updated")
     )

 })

const getUserChannelProfile=asyncHandler(async(req,res)=>{
   const {username}= req.params;

   if(!username?.trim){
    throw new ApiError("400", "usrname missing");
   }

   const channel = await User.aggregate([
    {
        $match:{
            username: username?.toLowerCase()
        }
    },
    {
        $lookup:{
            from:"subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {
        $lookup:{
            from:"subscriptions",
            localField: "_id",
            foreignField: "subscribers",
            as: "subscribedTo"
        }
    },
    {
        $addFields:{
            subscibersCount:{
                $size: "$subscribers"
            },
            channelsSubscribedToCount:{
                $size: "$subscribedTo"
            },
            isSubscribed:{
                $condition: {
                    if: {$in: [req.user?._id, "subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        }
    },
    {
        $project:{
            fullName: 1,
            username: 1,
            subscibersCount:1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1,
            email: 1
    }
    }
   ])

   if(!channel.length){
        throw new ApiError(404, "channel does not exists");
   }
  
   return res
   .status(200)
   .json(
    new ApiResponse(200, channel[0], "user channel fetched succesfull")
   )
})


export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile };