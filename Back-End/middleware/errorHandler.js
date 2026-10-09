export const errorHandler = (err, req, res, next) => {
    console.error("GLOBAL ERROR HANDLER:", err);
    
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
    
    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        error: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
};
