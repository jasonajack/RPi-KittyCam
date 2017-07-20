#!/bin/bash -x
cd $(dirname ${0})/kittycam/mongodbKittydar
node mongodbKittydar.js ../../config/config.json
