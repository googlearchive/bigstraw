#!/usr/bin/env bash
set -e
rm -rf test
echo 'clone test'
node index.js example.json
[ -d test/bigstraw ] || exit 1
echo 'pull test'
node index.js example.json
echo 'branch clone test'
rm -rf test
node index.js -b master example.json
[ -d test/bigstraw ] || exit 1
echo 'branch pull test'
node index.js -b master example.json
rm -rf test
echo 'clone with :: syntax test'
node index.js coloncolon.json
[ -d test/firebase ] || exit 1
echo 'pull with :: syntax test'
node index.js coloncolon.json
rm -rf test
echo 'branch clone with :: syntax test'
node index.js -b master coloncolon.json
[ -d test/firebase ] || exit 1
echo 'branch pull with :: syntax test'
node index.js -b master coloncolon.json
rm -rf test
