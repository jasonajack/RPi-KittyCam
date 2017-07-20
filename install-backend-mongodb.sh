#!/bin/bash -x
cd $(dirname ${0})

# Copy in the MongoDB repo file
sudo cp -f mongodb/mongodb-*.repo /etc/yum.repos.d/

# Update yum and install
sudo yum update -y
sudo yum install -y mongodb-org

# Update configuration for MongoDB
sudo sed -ri /bindIp/d /etc/mongod.conf

# Copy in service files and scripts
sudo cp -av mongodb/*.service /usr/lib/systemd/system
sudo cp -av mongodb/*.sh /usr/bin

# Start the MongoDB optimization service
sudo systemctl daemon-reload
sudo systemctl restart disable-transparent-hugepages
sudo systemctl enable disable-transparent-hugepages
sudo systemctl status disable-transparent-hugepages || true

# Start MongoDB service and enable at boot
sudo systemctl restart mongod
sudo systemctl enable mongod
sudo systemctl status mongod || true

# Start the cleanup service
sudo systemctl restart kittycam-cleanup
sudo systemctl enable kittycam-cleanup
sudo systemctl status kittycam-cleanup || true

# Create indexes
tryAndTryAgain() {
  while [ 1 ]; do
    # Run command and repeat until success
    "${@}"
    if [[ $? -eq 0 ]]; then return; fi
    sleep 1s
  done
}
tryAndTryAgain /usr/bin/mongo localhost:27017/kittycam -eval 'db.images.createIndex({"timestamp": 1})'
tryAndTryAgain /usr/bin/mongo localhost:27017/kittycam -eval 'db.images.createIndex({"kittydar-processed": 1})'
tryAndTryAgain /usr/bin/mongo localhost:27017/kittycam -eval 'db.images.createIndex({"cats-detected": 1})'

