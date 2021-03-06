# WORK IN PROGRESS

![Work-In-Progress](WIP.png)

Everything below is still a work in progress.

# SmartPi Case

Modified the original model [girliemac/RPi-KittyCam](https://github.com/girliemac/RPi-KittyCam) as follows:

1. Used the SmartiPi case ([LEGO compatible SmartiPi Raspberry Pi B+,2, and 3 w/ camera case and GoPro compatible mount – Gray](http://a.co/c6ul3AQ)) and assembled with Pi and Camera board module.

1. Followed instructions found for [Lego PIR Housing](http://www.instructables.com/id/Lego-PIR-Housing/) (instructables member [tocsik](http://www.instructables.com/member/tocsik/)) to build the PIR housing and mount to SmartiPi case.

1. Used GoPro grab bag of mounts to mount the chassis to the wall: [GoPro Grab Bag](http://a.co/j6OIIT2)

# Rearchitected Model

The system architecture was changed in the following ways from the original design to store the image data into a MongoDB service, and now includes a frontend web service to view the data.  You can scroll back through history to review image captures in the past, or monitor current image captures in a live feed.

Some highlights include:

1. Reconfigured to use [Ubuntu on Raspberry Pi](https://ubuntu-mate.org/raspberry-pi/).

1. Images are uploaded to a private MongoDB service running on another server, the URL is stored in a configuration file.

1. The system model consists of the Raspberry Pi backend service, the MongoDB service on another server, a MongoDB/KittyDar image post-processing service, and the NodeJS/ReactJS frontend web service.

1. The images are stored in MongoDB with timestamps and metadata, and stores image data regardless of whether or not a cat is present in the image (unprocessed images are processed later by the post-processing service).

1. Rearchitected `kittyCam.js` to not call `raspistill` directly.  Instead, `raspivid` is run as a background service that updates `/tmp/kittycam.jpg` at regular intervals.  The `kittyCam.js` process will read those images when motion is detected, which avoids having to spawn off the process from within NodeJS.  This was done to be a faster frames per second read of the camera device, but also because the camera takes a while after `raspistill` starts to focus and auto-adjust the brightness and contract.  This yields better resolution images at a 30 frames per second recording rate.

1. Added a configuration file `kittycam/systemd.conf` which gets read into the background services when they are run.  These values can be tweaked to change the resolution of the images, how fast they are taken, any rotation operation done to them prior to processing, and so on.

1. Refactored system architecture to have the server backend run a "image post processing daemon".  This daemon will run continuously, finding images in MongoDB that haven't been processed through KittyDar yet.  Those it finds it forks off to KittyDar processes which will feed back updated image data.  When the forks close the daemon will update MongoDB indicating that it finished running the processor, and if there is image data it will feed the new image back to the database.  Testing indicates that it can process images much faster (using a Core i7-6850K system instead of RPi's ARM quad core) and can process up to 6 images per second (instead of one every 10 or so seconds) at a higher image size (increased size to 800x600 in testing).

The benefit to storing in a MongoDB service is that the image data can be processed by a server outside of the RPi, which has been proven to be more efficient.  Furthermore, no online services are needed to upload the image data for later viewing.  However, you will need to setup the MongoDB and KittyDar image post-processing services on another server.

I recommend installing the frontend service on the same server that is running the MongoDB server to optimize performance.

# Install Raspberry Pi Backend Service

The backend service that runs the image captures and sends the data off to the MongoDB server runs on the Raspberry Pi.  It is forked from the [girliemac/RPi-KittyCam](https://github.com/girliemac/RPi-KittyCam) project and uses the [harthur-org/kittydar](https://github.com/harthur-org/kittydar) project to run kitty facial recognition.

Follow the steps below to install the backend service to a fresh Raspberry Pi:

1. Install [Ubuntu on Raspberry Pi](https://ubuntu-mate.org/raspberry-pi/) using the process described in the guide.  

1. Next, install Git as follows:

    ```bash
    sudo apt-get update -y
    sudo apt-get upgrade -y
    sudo apt-get autoremove -y
    sudo apt-get install -y git
    ```

1. Then clone this repository recursively (e.g. `git clone git@github.com:jasonajack/RPi-KittyCam.git --recursive`).

1. Install the backend service to the Raspberry Pi, run the installer script:

    ```bash
    ./install-backend-rpi.sh
    ```
    
    _NOTE: This will build and install all dependencies, and install `systemd` services to run the KittyCam at boot._

1. Change run-level to not boot the graphical user interface (saves resources):

    ```bash
    sudo systemctl set-default multi-user.target
    ```

1. Configure the WPA Supplicant service for your `wlan0` device to enable connecting to a WiFi network on boot:

    _NOTE: If you don't use WPA Supplicant, Ubuntu forces you to use it's horrible NetworkManager service which forces you to login first before it connects to WiFi; so we swap out NetworkManager for WPA Supplicant which connects automatically at boot time._

    1. Modify the network interfaces configuration file (`sudo vim /etc/network/interfaces`) and append the following to the file:

        ```bash
        # Setup wlan0
        #auto wlan0
        allow-hotplug wlan0
        iface wlan0 inet dhcp
        wpa-conf /etc/wpa_supplicant/wpa_supplicant.conf
        iface default inet dhcp
        ```

    1. Create the new `wpa_supplicant.conf` file (`sudo vim /etc/wpa_supplicant/wpa_supplicant.conf`):

        ```bash
        country=US
        ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
        update_config=1

        network={
          ssid="WirelessRouterName"
          psk="secretpassword"
          key_mgmt=WPA-PSK
        }
        ```

        _NOTE: The password is in plain text, which isn't usually good (and for some reason, password hashes didn't work for me), but you can protect the file so only `root` can read it, which should be good enough._

    1. Protect your password by making the file read-only by `root` user exclusively:  `sudo chmod go-rw /etc/wpa_supplicant/wpa_supplicant.conf`

    1. Enable the WPA supplicant service:

        ```bash
        sudo systemctl start wpa_supplicant
        sudo systemctl enable wpa_supplicant
        ```

    1. Stop and disable the NetworkManager service, because it interferes with the WPA Supplicant service:

        ```bash
        sudo systemctl stop NetworkManager
        sudo systemctl disable NetworkManager
        ```

    1. Test by rebooting and then checking `ip addr`:

        ```bash
        sudo reboot now

        ### After reboot...
        ip addr
        ```

The `config/config.json` file controls various properties of the Raspberry Pi backend KittyCam service.  These are described below:

* `fps`: The frames per second to grab from the video stream and store to MongoDB. This value is typically one half that of the `FPS` value in the `kittycam/systemd.conf` environment file.
* `detectionEnabled`: Controls whether or not the RPi should fork images to KittyDar for post processing.  This is set to `false` by default since the post processor (described below) does this anyway.  Should you not want to use the post processor, you can set this to `true`.

Furthermore, the services pull in environment variables to control various features of the image capture.  To set these, modify `kittycam/systemd.conf`:

* `WIDTH`: The width of the images to capture.
* `HEIGHT`: The height of the images to capture.
* `ROTATION`: The number of degrees to rotate the image (depends on how you orient your camera).
* `IMAGE`: Not worth setting; this controls where the temporary images are written before they are stored to MongoDB.
* `CONFIG`: The location of the configuration file; usually not worth changing.
* `FPS`: The frames per second that `raspivid` uses to write JPG files to the location specified by `IMAGE`.
* `BITRATE`: The video bitrate to use in `raspivid`.

If you set any of these values, restart your KittyCam service:

```bash
sudo systemctl restart kittycam
```

# Install MongoDB Service

Follow the steps below to install another server (i.e. desktop server) with MongoDB:

1. Install CentOS 7 on a desktop server or in a Virtual Machine: [CentOS Homepage](https://www.centos.org/)

1. Install Git so you can clone the repository:

    ```bash
    sudo yum update -y
    sudo yum install -y git
    ```

1. Then clone this repository recursively (e.g. `git clone git@github.com:jasonajack/RPi-KittyCam.git --recursive`).

1. Edit the `mongodb/kittycam-cleanup.sh` script and adjust the `TOO_OLD` value to your liking, which configures how long to store image data in the database before it gets deleted. (_NOTE: Default is 30 hours._)

1. Run the installer script, which installs and configures MongoDB optimally, and installs a background process which deletes old data (configurable in `mongodb/kittycam-cleanup.sh`).

    ```bash
    ./install-backend-mongodb.sh
    ```

    _NOTE: I used a CentOS 7 distrobution for this, but if you are using a Debian-based distribution like Mint or Ubuntu then you might have to change the Yum calls to Apt._

1. Run the installer script to run the installer for the MongoDB/KittyDar service.  This service will read unprocessed images from MongoDB and process them through the KittyDar service.  _WARNING: This typically maxes out your CPU on that box, depending on how many forks you allow it to create._

    ```bash
    ./install-backend-kittydar.sh
    ```

    _NOTE: I ran this on the same server as MongoDB, but you can run it on any server you prefer. Simply modify the `config/config.json` file to point to the correct MongoDB server location and configure the number of forks it is allowed to create._

The `config/config.json` file controls various properties of the backend services.  These are described below:

* `mongourl`: The URL of the MongoDB server.
* `postProcessingSleepTimer`: The number of milliseconds to sleep after finishing a processing scan before it queries the database again for more unprocessed images.
* `maxPostProcessingForks`: This should be set to the number of available cores to maximize the throughput of processing images through Kittydar.

If you modify any of these values, be sure to restart the services after:

```bash
sudo systemctl restart mongodb-kittydar
```

# Install Frontend Service

If you are using the same CentOS server as the one running MongoDB then there is no need to setup the operating system again.  Otherwise, install a new server elsewhere or build a new Virtual Machine.

On the server you want to run the NodeJS/ReactJS frontend, run the installer script:

```bash
./install-frontend-nodejs.sh
```

---

_Sections below are preserved from the original content._

---

# Raspberry Pi KittyCam

**Updated: Tutorial is now available on my blog, [KittyCam - Building a Raspberry Pi Camera with Cat Face Detection in Node.js](http://www.girliemac.com/blog/2015/12/25/kittycam-raspberrypi-camera-cat-face-recog-nodejs/), also 
[Upgrading KittyCam with Raspberry Pi 3](http://www.girliemac.com/blog/2016/06/13/kittycam-update-with-raspberrypi3/)
**

---

[![Jamie on YouTube](https://raw.githubusercontent.com/girliemac/RPi-KittyCam/master/photo/extra/youtube.jpg "Jamie on YouTube")](https://www.youtube.com/watch?v=wqewhjhjaHY)

[Watch the demo on YouTube :-)](https://www.youtube.com/watch?v=wqewhjhjaHY)

![RPi KittyCam](https://lh3.googleusercontent.com/o-XG7ZijXM_UXQHuYrDxC6mlTofyUzUCmHqNmr6oRYZk=w1346-h757-no "Rapsberry Pi KittyCam")

![RPi KittyCam](https://lh3.googleusercontent.com/UuKlrNQWs5wFciRqI8qiZKTVoh4XrTBa40LD5mUa5MIn=w1346-h757-no "Rapsberry Pi KittyCam")

Raspberry Pi app using a camera and PIR motion sensor, written in Node.js using Johnny-Five and KittyDar for  with cat facial detection.

**I will write up the step-by-step tutorial (hopefully) soon!** But until then, here is the instruction how to run this code locally with your own Raspberry Pi.

## Building the Circuit

### What you need

- Raspberry Pi 2 (with Raspbian. Also with WiFi adapter)
- 5MP Camera Board Module ([buy](http://amzn.to/1pg7Y91))
- Pyroelectric Infrared (PIR) motion sensor ([buy](http://amzn.to/1pg828D))
- 3 F/F wires ([buy](http://amzn.to/1Mf50Xy))

If you are a Raspberry Pi newbie, I recommend to buy this [CanaKit Raspberry Pi 2 Complete Starter Kit](http://amzn.to/1QNFlcB).

### Wiring

#### Camera to Pi
- Connect the camera module to the CSI port

#### PIR Sensor to Pi
- 1 red wire: PIR-VCC to Pi's 5V
- 1 black wire: PIR-GND to Pi's ground
- 1 whatever color wire: PIR-OUT to Pi's Pin 7 (GPIO 4)

![RPi PIR](https://lh3.googleusercontent.com/vInXgXGKPueI2J4zq88BgUJOkcXgJCvReVT4kA2K1A16=w1424-h801-no "Rapsberry Pi 2, camera, and PIR wired")

## Software Setup

### 1. Install node.js in your Raspberry Pi

#### Make sure your Pi is up-to-date

`$ sudo apt-get update`

then

```
$ sudo apt-get upgrade
```

#### [Updated] Download Node

Node for ARM is now supported officially on Nodejs.org! Download and install from there:

```bash
$ wget https://nodejs.org/dist/v4.4.5/node-v4.4.5-linux-armv7l.tar.xz
$ tar -xvf node-v4.4.5-linux-armv7l.tar.xz 
$ cd node-v4.4.5-linux-armv7l
$ sudo cp -R * /usr/local/
```

Check if node is successfully installed:

```
$ node -v
```

### 2. Enable Camera access

Go to Pi Software Config Tool to enable camera

```
$ sudo raspi-config
```

Test if your camera is working by try typing this command on terminal:

```
$ raspistill -o photo.jpg
```


## Running this Code

I would like to say, `$ npm install` to install all the dependencies, and voilà! but it is **not**!

### 1. Prerequisite: Install Cairo to the System

for cat facial detection, I am using **kittydar**, which dependencies including **node-canvas**, which requires **Cairo**.

So let's get Cairo on your Raspbian first.

```
$ sudo apt-get install libcairo2-dev libjpeg8-dev libpango1.0-dev libgif-dev build-essential g++
```

See more info on how to install Cairo for Node [Canvas](https://github.com/Automattic/node-canvas), see this [*Installation Ubuntu and other Debian based systems*](https://github.com/Automattic/node-canvas/wiki/Installation---Ubuntu-and-other-Debian-based-systems)

If you download and use the whole `node_modules` contents of this repo, skip the step 2, and proceed to step 3.
Otherwise, go to the next step to fresh-install the next several modules.


### 2. Install Dependency Modules

#### Install KittyDar

![Jamie detected](https://raw.githubusercontent.com/girliemac/RPi-KittyCam/master/photo/extra/jamie-detected.png "Jamie detected by KittyDar")

*This is an actual photo taken by my Raspberry Pi, while Jamie was eating, and detected by KittyDar cat facial detection!*


Once your environment is set up, in this RPi-KittyCam dir, install node dependency modules.

Ideally install from `npm install kittydar —save`

However, node-canvas 1.0.1 (the version specified in package.json for KittyDar) failed to build with the current Node.js (v0.12.6).

So what I did was download the zip from github repo into *node_modules*, alter the `package.json`, where canvas: `~1.0.1` to `^1.0.1` so that the latest v1.x canvas will be installed as I `npm install` from the kittydar directory.

Get the zip from [my forked repo](https://github.com/girliemac/kittydar).

*Note: I am sending a pull request (https://github.com/harthur/kittydar/pull/27)*

The following packages are specified in`package.json` file so they will be installed from `npm install` automatically, however, I just list them in case you want to know what they are:

#### Install Johnny-Five

[Johnny-Five](https://jonny-five.io) is a Javascript robotics framework that let you program micro controllers easily with carious hardware APIs.

```
$ npm install johnny-five
```

#### Install Raspi-io

This I/O plugin allows you to use Johnny-Five on Raspbian. 

```
$ npm install raspi-io
```

#### Install PubNub

This is used to establish real-time live-updating the web interface, use PubNub (v3.x, imcompatible with the new v4).

```
$ npm install pubnub@3.15.2
```

You need to [sign up and get you own publish and subscribe keys!](http://pubnub.com)

#### Install Cloudinary

To store photos in a cloud, I am using Cloudinary.

```
$ npm install cloudinary
```

You need to [sign up and get you own API keys!](http://cloudinary.com)

### Install Nexmo [New feature! Aug 30, 2016]

To send a SMS message with the Cloiudinary image link to your phone, use Nexmo SMS API.

```
$ npm install nexmo
```

You need to [sign up and get your own keys!](https://dashboard.nexmo.com/sign-up)

![SMS via Nexmo](https://raw.githubusercontent.com/girliemac/RPi-KittyCam/master/photo/extra/nexmo-sms-cat-detected.png "A kitty cat detected! Send SMS via Nexmo")

### 3. Set up your config.js with Credentials

I removed my `config.js` file from the public repo so nobody abuses my API keys. So you need to create your own `config.js` in the root dir of the app. 

The file should include your API keys:

```
module.exports = {

  cloudinary: {
    cloud_name: 'your_name',
    api_key: 'your_API_key',
    api_secret: 'your_API_secret',
  },
  pubnub: {
    subscribe_key: 'your_sub_key',
    publish_key: 'your_pub_key'
  },
  nexmo: {
    api_key: 'your_API_key',
    api_secret: 'your_API_secret',
    fromNumber: 'your_Nexmo_phone_number',
    toNumber: 'your_mobile_phone_number' 
  }

};
```

Nexmo's phone number should begin with a country code. e.g. '14155551234'.

### 4. Run the Code

You must run with sudo, because some modules used in the app requires root access:

```
$ sudo node kittyCam.js
```

The camera will take a photo when a motion is detected by the PIR sensor.
Then the child_process runs to detect if there is any cats in the photo.
When there are any cat, it sends the photo to Cloudinary.

Analyzed photos are deleted from the filesystem to clear up Pi.

### 5. View the Live Photo Update on Web

- Get the web interface source code from `gh-pages` branch.
- Run the `index.html` on browser


## Known Issue

### Raspistill (Camera Software)
- Raspistill continuously takes a bunch of photos when I set `t = 0` (and crashes Pi while so many child process is running) so I have set `t = 1`, which causes delay. It seems to take only integer. Cats are too fast to wait for a second. 
- The camera can't capture recognizable pics after the sun is set. My room light is too dark.

### KittyDar (Cat Facial Detection)

- During mealtime. When a cat is eating food (head-down position), the facial detection doesn't detect the cat at all.
- When my cat moves, eats from the side of the dish, or put his butt on the camera, it fails to tell me my cat was eating.

#### The cat photos failed to be recognized

![Jamie undetected](photo/extra/image_14.jpg "Jamie undetected")
![Jamie undetected](photo/extra/image_24.jpg "Jamie undetected")
![Jamie undetected](photo/extra/image_150.jpg "Jamie undetected")
![Jamie undetected](photo/extra/image_166.jpg "Jamie undetected")
![Upside-down Jamie undetected](photo/extra/image_311.jpg "Jamie undetected")

