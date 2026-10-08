const { validationResult, body, param, query } = require('express-validator');
const { error } = require('../utils/response');

/**
 * Handle Validation Errors Middleware
 */
function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return error(res, 'Validation failed. Please check input fields.', 400, errors.array());
    }
    next();
}

// Common Passwords Blacklist
const COMMON_PASSWORDS = [
    '123456789012', 'password123456', 'admin123456789', 'qwertyuiop12', 
    'college123456', 'administrator', 'welcome123456', '123456123456'
];

// 1. Auth Validation Rules
const loginRules = [
    body('username').trim().notEmpty().withMessage('Username is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
    body('totpCode').optional({ checkFalsy: true }).trim().isNumeric().isLength({ min: 6, max: 6 }).withMessage('2FA code must be 6 digits.')
];

const resetPasswordRules = [
    body('resetToken').notEmpty().withMessage('Reset token is required.'),
    body('newPassword')
        .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long.')
        .custom(value => {
            if (COMMON_PASSWORDS.includes(value.toLowerCase())) {
                throw new Error('This password is too common. Please choose a stronger password.');
            }
            return true;
        })
];

// 2. Student Validation Rules
const studentRules = [
    body('roll_number').trim().notEmpty().withMessage('Roll number is required.').escape(),
    body('full_name').trim().notEmpty().withMessage('Full name is required.').escape(),
    body('email').trim().isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('phone').optional({ checkFalsy: true }).trim().escape(),
    body('department_id').isInt().withMessage('Department ID must be an integer.'),
    body('semester').isInt({ min: 1, max: 10 }).withMessage('Semester must be between 1 and 10.'),
    body('enrollment_year').isInt({ min: 2000, max: 2100 }).withMessage('Valid enrollment year required.'),
    body('status').optional().isIn(['active', 'graduated', 'suspended']).withMessage('Invalid status.')
];

// 3. Faculty Validation Rules
const facultyRules = [
    body('faculty_id_num').trim().notEmpty().withMessage('Faculty ID number is required.').escape(),
    body('full_name').trim().notEmpty().withMessage('Full name is required.').escape(),
    body('email').trim().isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('phone').optional({ checkFalsy: true }).trim().escape(),
    body('department_id').optional({ checkFalsy: true }).isInt().withMessage('Department ID must be an integer.'),
    body('designation').trim().notEmpty().withMessage('Designation is required.').escape(),
    body('qualification').optional().trim().escape(),
    body('status').optional().isIn(['active', 'on_leave', 'inactive']).withMessage('Invalid status.')
];

// 4. Course Validation Rules
const courseRules = [
    body('course_code').trim().notEmpty().withMessage('Course code is required.').escape(),
    body('title').trim().notEmpty().withMessage('Title is required.').escape(),
    body('department_id').isInt().withMessage('Department ID must be an integer.'),
    body('credits').isInt({ min: 1, max: 10 }).withMessage('Credits must be between 1 and 10.'),
    body('semester').isInt({ min: 1, max: 10 }).withMessage('Semester must be between 1 and 10.'),
    body('faculty_id').optional({ checkFalsy: true }).isInt().withMessage('Faculty ID must be an integer.'),
    body('description').optional().trim().escape()
];

// 5. Notice Validation Rules
const noticeRules = [
    body('title').trim().notEmpty().withMessage('Notice title is required.').escape(),
    body('category').isIn(['academic', 'examination', 'event', 'admission', 'general']).withMessage('Invalid category.'),
    body('content').trim().notEmpty().withMessage('Notice content is required.'),
    body('target_audience').isIn(['all', 'students', 'faculty', 'staff']).withMessage('Invalid target audience.'),
    body('priority').isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority.'),
    body('expiry_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid expiry date format.')
];

// 6. Application Review Rules
const applicationReviewRules = [
    body('status').isIn(['approved', 'rejected', 'under_review']).withMessage('Invalid status.'),
    body('reviewer_notes').optional().trim().escape()
];

module.exports = {
    handleValidation,
    loginRules,
    resetPasswordRules,
    studentRules,
    facultyRules,
    courseRules,
    noticeRules,
    applicationReviewRules
};
