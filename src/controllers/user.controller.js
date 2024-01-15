import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


const registerUser = asyncHandler(async (req, res) => {
// Recived the information from front-end(Postman)
// check is all the field is present or not
// check username or email present or not
// check avatar and coverImage, check avatar
// upload to cloudinaty, check avatar
// store the data in db
// remove password and refreshToken from respose
// send respose 


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



export default registerUser