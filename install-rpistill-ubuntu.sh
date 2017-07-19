#!/bin/bash -ex
cd /tmp

# Make sure run as root
if [[ $(whoami) != 'root' ]]; then echo "error: must run as root"; exit 1; fi

# Override user
USER=${1}; shift

# Enable hardware
bash -c "echo 'start_x=1' >> /boot/config.txt"
bash -c "echo 'gpu_mem=128' >> /boot/config.txt"

# Install rpi-update
curl -L --output /usr/bin/rpi-update https://raw.githubusercontent.com/Hexxeh/rpi-update/master/rpi-update && chmod +x /usr/bin/rpi-update
sudo rpi-update

# Install userland
git clone https://github.com/raspberrypi/userland.git
cd userland
./buildme
touch ~/.bash_aliases
echo -e 'PATH=$PATH:/opt/vc/bin\nexport PATH' >> ~/.bash_aliases
echo -e 'LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/opt/vc/lib\nexport LD_LIBRARY_PATH' >> ~/.bash_aliases
source ~/.bashrc
ldconfig

# Give non-root users access
echo 'SUBSYSTEM==\"vchiq\",GROUP=\"video\",MODE=\"0660\"' > /etc/udev/rules.d/10-vchiq-permissions.rules
usermod -aG video ${USER}

# Reboot system
reboot now
