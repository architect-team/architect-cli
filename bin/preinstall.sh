#!/bin/sh

if ! command -v docker > /dev/null 2>&1; then
  echoerr "Docker must be installed"
  exit 1
fi

if ! command -v docker-compose > /dev/null 2>&1; then
  echoerr "Docker compose must be installed"
  exit 1
fi

case "$(uname -s)" in
  Linux)
    sudo apt-get update -y
    sudo apt-get install libsecret-1-dev -y # keytar dep
    ;;
esac
