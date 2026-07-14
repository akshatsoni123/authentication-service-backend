const express = require('express');
const { authRouter } = require('../modules/auth/auth.routes');
const { usersRouter } = require('../modules/users/users.routes');
const { adminRouter } = require('../modules/users/admin.routes');

const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/admin', adminRouter);

module.exports = { apiRouter };
