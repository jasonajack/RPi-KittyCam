'use strict'

// Initialize Express Router
const express = require('express');
const router = express.Router();

// Pull in module to spawn child processes
const { exec } = require('child_process');

// GET users listing.
router.get('/', function(req, res, next) {
  // Get list of users
  exec("awk -F ':' '{print $3 \"=\" $1}' /etc/passwd", (err, stdout, stderr) => {
    // Collect users
    var users = [];
    stdout.split(/\r?\n/).forEach((userToken) => {
      var tokens = userToken.split(/=/);
      users.push({id: tokens[0], username: tokens[1]});
    });

    // Send back user objects
    if (err) {
      res.status.send('Failed to get list of users.');
    } else {
      res.send(users);
    }
  });
});

// Make the router accessible outside this module
module.exports = router;
