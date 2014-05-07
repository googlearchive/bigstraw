/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

var async = require('async');
var colors = require('colors');
var fs = require('fs');
var nopt = require('nopt');
var path = require('path');
var spawn = require('child_process').spawn;

var EOL = require('os').EOL;

// default to https
var ACCESS = 'https://';
// default to 30 concurrent checkous
var JOBS = 30;

// global array of clone/update failures
// report these at the end
var failed = [];

var options = nopt(
  {
    'ssh': Boolean,
    'jobs': Number,
    'help': Boolean
  },
  {
    '-s': ['--ssh'],
    '-j': ['--jobs'],
    '-?': ['--help'],
    '-h': ['--help']
  }
);

var configFiles = options.argv.remain;

if (!configFiles.length || options.help) {
  console.log([
    'bigstraw: get all the repos, fast',
    '',
    'Usage:',
    '  bigstraw [OPTIONS] <json file>*',
    '',
    'Options:',
    '  --ssh, -s: Use ssh keys for push/pull access',
    '  --jobs #, -j #: Number of concurrent git operations (Default ' + JOBS + ')',
    '  --help, -h: Print this message'
  ].join(EOL));
  process.exit();
}

if (options.jobs > 0) {
  JOBS = options.jobs;
}

if (options.ssh) {
  ACCESS = 'ssh://';
}

function cloneOrUpdate(repo, callback) {
  fs.exists(repo.to, function(result) {
    if (result) {
      update(repo, callback);
    } else {
      clone(repo, callback);
    }
  });
}

function gitWrapper(repo, args, cwd, callback) {
  var git = spawn('git', args, {cwd: cwd, stdout: 'ignore'});
  var operation = args[0];
  // print a nice status message "=== pull foo ==="
  var sides = '==='.blue;
  console.log(sides, operation.bold.blue, path.basename(repo.to, '.git').bold, sides);
  var errData = [];
  git.stderr.on('data', function(data) {
    errData.push(String(data));
  });
  git.on('close', function(code) {
    if (code !== 0) {
      failed.push({
        operation: operation,
        reason: errData.join(EOL),
        repo: repo
      });
    }
    callback();
  });
}

function update(repo, callback) {
  async.series([
    async.apply(gitWrapper, repo, ['pull', '--rebase'], repo.to),
    async.apply(gitWrapper, repo, ['submodule', 'update', '--init', '--recursive'], repo.to)
  ], callback);
}

function clone(repo, callback) {
  gitWrapper(repo, [
    'clone',
    // don't hang on asking passwords
    '-c core.askpass=true',
    '--recurse',
    ACCESS + 'github.com/' + repo.from
  ], path.dirname(repo.to), callback);
}

async.waterfall([
  // read and parse JSON configs from commandline
  function(callback) {
    var fn = async.seq(
      fs.readFile,
      function(data, callback) {
        try {
          callback(null, JSON.parse(data));
        } catch(e) {
          callback(e, null);
        }
      });
    async.map(configFiles, fn, callback);
  },
  // flatten configs to an array of repos
  function(configs, callback) {
    var repos = [];
    var folders = [];
    configs = configs.reduce(function(a, b){ return a.concat(b); });
    configs.forEach(function(conf) {
      conf.repos.forEach(function(r) {
        folders[conf.dir] = 1;
        repos.push({from: conf.org + '/' + r + '.git', to: conf.dir + '/' + r});
      });
    });
    callback(null, repos, folders);
  },
  // create output folders
  function(repos, folders, callback) {
    // make the output folders
    async.each(Object.keys(folders), function(folder, cb) {
      fs.mkdir(folder, function() {
        cb();
      });
    });
    callback(null, repos);
  },
  // clone or update repos
  function(repos, callback) {
    async.eachLimit(repos, JOBS, cloneOrUpdate, function() {
      // report a nice error log
      if (failed.length) {
        console.log('FAILED'.bold.red);
        failed.forEach(function(fail) {
          console.log('Repo: '.bold, fail.repo.from);
          console.log('Folder: '.bold, fail.repo.to);
          console.log('Operation: '.bold, fail.operation);
          console.log('Reason: '.bold, fail.reason);
        });
        process.exit(1);
      } else {
        console.log('OK'.bold.green);
      }
      callback();
    });
  }
], function(err) {
  if (err) {
    console.log(String(err).bold.red);
  }
});
