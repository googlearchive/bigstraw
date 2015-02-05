#!/usr/bin/env bash
#
# @license
# Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
# This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
# The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
# The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
# Code distributed by Google as part of the polymer project is also
# subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
#
set -e
rm -rf test

echo 'clone test'
node index.js example.json
[ -d test/bigstraw ] || exit 1
echo 'pull test'
node index.js example.json
echo 'branch clone test with -b'
rm -rf test
node index.js -b master example.json
[ -d test/bigstraw ] || exit 1
echo 'branch pull test with -b'
node index.js -b master example.json
rm -rf test
echo 'branch clone in config'
node index.js branch.json
[ -e test/bigstraw/TESTINGFILE ] || exit 1
echo 'branch pull in config'
node index.js branch.json
[ -e test/bigstraw/TESTINGFILE ] || exit 1
rm -rf test
echo 'clone with :: syntax test'
node index.js coloncolon.json
[ -d test/firebase ] || exit 1
echo 'pull with :: syntax test'
node index.js coloncolon.json
rm -rf test
echo 'branch clone with -b and :: syntax test'
node index.js -b master coloncolon.json
[ -d test/firebase ] || exit 1
echo 'branch pull with -b and :: syntax test'
node index.js -b master coloncolon.json
echo 'test -s + --no-s'
node index.js notssh.json -s --no-s
[ -d test/polymer ] || exit 1
REMOTE=$(GIT_DIR="test/polymer/.git" git config --get remote.origin.url)
[ $REMOTE = "https://github.com/Polymer/polymer.git" ] || exit 1

rm -rf test
