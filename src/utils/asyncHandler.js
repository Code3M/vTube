// Design a wrapper function to handle all the async/wait function.
// Also to handel DB connections as those operations are time taking task. 


// const asyncHandler = () => async (req,res,next) => {
//     try {
//         await fn(req,res,next)
//     } catch (error) {
//         res.status(error.status || 500).json({
//             success : false,
//             message : error.message
//         })
//     }
    
// }



const asyncHandler = (requestHandler) => {
 return (req,res,next) => {
    Promise.resolve(requestHandler(req,res,next)).catch((error) => next(error))
}
}

export default asyncHandler