#!/bin/bash -x

# The time in seconds for data to expire and sleep timer
TOO_OLD=108000
SLEEP=600

# Loop forever
while [ 1 ]; do
  # Calculate oldest timestamp in millis
  oldest=$(date +%s)
  oldest=$(((oldest - TOO_OLD) * 1000))

  # Cull oldest entries
  /usr/bin/mongo database:27017/kittycam -eval 'db.images.remove({timestamp: {$lt: '$oldest'}})'

  # Sleep for a while
  sleep ${SLEEP}s
done

