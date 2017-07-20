#!/bin/bash -x
/bin/rm -f ${IMAGE}
/usr/bin/raspivid -w ${WIDTH} -h ${HEIGHT} -fps ${FPS} -vf -t 0 -b ${BITRATE} -o - | ffmpeg -i - -f image2 -c:v mjpeg -updatefirst 1 ${IMAGE}

