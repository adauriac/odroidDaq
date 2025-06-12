#!/bin/bash -f

cd ~
node odroidDaq/node/app.js "$@" | tee trace
