const express = require('express');
const { authenticate } = require('../../middleware/authenticate');
const usersController = require('./users.controller');

const router = express.Router();

// authenticate runs first → sets req.user, then me() reads req.user.id
router.get('/me', authenticate, usersController.me);

module.exports = { usersRouter: router };
