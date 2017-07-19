/*
 * KittyCam
 * A Raspberry Pi app using a camera PIR motion sensor, with cat facial detection
 *
 * Tomomi Imura (@girlie_mac)
 */

'use strict'

// Pull in core modules
const fs = require('fs');
const child_process = require('child_process');
require('events').EventEmitter.prototype._maxListeners = 20;

// Read in configuration file and get name of the image that is updating in the background
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const imagefile = process.argv[3]

// Johnny-Five for RPi
const raspi = require('raspi-io');
const five = require('johnny-five');
const board = new five.Board({repl: false, io: new raspi()});

// Image update timer
const fps = config.fps; // frames per second
const timer = 1000 / fps;

// Maximum number of facial detections in parallel
var maxdetects = config.maxdetects;

// Flag to engage image copy
var inMotion = false;

// Enter loop when board starts
board.on('ready', () => {
  console.log('board is ready');

  // Create a new `motion` hardware instance.
  const motion = new five.Motion('P1-7'); //a PIR is wired on pin 7 (GPIO 4)

  // 'calibrated' occurs once at the beginning of a session
  motion.on('calibrated', () => {
    console.log('calibrated');
  });

  // Motion detected
  motion.on('motionstart', () => {
    console.log('motionstart');
    inMotion = true;
  });

  // 'motionend' events
  motion.on('motionend', () => {
    console.log('motionend');
    inMotion = false;
  });
});

// Connect to MongoDB
var MongoClient = require('mongodb').MongoClient;
var url = config.mongourl;
var mongoDb = null;
var mongoCollection = null;

// Connect using MongoClient
MongoClient.connect(url, function(err, db) {
  if (err) {
    console.log(`Failed to connect to MongoDB: ${err}`);
    process.exit(1);
  } else {
    // Use the admin database for the operation
    console.log('Connected to MongoDB');
    mongoDb = db;
    mongoCollection = db.collection('images');
  }
});

// Read the image and trigger the callback with data if successful
function readImage(callback) {
  fs.readFile(imagefile, (err, data) => {
    if (!err) {
      // Send image data to callback
      callback(data);

      // Delete the image so we don't re-upload it
      deleteImage();
    }
  });
}

// Setup interval that will copy off images taken by the raspistill running in background process
setInterval(() => {
  // If PIR has detected motion
  if (inMotion && mongoCollection) {
    readImage((image) => {
      // Capture timestamp
      var timestamp = Date.now();

      // Cat detection
      if (maxdetects > 0) {
        detectCatsFromImage(image, (newimage) => {
          console.log(`Detected at cat at timestamp ${timestamp}, updating database.`);
          mongoCollection.updateOne({'timestamp': timestamp}, {'cats-detected': true, 'image': newimage}, (err, result) => {
            if (err) { console.log(`Error when updating database: ${err}`); }
          });
        });
      } else {
        console.log('Skipping facial detection, too many child processes.');
      }

      // Insert image into MongoDB
      mongoCollection.insert({'timestamp': timestamp, 'cats-detected': false, 'image': image}, (err, result) => {
        if (err) {
          console.log(`Encountered error when writing to MongoDB: ${err}`);
        } else {
          console.log(`Wrote image to MongoDB at timestamp: ${timestamp}`);
        }
      });
    });
  }
}, timer);

// Function to detect if a cat is in an image
function detectCatsFromImage(image, callback) {
  // Spawn the detect cats node process piping the image data to it
  maxdetects--;
  var child = child_process.fork('./detectCatsFromImage.js', []);
  child.send(image);
  console.log(`Sent image of size ${image.length} to PID ${child.pid}`);

  // The child process is completed
  child.on('message', (newimage) => {
    maxdetects++;
    if (newimage) { callback(newimage); }
  });
}

// Function to delete an image
function deleteImage() {
  fs.unlink(imagefile, (err) => {
    if (err) { return console.error(err); }
  });
}

// Ctrl-C exit
process.on('SIGINT', () => {
  if (mongoDb) { mongoDb.close(); }
  process.exit();
});

