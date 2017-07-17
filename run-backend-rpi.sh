#!/bin/bash -ex
cd $(dirname ${0})/rpi
node nodejs/kittyCam.js config/config.json
