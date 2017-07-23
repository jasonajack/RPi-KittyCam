#!/bin/bash -x
cd $(dirname ${0})

# The time in seconds for data to expire and sleep timer
TOO_OLD=108000
SLEEP=600
DATABASE=$(grep url ../config/config.json | awk -F'"' '{print $4}' | sed 's,mongodb://,,')

# Loop forever
while [ 1 ]; do
  # Calculate oldest timestamp in millis
  oldest=$(date +%s)
  oldest=$(((oldest - TOO_OLD) * 1000))

  # Cull oldest entries
  mongo --quiet ${DATABASE} -eval 'db.images.remove({timestamp: {$lt: '$oldest'}})'

  # Sleep for a while
  sleep ${SLEEP}s
done

