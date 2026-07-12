const express = require('express');
const { validate } = require('../../middleware/validate');
const { registerBodySchema } = require('./auth.validation');
const authController = require('./auth.controller');

const router = express.Router();

router.post('/register', validate({ body: registerBodySchema }), authController.register);

module.exports = { authRouter: router };
