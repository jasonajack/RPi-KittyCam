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

// Read in configuration file
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// Johnny-Five for RPi
const raspi = require('raspi-io');
const five = require('johnny-five');
const board = new five.Board({io: new raspi()});

let i = 0;

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

    // Run raspistill command to take a photo with the camera module
    let filename = 'photo/image_'+i+'.jpg';
    let args = ['-w', '320', '-h', '240', '-o', filename, '-t', '1'];
    let spawn = child_process.spawn('raspistill', args);

    spawn.on('exit', (code) => {
      console.log('A photo is saved as '+filename+ ' with exit code, ' + code);
      let timestamp = Date.now();
      i++;

      // Detect cats from photos

      if((/jpg$/).test(filename)) { // Ignore the temp filenames like image_001.jpg~
        let imgPath = __dirname + '/' + filename;

        // Child process: read the file and detect cats with KittyDar
        let args = [imgPath];
        let fork = child_process.fork(__dirname + '/detectCatsFromPhoto.js');
        fork.send(args);

        // the child process is completed
        fork.on('message', (base64) => {
          if(base64) {
            uploadToCloudinary(base64, timestamp);
          }

          // Once done, delete the photo to clear up the space
          deletePhoto(imgPath);
        });
      }

    })
  });

  // 'motionend' events
  motion.on('motionend', () => {
    console.log('motionend');
  });
});


function deletePhoto(imgPath) {
  fs.unlink(imgPath, (err) => {
    if (err) {
       return console.error(err);
    }
    console.log(imgPath + ' is deleted.');
  });
}

// Ctrl-C
process.on('SIGINT', () => {
  process.exit();
});

