/**
 * Send success response
 */
function success(res, data = null, message = 'Operation successful', statusCode = 200, meta = undefined) {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        meta,
        timestamp: new Date().toISOString()
    });
}

/**
 * Send error response
 */
function error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    return res.status(statusCode).json({
        success: false,
        message,
        errors,
        timestamp: new Date().toISOString()
    });
}

module.exports = { success, error };
