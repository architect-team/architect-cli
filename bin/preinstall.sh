#!/bin/bash 

case "$(uname -s)" in
   Linux)
     sudo apt-get -y install libsecret-1-dev # keytar dep
     ;;
esac
