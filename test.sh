#!/usr/bin/env bash
set -e
echo 'clone test'
node index.js example.json
echo 'pull test'
node index.js example.json
echo 'branch clone test'
rm -rf test
node index.js -b master example.json
echo 'branch pull test'
node index.js -b master example.json
rm -rf test
