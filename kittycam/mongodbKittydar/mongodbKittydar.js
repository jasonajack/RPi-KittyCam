/*
 * MongooDB KittyDar
 *
 * A backend service which feeds images of cats read from MongDB into a KittyDar module, and then
 * feeds the results back into MongoDB, updating the documents.
 */

'use strict'

// Pull in core modules
const fs = require('fs');
const child_process = require('child_process');
require('events').EventEmitter.prototype._maxListeners = 20;

// Read in configuration file
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
var postProcessingSleepTimer = config.postProcessingSleepTimer;
var postProcessingForks = config.maxPostProcessingForks;
var runningPostProcessing = false;

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

    // Start an endless loop timer which will read images from MongoDB and run facial
    // detection on each, updating the database as it goes
    setInterval(() => {
      // Determine if we're still running post processing, if not then run now
      if (runningPostProcessing == false && postProcessingForks == config.maxPostProcessingForks) {
        readFromDatabase();
      }
    }, postProcessingSleepTimer);
    readFromDatabase();
  }
});

// Iterates over cursors
function cursorIterator(cursor) {
  // Create function to process the data
  function processDocument(err, item) {
    // If we're done, read from the database again after sleeping, otherwise process
    if (item) {
      console.log(`Found an unprocessed image at ${item.timestamp}, processing now.`);

      // Do something with the document
      var image = new Buffer(item.image.buffer, 'base64');
      runFacialDetection(cursor, item.timestamp, image);
    } else {
      // Nothing left to do, return fork to pool
      runningPostProcessing = false;
      postProcessingForks++;
      if (postProcessingForks == config.maxPostProcessingForks) {
        console.log('Done, prompting service to query the database again when ready.');
      } else {
        console.log(`Done, waiting on ${config.maxPostProcessingForks - postProcessingForks} forks to finish.`);
      }
    }
  }

  // Process N images in parallel
  while(runningPostProcessing && postProcessingForks > 0) {
    // Process documents as fast as possible
    postProcessingForks--;
    cursor.nextObject(processDocument);
  }
}

// Read images from MongoDB and process each
function readFromDatabase() {
  console.log('Querying database for unprocessed images...');
  runningPostProcessing = true;
  postProcessingForks = config.maxPostProcessingForks;

  // Grab a cursor using the find
  mongoCollection.find({'kittydar-processed': false}, (err, cursor) => { cursorIterator(cursor); });
}

// Function to run detection on the cat image and update MongoDB
function runFacialDetection(cursor, timestamp, image) {
  detectCatsFromImage(cursor, timestamp, image, (newimage) => {
    if (newimage) {
      console.log(`Detected at cat at timestamp ${timestamp}, updating database.`);

      // Update MongoDB
      mongoCollection.updateOne(
          {'timestamp': timestamp},
          {'$set':
            {
              'cats-detected': true,
              'image': newimage
            }
          }, (err, result) => {
        if (err) { console.log(`Error when updating database: ${err}`); }
      });
    }
  });
}

// Function to detect if a cat is in an image
function detectCatsFromImage(cursor, timestamp, image, callback) {
  // Spawn the detect cats node process piping the image data to it
  var child = child_process.fork('../detectCatsFromImage.js', []);
  child.send(image);
  console.log(`Sent image of size ${image.length} to PID ${child.pid}`);

  // The child process is completed
  child.on('message', (newimage) => { callback(newimage); });
  child.on('exit', (code) => {
    console.log(`Process ${child.pid} exited with code ${code}.`);

    // Update MongoDB to reflect that we tried at least
    mongoCollection.updateOne(
        {'timestamp': timestamp},
        {'$set': {'kittydar-processed': true}}, (err, result) => {
      if (err) { console.log(`Error when updating database: ${err}`); }
    });

    // Trigger continuation of processing
    postProcessingForks++;
    cursorIterator(cursor);
  });
}

// Ctrl-C exit
process.on('SIGINT', () => {
  if (mongoDb) { mongoDb.close(); }
  process.exit();
});

