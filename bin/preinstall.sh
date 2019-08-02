#!/bin/sh 

case "$(uname -s)" in
  Linux)
    sudo apt-get update
    sudo apt-get -y install libsecret-1-dev # keytar dep
    ;;
esac
