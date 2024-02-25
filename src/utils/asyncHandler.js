const asyncHandler=(requestHandler)=>{
     async (req, res, next) => {
       Promise.resolve(requestHandler(req, res, next)).catch((err)=>next(err));
    }   
}






export {asyncHandler};