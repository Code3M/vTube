import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken"


// Register new User
/**
 * Recived the information from front-end(Postman)
 * check is all the field is present or not
 * check username or email present or not
 * check avatar and coverImage, check avatar
 * upload to cloudinaty, check avatar
 * store the data in db
 * remove password and refreshToken from respose
 * send respose 
 */
const registerUser = asyncHandler(async (req, res) => {



    const {username, email, fullName, password} = req.body

    if ([username, email, fullName, password].some((field) => field?.trim() === "" )){
        throw new ApiError (400, "All fields are required")
    }
    const existedUser = await User.findOne({
        $or:[{ username,email }]
    })
    if(existedUser){
        throw new ApiError (400, "User alredy present")
    }
    const avatarLocalPath = req.files?.avatar[0]?.path
    //const coverImageLocalpath = req.files?.coverImage[0]?.path

    if(!avatarLocalPath)  throw new ApiError(400, "Avatar file is required")

    let coverImageLocalpath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalpath = req.files.coverImage[0].path
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalpath)
    
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    // remove password and refreshToken from respose
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )


})

// Refresh and Access Token Generator
const generateAccessAndRefreshToken = async(userId) =>{
    const user = await User.findOne(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()
    user.refreshToken = refreshToken
    await user.save({
        validateBeforeSave : false
    })
    return{ accessToken, refreshToken }
}
// user Login Creation
/*
 * Recived data from req.body
 * check username, password, email fields is present or not
 * check user is register or not 
 * check password
 * generate access and refresh token
 * set cookies for token
 * send respose (without password and refresh token)
 */  
const loginUser = asyncHandler(async (req, res) => {
        const {username, email, password} = req.body
        if(!(username || email)) {
            throw new ApiError(400, "Username or email is requied")
        }

        const user = await User.findOne({
            $or:[{username},{email}]
        })
        if(!user) {
            throw new ApiError(404, "User not register")
        }

        const isPasswordValid = await user.isPasswordCorrect(password)
        if(!isPasswordValid) {
            throw new ApiError(400, "Invalid user Credentials")
        }

        const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

        const loggedInUser = await User.findOne(user._id).select(
            "-password -refreshToken"
        )
        const options = {
            httpOnly : true,
            secure : true
        }
        res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(200,
                {
                    user : loggedInUser,
                    accessToken,refreshToken
                },
                "User logged in successfully"
                )
        )

})

// Creating logout logic
/*
 * first nedd to check user login or not (Design a middleware to check access token)
 * In middleware need to set user object so that here we can access user_id
 * remove refresh token from db
 * clear cookies from user browser.
 */
const logoutUser = asyncHandler(async (req,res) => {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $unset: {
                    refreshToken: 1 // this removes the field from document
                }
            },
            {
                new: true // It will update user reference
            }
        )

        const options = {
            httpOnly: true,
            secure: true
        }
        
        return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(new ApiResponse(200, {}, "User logged Out"))
})

// Token regeneration
const refreshAccessToken = asyncHandler(async (req,res) =>{
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

        if (!incomingRefreshToken) {
            throw new ApiError(401, "unauthorized request")
        }

        
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

//change old Password
/**
 * Retrive the old_password and new_Password fron request body
 * check old_password and new_Password present or not
 * is Password correct 
 * save 
 */
const changeCurrentPassword  = asyncHandler (async (req,res) => {
    const { oldPassword, newPassword } = req.body

    if(!oldPassword && !newPassword) {
        throw new ApiError(400 ,"Please Provied oldPassword and newPassworld")}
    
    if(oldPassword === newPassword){
        throw new ApiError(400,"Can't Use old password as new password")
    }    
    const user = await User.findById(req.user._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid Old Password")
    }

    
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

//get current User
const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})

//Update account details
const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

//update user avatar
const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    //TODO: delete old image - assignment

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

//update user Cover Image
const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    //TODO: delete old image - assignment


    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})


export  {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
    
}