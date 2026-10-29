export const errorHandler = (err, req, res, next) => {
    if (err?.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400 && "body" in err)) {
        return res.status(400).json({
            success: false,
            message: "Malformed JSON payload in request body."
        });
    }

    console.error("GLOBAL ERROR HANDLER:", err);
    
    const statusCode = err.status || err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
    
    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        error: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
};
