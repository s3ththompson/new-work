#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2));
const async = require('async');
const fs = require('fs');
const yaml = require('../lib/yaml');
const _ = require('lodash');
const compareUrls = require('compare-urls');
const normalizeUrl = require('normalize-url');
const table = require('text-table');
const inquirer = require('inquirer');
const fetch = require('../lib/fetch');
const relativeDate = require('date-fns/distance_in_words_to_now');
const newwork = require('..');
const path = require('path');
const createHTML = require('create-html');
const http = require('http');
const opn = require('opn');
const ora = require('ora');
const userHome = require('user-home');
const chalk = require('chalk');

process.title = 'newwork';

const helpText = `Usage: newwork <command> [options]

  Commands:
    <default>                   Run 'newwork serve'
    serve                       Scrape, update, and serve a new-work page
    build                       Scrape, update, and save a new-work page to disk
    add [url]                   Add an URL to your list of sites
    remove [url]                Remove an URL from your list of sites
    list                        List all sites in your new-work page

  Available options:
    -i, --input <filename>      Input YAML file [default: sites.yaml]
    -o, --output <filename>     Output HTML file [default: sites.html]
    -l, --lockfile <filename>   Lockfile location [default: sites.lock]
    -p, --port=<n>              Bind 'newwork serve' to a port [default: 3030]
    -h, --help                  Print usage`;

var h = argv.h || argv.help;

argv.input = argv.input || path.join(userHome, '.newwork.yaml');
argv.lockfile = argv.lockfile || path.join(userHome, '.newwork.lock');
argv.output = argv.output || './newwork.html';
argv.port = argv.port || 3030;

if (h) {
  help();
  exit();
}

init(err => {
  if (err) exit(err);
  main();
});

function main() {
  var cmd = argv._.shift();

  switch (cmd) {
    case 'list':
      list();
      break;
    case 'remove':
      remove();
      break;
    case 'add':
      add();
      break;
    case 'build':
      build();
      break;
    case 'serve':
    case undefined:
      serve();
      break;
    default:
      exit(`command ${cmd} not found`);
  }
}

function help() {
  console.log(helpText);
  exit();
}

function init(cb) {
  async.parallel([initInput, initLockfile], cb);

  function initInput(cb) {
    fs.readFile(argv.input, 'utf8', (err, data) => {
      if (err && err.code == 'ENOENT') {
        return yaml.write(argv.input, { sites: [] }, cb);
      }
      cb(err);
    });
  }

  function initLockfile(cb) {
    fs.readFile(argv.lockfile, 'utf8', (err, data) => {
      if (err && err.code == 'ENOENT') {
        return yaml.writeLockfile(argv.lockfile, { sites: [] }, cb);
      }
      cb(err);
    });
  }
}

function exit(err) {
  if (err) {
    console.log(chalk.red(err.toString()));
    process.exit(1);
  }
  process.exit(0);
}

function list() {
  ls(argv.input, (err, sites) => {
    if (err) exit(err);
    console.log(table(sites));
    exit();
  });

  function ls(input, cb) {
    yaml.read(input, (err, data) => {
      if (err) return cb(err, null);
      cb(null, _.map(data.sites, o => [o.name, o.url]));
    });
  }
}

function remove() {
  var url = argv._.shift();
  prompt = !url
    ? prompt
    : cb => {
        cb(null, url);
      };

  prompt((err, url) => {
    if (err) exit(err);
    removeEntry(argv.input, url, err => {
      if (err) exit(err);
      console.log(`Removed ${chalk.bold(url)} from ${chalk.bold(argv.input)}`);
      removeEntry(argv.lockfile, url, err => {
        if (err && err.message !== `site ${url} not found`) exit(err);
        console.log(
          `Removed ${chalk.bold(url)} from ${chalk.bold(argv.lockfile)}`
        );
        exit();
      });
    });
  });

  function prompt(cb) {
    inquirer
      .prompt([
        {
          type: 'input',
          name: 'url',
          message: 'URL'
        }
      ])
      .then(answers => {
        cb(null, answers.url);
      })
      .catch(err => {
        cb(err, null);
      });
  }

  function removeEntry(file, url, cb) {
    yaml.read(file, (err, data) => {
      if (err) return cb(err);
      if (
        !_.find(data.sites, site => {
          return compareUrls(site.url, url);
        })
      ) {
        return cb(new Error(`site ${url} not found`));
      }
      data.sites = _.reject(data.sites, site => {
        return compareUrls(site.url, url);
      });
      yaml.write(file, data, cb);
    });
  }
}

