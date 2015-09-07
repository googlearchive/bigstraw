/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// jshint node: true

'use strict';

var async = require('async');
var chalk = require('chalk');
var fs = require('fs');
var nopt = require('nopt');
var path = require('path');
var spawn = require('child_process').spawn;

var EOL = require('os').EOL;

// default to https
var ACCESS = 'https://';
// default to 10 concurrent checkous
var JOBS = 10;

// githubname::checkoutname
var SPLIT = '::';

// global array of clone/update failures
// report these at the end
var failed = [];

var options = nopt(
  {
    'branch': String,
    'ssh': Boolean,
    'jobs': Number,
    'help': Boolean,
    'quiet': Boolean
  },
  {
    '-b': ['--branch'],
    '-s': ['--ssh'],
    '-j': ['--jobs'],
    '-?': ['--help'],
    '-h': ['--help'],
    '-q': ['--quiet']
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
    ' --branch <name>, -b <name>: Force a certain branch to checkout (Default: GitHub default branch)',
    '  --ssh, -s: Use ssh keys for push/pull access',
    '  --jobs #, -j #: Number of concurrent git operations (Default ' + JOBS + ')',
    '  --quiet, -q: Only print errors and success messages',
    '  --help, -h: Print this message'
  ].join(EOL));
  process.exit();
}

if (options.jobs > 0) {
  JOBS = options.jobs;
}

if (options.ssh) {
  ACCESS = 'ssh://git@';
}

function githubToCheckout(repo) {
  var parts = repo.split(SPLIT);
  if (parts.length === 1) {
    parts[1] = parts[0];
  }
  if (parts[1].substring(parts[1].length - 4, parts[1].length) === '.git') {
    parts[1] = parts[1].substring(0, parts[1].length - 4);
  }
  // [githubName, checkoutName]
  return parts;
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
  var git = spawn('git', args, {
    cwd: cwd,
    stdout: 'ignore'
  });
  var operation = args[0];
  // print a nice status message "=== pull foo ==="
  if (!options.quiet) {
    var sides = chalk.blue('===');
    console.log(sides, chalk.blue.bold(operation), chalk.bold(path.basename(repo.to, '.git')), sides);
  }
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
  var ops = [
    async.apply(gitWrapper, repo, ['pull', '--rebase'], repo.to),
    // if .gitmodules exists, then try to update submodules
    function(callback) {
      fs.exists(path.join(repo.to, '.gitmodules'), function(exists) {
        if (exists) {
          gitWrapper(repo, ['submodule', 'update', '--init', '--recursive'], repo.to, callback);
        } else {
          callback();
        }
      });
    }
  ];
  var branch = repo.branch || options.branch;
  if (branch) {
    ops.unshift(async.apply(gitWrapper, repo, ['checkout', branch], repo.to));
  }
  async.series(ops, callback);
}

function clone(repo, callback) {
  var args = [
    'clone',
    // don't hang on asking passwords
    '-c',
    'core.askpass=true',
    '--recurse',
    ACCESS + repo.from,
    path.basename(repo.to)
  ];
  var branch = repo.branch || options.branch;
  if (branch) {
    args.push('-b');
    args.push(branch);
  }
  gitWrapper(repo, args, path.dirname(repo.to), callback);
}

async.waterfall([
  // read and parse JSON configs from commandline
  function(callback) {
    var fn = async.seq(
      fs.readFile, function(data, callback) {
        try {
          callback(null, JSON.parse(data));
        } catch (e) {
          callback(e, null);
        }
      });
    async.map(configFiles, fn, callback);
  },
  // flatten configs to an array of repos
  function(configs, callback) {
    var repos = [];
    var folders = [];
    configs = configs.reduce(function(a, b) {
      return a.concat(b);
    });
    configs.forEach(function(conf) {
      var access = '';
      if (conf.url === undefined || conf.url === '') {
        access += 'github.com/';
      } else {
        access += conf.url + '/';
      }
      if (conf.org !== '') {
        access += conf.org + '/';
      }
      conf.repos.forEach(function(r) {
        folders[conf.dir] = 1;
        var repoNames = githubToCheckout(r);
        repos.push({
          from: access + repoNames[0],
          to: path.join(conf.dir, repoNames[1]),
          branch: conf.branch
        });
      });
    });
    callback(null, repos, folders);
  },
  // create output folders
  function(repos, folders, callback) {
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
        console.log(chalk.bold.red('FAILED REPOS'));
        failed.forEach(function(fail) {
          console.log(chalk.bold('Repo: '), fail.repo.from);
          console.log(chalk.bold('Folder: '), fail.repo.to);
          console.log(chalk.bold('Operation: '), fail.operation);
          console.log(chalk.bold('Reason: '), fail.reason);
        });
        callback('FAILED SYNC');
      } else {
        console.log(chalk.bold.green('OK'));
        callback();
      }
    });
  }
], function(err) {
    if (err) {
      console.log(chalk.bold.red(String(err)));
      process.exit(1);
    }
  });
