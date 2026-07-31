const express = require('express');
const asyncHandler = require('../../../shared/asyncHandler');
const auth = require('../../../middlewares/auth.middleware');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/registro', asyncHandler(controller.registro));
router.post('/login', asyncHandler(controller.login));
router.get('/me', auth, asyncHandler(controller.me));

module.exports = router;
