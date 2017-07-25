#!/bin/bash -ex
cd $(dirname ${0})

# Install dependencies
sudo yum install -y nodejs

# Install modules for apps
pushd kittycam-frontend-express
npm install
popd
pushd kittycam-frontend-react
npm install
popd

# Copy in and load services
sudo cp -av kittycam-frontend-*/*.service /usr/lib/systemd/system
sudo systemctl daemon-reload
sudo systemctl start kittycam-react
sudo systemctl enable kittycam-react
