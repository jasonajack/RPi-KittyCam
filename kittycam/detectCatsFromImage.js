// KittyDar - cat facial detection
// Note: this file and kittydar need to use the same canvas module, otherwise it failes.
// https://github.com/Automattic/node-canvas/issues/487

'use strict'

// Pull in kittydar dependency
const fs = require('fs');
const kittydar = require('./kittydar');
const Canvas = require('./kittydar/node_modules/canvas');

// When the process receives a message
process.on('message', (image) => {
  // Create a new image canvas from the raw image data
  var img = new Canvas.Image; // creating an image object
  img.src = new Buffer(image.data, 'base64');
  
  // Draw the image into the canvas
  var w = img.width;
  var h = img.height;
  var canvas = new Canvas(w, h);
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h);
  
  // Try to detect if there is a cat
  console.log(`PID ${process.pid}: received image of size ${image.data.length} and dimensions ${w}x${h}, detecting cats from image...`);
  var cats = kittydar.detectCats(canvas);
  console.log(`PID ${process.pid}: there are ${cats.length} cats in this image.`);
  
  // If we found a cat, do something
  var base64Img = '';
  if(cats.length > 0) {
    // Draw a rectangle around the detected cat's face
    ctx.strokeStyle = 'rgba(255, 64, 129, 0.8)';
    ctx.lineWidth = 2;
  
    // For each cat, draw a rectangle around it
    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i];
      console.log(`PID ${process.pid}: processing rectangle for cat ${i}: @ ${cat.x},${cat.y} dimensions ${cat.width}x${cat.height}`);
      ctx.strokeRect(cat.x, cat.y, cat.width, cat.height);
    }

    // Convert to base64 image; png by default. jpeg is currently not supported by node-canvas
    console.log(`PID ${process.pid}: converting cat image to to a base64 image buffer.`);
    base64Img = canvas.toDataURL();
  }
  
  // Send back the image data
  console.log(`PID ${process.pid}: done, sending back image to parent process.`);
  process.send(base64Img);
  
  // Clear the canvas and exit
  ctx.clearRect(0, 0, w, h);
  process.exit(0);
});

// On error, dump err log
process.on('error', (err) => { console.log(`PID ${process.pid}: child process error: ${err}`); });