function add() {
  var addedURL = argv._.shift();

  prefetch = addedURL
    ? validate
    : (_, cb) => {
        cb(null);
      };

  prefetch(addedURL, (err, lastModifiedDate, $) => {
    if (err) exit(err);
    var _answers = {
      site: {
        url: addedURL,
        lastModifiedDate: lastModifiedDate,
        $,
        $
      }
    };

    var urlQ = {
      type: 'input',
      name: 'site',
      message: 'URL',
      filter: function(url) {
        var cb = this.async();
        validate(url, (err, lastModifiedDate, $) => {
          if (err) return cb(err);
          var site = {
            url: url,
            lastModifiedDate: lastModifiedDate,
            $: $
          };
          site.toString = () => {
            return url;
          };
          cb(null, site);
        });
      },
      when: function() {
        return !addedURL;
      }
    };
    var nameQ = {
      type: 'input',
      name: 'name',
      message: 'Name',
      default: answers => {
        answers = Object.assign(_answers, answers);
        var $ = answers.site.$;
        return $('title').text();
      }
    };
    var lastModifiedQ = {
      type: 'confirm',
      name: 'lastModified',
      message: answers => {
        answers = Object.assign(_answers, answers);
        var relative = relativeDate(answers.site.lastModifiedDate);
        return `Was the site last modified ${relative} ago?`;
      },
      when: answers => {
        answers = Object.assign(_answers, answers);
        return answers.site.lastModifiedDate;
      }
    };
    var selectorQ = {
      type: 'input',
      name: 'selector',
      message: `Choose an element selector to diff for changes`,
      when: answers => {
        return !answers.lastModified;
      },
      validate: (selector, answers) => {
        answers = Object.assign(_answers, answers);
        var $ = answers.site.$;
        return $.html($(selector).first())
          ? true
          : `$('${selector}') didn't return any elements, try again.`;
      }
    };

    inquirer
      .prompt([urlQ, nameQ, lastModifiedQ, selectorQ])
      .then(answers => {
        answers = Object.assign(_answers, answers);
        var entry = {
          name: answers.name,
          url: answers.site.url
        };
        if (answers.selector) entry.selector = answers.selector;

        addEntry(argv.input, entry, err => {
          if (err) exit(err);
          console.log(
            `Added ${chalk.bold(entry.url)} to ${chalk.bold(argv.input)}`
          );
          exit();
        });
      })
      .catch(err => {
        exit(err);
      });
  });

  function addEntry(input, opts, cb) {
    yaml.read(input, (err, data) => {
      if (err) return cb(err);
      if (
        _.find(data.sites, site => {
          return compareUrls(site.url, opts.url);
        })
      )
        return cb(new Error(`Site ${opts.url} already in ${argv.input}`));
      data.sites.push(opts);
      data.sites = _.sortBy(data.sites, 'name');
      yaml.write(input, data, cb);
    });
  }

  function validate(url, cb) {
    url = normalizeUrl(url, {
      stripFragment: false,
      stripWWW: false,
      removeTrailingSlash: false
    });
    fetch(url, cb);
  }
}

function build() {
  renderHTML(argv.input, argv.lockfile, (err, html) => {
    if (err) exit(err);
    fs.writeFile(argv.output, html, function(err) {
      if (err) exit(err);
      console.log(
        `Wrote ${chalk.green('new-work')} page to ${chalk.bold(argv.output)}`
      );
      exit();
    });
  });
}

function serve() {
  renderHTML(argv.input, argv.lockfile, (err, html) => {
    if (err) exit(err);
    http
      .createServer((req, resp) => {
        resp.end(html);
      })
      .listen(argv.port, err => {
        console.log(
          `Serving ${chalk.green('new-work')} page on ${chalk.bold('localhost:' + argv.port)}`
        );
        opn(`http://localhost:${argv.port}`);
      });
  });
}

function renderHTML(input, lockfile, cb) {
  yaml.read(input, (err, input) => {
    if (err) return cb(err, null);
    var sites = input.sites;

    const spinner = ora('Checking for site updates...');
    spinner.color = 'black';
    spinner.start();
    newwork.render(sites, lockfile, (err, body) => {
      if (err) {
        spinner.fail();
        return cb(err, null);
      }
      spinner.succeed();

      var cssFile = path.join(__dirname, '../views/default.css');
      fs.readFile(cssFile, 'utf8', (err, css) => {
        if (err) return cb(err, null);
        var cssTag = `<style type="text/css">
            ${css}
          </style>
          `;
        var html = createHTML({
          title: 'New Work',
          body: body,
          head: cssTag,
          lang: 'en'
        });
        cb(null, html);
      });
    });
  });
}
