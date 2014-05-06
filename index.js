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

var ACCESS = [
  'ssh://',
  'https://',
  'git://'
];

var MAX = 30;

var configs = [
  {
    "folder": "components",
    "org": "Polymer",
    "repos": [
      "CustomElements",
      "HTMLImports",
      "MutationObservers",
      "NodeBind",
      "PointerEvents",
      "PointerGestures",
      "polymer-gestures",
      "ShadowDOM",
      "TemplateBinding",
      "URL",
      "WeakMap",
      "observe-js",
      "platform",
      "platform-dev",
      "polymer",
      "polymer-dev",
      "polymer-expressions",
      "tools"
    ]
  },
  {
    "folder": "components",
    "org": "web-animations",
    "repos": [
      "web-animations-js"
    ]
  },
  {
    "folder": "components",
    "org": "Polymer",
    "repos": [
      "core-action-icons",
      "core-ajax",
      "core-collapse",
      "core-component-page",
      "core-component-page-dev",
      "core-elements",
      "core-doc-viewer",
      "core-docs",
      "core-drag-drop",
      "core-drawer-panel",
      "core-field",
      "core-firebase",
      "core-header-panel",
      "core-home-page",
      "core-home-page-dev",
      "core-icon",
      "core-icon-button",
      "core-iconset",
      "core-iconset-svg",
      "core-input",
      "core-item",
      "core-layout",
      "core-layout-grid",
      "core-layout-trbl",
      "core-localstorage",
      "core-media-query",
      "core-menu",
      "core-menu-button",
      "core-meta",
      "core-overlay",
      "core-pages",
      "core-range",
      "core-scaffold",
      "core-selection",
      "core-selector",
      "core-shared-lib",
      "core-splitter",
      "core-tests",
      "core-theme-aware",
      "core-toolbar",
      "core-tooltip",
      "core-transition",
      "core-list",
      "core-drag-drop",
      "core-bind",
      "core-icons",
      "sampler-scaffold"
    ]
  },
  {
    "folder": "components",
    "org": "PolymerLabs",
    "repos": [
      "ace-element",
      "chart-js",
      "code-mirror",
      "cool-clock",
      "fire-base",
      "flatiron-director",
      "g-kratu",
      "github-elements",
      "google-apis",
      "google-map",
      "humane-js",
      "js-beautify",
      "marked-js",
      "more-elements",
      "pdf-js",
      "pixi-js",
      "polymer-ajax",
      "polymer-anchor-point",
      "polymer-animation",
      "polymer-collapse",
      "polymer-cookie",
      "polymer-doc-viewer",
      "polymer-elements",
      "polymer-file",
      "polymer-flex-layout",
      "polymer-google-jsapi",
      "polymer-grid-layout",
      "polymer-home-page",
      "polymer-home-page-dev",
      "polymer-jsonp",
      "polymer-key-helper",
      "polymer-layout",
      "polymer-list",
      "polymer-localstorage",
      "polymer-media-query",
      "polymer-meta",
      "polymer-mock-data",
      "polymer-overlay",
      "polymer-page",
      "polymer-scrub",
      "polymer-sectioned-list",
      "polymer-selection",
      "polymer-selector",
      "polymer-shared-lib",
      "polymer-signals",
      "polymer-stock",
      "polymer-ui-accordion",
      "polymer-ui-action-icons",
      "polymer-ui-animated-pages",
      "polymer-ui-arrow",
      "polymer-ui-base",
      "polymer-ui-breadcrumbs",
      "polymer-ui-card",
      "polymer-ui-clock",
      "polymer-ui-collapsible",
      "polymer-ui-dropdown",
      "polymer-ui-dropup",
      "polymer-ui-elements",
      "polymer-ui-field",
      "polymer-ui-icon",
      "polymer-ui-icon-button",
      "polymer-ui-iconset",
      "polymer-ui-line-chart",
      "polymer-ui-menu",
      "polymer-ui-menu-button",
      "polymer-ui-menu-item",
      "polymer-ui-nav-arrow",
      "polymer-ui-overlay",
      "polymer-ui-pages",
      "polymer-ui-ratings",
      "polymer-ui-scaffold",
      "polymer-ui-sidebar",
      "polymer-ui-sidebar-header",
      "polymer-ui-sidebar-menu",
      "polymer-ui-splitter",
      "polymer-ui-stock",
      "polymer-ui-submenu-item",
      "polymer-ui-tabs",
      "polymer-ui-theme-aware",
      "polymer-ui-toggle-button",
      "polymer-ui-toolbar",
      "polymer-ui-weather",
      "polymer-view-source-link",
      "smoothie-chart",
      "speech-mic",
      "speech-transcript",
      "three-js",
      "tk-buildbot",
      "typeahead-input",
      "wu-weather",
      "x-binding",
      "x-designable",
      "x-designer",
      "x-dom-serializer",
      "x-editors",
      "x-file-document",
      "x-inspector",
      "x-live-edit",
      "x-meta",
      "x-output",
      "x-palette",
      "x-property-inspector",
      "x-tags",
      "x-tree",
      "yt-video"
    ]
  },
  {
    "folder": "projects",
    "org": "PolymerLabs",
    "repos": [
      "arrange-game",
      "book-search",
      "contacts",
      "designer",
      "gallery",
      "memory-game",
      "pica",
      "playground",
      "sandbox",
      "shuttle",
      "slideshow",
      "test-dashboard",
      "youtube"
    ]
  },
  {
    "folder": "projects",
    "org": "Polymer",
    "repos": [
      "core-sampler",
      "todomvc"
    ]
  }
];

var repos = [];
var folders = {};
var failed = [];

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
    '--recurse',
    'ssh://github.com/' + repo.from
  ], path.dirname(repo.to), callback);
}

configs.forEach(function(conf) {
  conf.repos.forEach(function(r) {
    folders[conf.folder] = 1;
    repos.push({from: conf.org + '/' + r + '.git', to: conf.folder + '/' + r});
  });
});

// make the output folders
async.each(Object.keys(folders), function(folder, callback) {
  fs.mkdir(folder, function() {
    callback();
  });
},
function() {
  // clone or update the repos
  async.eachLimit(repos, MAX, cloneOrUpdate, function() {
    // report a nice error log
    if (failed.length) {
      console.log('FAILED'.bold.red);
      failed.forEach(function(fail) {
        console.log('Repo: '.bold, fail.repo.from);
        console.log('Folder: '.bold, fail.repo.to);
        console.log('Operation: '.bold, fail.operation);
        console.log('Reason: '.bold, fail.reason);
      });
    } else {
      console.log('OK'.bold.green);
    }
  });
});
