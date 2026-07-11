/**
 * Auth module placeholders — implemented in later issues (#06–#11).
 * Layering: routes → controller → service → repository
 */

const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Auth routes will be implemented in upcoming issues',
    },
  });
});

module.exports = { authRouter: router };
