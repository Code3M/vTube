import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken"

// Recived the information from front-end(Postman)
// check is all the field is present or not
// check username or email present or not
// check avatar and coverImage, check avatar
// upload to cloudinaty, check avatar
// store the data in db
// remove password and refreshToken from respose
// send respose 
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


export  {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}