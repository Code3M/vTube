
import 'dotenv/config'
import connectDB from './db/index.js'
/*
//Approch 1 to connect with DB
import mongoose from "mongoose";
import {DB_NAME} from "./constants.js"
import express from "express"
const app = express()
;(async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        app.on("error", (error) => {
            console.error("Error", error)
            throw error
        })
    } catch (error) {
        console.error("Error ", error)
        throw error
    }
})()
*/

connectDB()