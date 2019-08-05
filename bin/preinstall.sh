#!/bin/sh

case "$(uname -s)" in
  Linux)
    sudo apt-get update -y
    sudo apt-get install libsecret-1-dev -y # keytar dep
    ;;
esac
