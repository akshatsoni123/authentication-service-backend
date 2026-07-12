const authService = require('./auth.service');

async function register(req, res, next) {
  try {
    const data = await authService.register(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const data = await authService.verifyEmail(req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    const data = await authService.resendVerification(req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, verifyEmail, resendVerification };
