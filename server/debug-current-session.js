// Quick debug route to see current user info
const express = require('express');
const { authenticateToken } = require('./auth');

const debugRouter = express.Router();

debugRouter.get('/debug/whoami', authenticateToken, (req, res) => {
    res.json({
        user: req.user,
        timestamp: new Date().toISOString(),
        message: 'Current authenticated user info'
    });
});

module.exports = debugRouter;