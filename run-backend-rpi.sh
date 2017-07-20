#!/bin/bash -x
cd $(dirname ${0})/kittycam

# Run image capture in the background
raspistill -w 400 -h 300 -q 10 -o /tmp/kittycam.jpg -tl 100 -t 0 -th 0:0:0 -rot 270 -n &> /dev/null &
PID=$!

# Setup trap handler
handler() {
  # Kill background raspistill process
  kill -s SIGINT ${PID} ;

  # Kill all spawn processes
  sudo kill -s SIGINT $(ps -aef | grep 'node' | grep detectCats | grep -v grep | awk '{print $2}')
}
trap handler SIGINT SIGTERM SIGQUIT SIGHUP EXIT

# Run Kitty Cam
sudo node kittyCam.js ../config/config.json /tmp/kittycam.jpg

