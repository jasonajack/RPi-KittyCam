#!/bin/bash -ex
cd $(dirname ${0})

# Update everything first
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get autoremove -y

# Install Node.js and NPM
sudo apt-get install -y nodejs npm
sudo ln -s /usr/bin/nodejs /usr/bin/node &> /dev/null || true

# Verify install
nodejs -v
npm -v

# Install application dependencies
sudo apt-get install -y libcairo2-dev libjpeg8-dev libpango1.0-dev libgif-dev build-essential g++

# Install and update Node dependencies for kittydar and then for this module
git submodule update --remote --init
pushd kittydar
yes | npm update
popd
pushd rpi
yes | npm update
popd

# Copy this directory to the correct location to run as a service
sudo rm -rf /usr/lib/KittyCam
sudo mkdir -p /usr/lib/KittyCam /usr/lib/systemd/system
sudo cp -av .git .gitignore * /usr/lib/KittyCam
sudo cp -av rpi/kittycam.service /usr/lib/systemd/system
sudo systemctl daemon-reload
sudo systemctl start kittycam
sudo systemctl enable kittycam

