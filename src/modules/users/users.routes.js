const express = require('express');

const router = express.Router();

router.get('/me', (_req, res) => {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Users routes will be implemented in upcoming issues',
    },
  });
});

module.exports = { usersRouter: router };
