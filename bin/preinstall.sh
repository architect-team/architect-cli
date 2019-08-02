#!/bin/sh 

case "$(uname -s)" in
  Linux)
    apt-get update
    sudo apt-get -y install libsecret-1-dev # keytar dep
    ;;
esac
