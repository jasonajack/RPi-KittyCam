#!/bin/bash -ex
cd $(dirname ${0})

# Copy in the MongoDB repo file
sudo cp -f mongodb/mongodb-*.repo /etc/yum.repos.d/

# Update yum and install
sudo yum update -y
sudo yum install -y mongodb-org

# Update configuration for MongoDB
sudo sed -ri /bindIp/d /etc/mongod.conf

# Copy in disable-transparent-hugepages service (optimizes MongoDB)
sudo cp -av mongodb/disable-transparent-hugepages.service /usr/lib/systemd/system
sudo systemctl daemon-reload
sudo systemctl restart disable-transparent-hugepages
sudo systemctl enable disable-transparent-hugepages
sudo systemctl status disable-transparent-hugepages || true

# Start MongoDB service and enable at boot
sudo systemctl restart mongod
sudo systemctl enable mongod
sudo systemctl status mongod || true

