#!/bin/sh

echoerr() { echo "$@" 1>&2; }

if ! command -v docker > /dev/null 2>&1; then
  echoerr "Docker must be installed"
  exit 1
fi
