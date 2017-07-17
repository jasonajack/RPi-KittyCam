#!/bin/bash -ex
cd $(dirname ${0})/rpi
sudo node nodejs/kittyCam.js config/config.json
