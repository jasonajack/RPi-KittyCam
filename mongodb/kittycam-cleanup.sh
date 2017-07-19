#!/bin/bash -x

# The time in seconds for data to expire and sleep timer
TOO_OLD=604800
SLEEP=3600

# Loop forever
while [ 1 ]; do
  # Create index if it hasn't been created yet
  /usr/bin/mongo localhost:27017/kittycam -eval 'db.images.createIndex({timestamp: 1})'

  # Calculate oldest timestamp in millis
  oldest=$(date +%s)
  oldest=$(((oldest - TOO_OLD) * 1000))

  # Cull oldest entries
  /usr/bin/mongo database:27017/kittycam -eval 'db.images.remove({timestamp: {$lt: '$oldest'}})'

  # Sleep for a while
  sleep ${SLEEP}s
done

