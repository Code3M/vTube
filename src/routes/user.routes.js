import { Router } from "express";
import {registerUser,loginUser,logoutUser, refreshAccessToken} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";
const apiRouter = Router();

apiRouter.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

apiRouter.route("/login").post(loginUser)

apiRouter.route("/logout").post(verifyJwt, logoutUser)

apiRouter.route("/refresh-token").post(refreshAccessToken)

export { apiRouter};
