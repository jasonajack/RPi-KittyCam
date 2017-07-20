#!/bin/bash -x
cd $(dirname ${0})

# Install Node.js and NPM
sudo yum update -y
sudo yum autoremove -y
sudo yum clean all
sudo yum install -y epel-release
sudo yum install -y nodejs

# Verify install
node -v
npm -v

# Install application dependencies
sudo yum groupinstall -y "Development Tools"
sudo yum install -y libjpeg-turbo libjpeg-turbo-devel cairo cairo-devel pango pango-devel giflib giflib-devel

# Install and update Node dependencies for kittydar and then for this module
git submodule update --remote --init
pushd kittycam/kittydar
yes | npm update
popd

# Copy this directory to the correct location to run kittydar as a service
if [[ $(pwd) != '/usr/local/KittyCam' ]]; then
  sudo rm -rf /usr/local/KittyCam
  sudo mkdir -p /usr/local/KittyCam
  sudo cp -av .git .gitignore * /usr/local/KittyCam
fi
sudo mkdir -p /usr/local/KittyCam /usr/lib/systemd/system
sudo cp -av kittycam/mongodbKittydar/*.service /usr/lib/systemd/system
sudo systemctl daemon-reload
sudo systemctl start mongodb-kittydar
sudo systemctl enable mongodb-kittydar

