const express = require('express');
const { authRouter } = require('../modules/auth/auth.routes');
const { usersRouter } = require('../modules/users/users.routes');

const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);

module.exports = { apiRouter };
