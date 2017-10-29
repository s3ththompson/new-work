var Emitter = require('events').EventEmitter;
const fs = require('fs');
const http = require('http');
const path = require('path');

const _ = require('lodash');
const async = require('async');
const isNewer = require('date-fns/compare_asc');
const normalizeUrl = require('normalize-url');
const subMilliseconds = require('date-fns/sub_milliseconds');
const createHTML = require('create-html');

const fetch = require('./lib/fetch');
const view = require('./views/default');
const yaml = require('./lib/yaml');

module.exports = NewWork;

function NewWork() {
  if (!(this instanceof NewWork)) return new NewWork();
}
NewWork.prototype = Object.create(Emitter.prototype);

function crawl(sites, emitter, cb) {
  async.mapLimit(sites, 10, timedScrape, (err, results) => {
    if (err) return cb(err, null);
    var out = results.reduce((out, result) => {
      if (!result.error) {
        out.push(result.value);
      } else {
        emitter.emit(
          'error',
          new Error(`\n${result.error.info}: site unavailable.`)
        );
      }
      return out;
    }, []);
    cb(null, out);
  });

  function timedScrape(site, cb) {
    var _scrape = async.reflect(async.timeout(scrape, 5000, site.url));
    _scrape(site, cb);
  }

  function scrape(site, cb) {
    fetch(site.url, (err, lastModified, $) => {
      if (err) return cb(err, null);
      if (site.selector) {
        var content = $.html($(site.selector).first());
        if (!content) {
          var msg = `${site.url}: selector '${site.selector}' returned nothing`;
          return cb(new Error(msg), null);
        }
        site.content = content;
        return cb(null, site);
      } else if (lastModified) {
        site.lastModified = new Date(lastModified);
        return cb(null, site);
      } else {
        var msg = `${site.url}: no 'last-modified' header, specify selector`;
        cb(new Error(msg), null);
      }
    });
  }
}

function diff(lock, sites, expiration) {
  for (var site of sites) {
    var baseline = _.find(lock, ['url', site.url]);
    if (site.selector && baseline && baseline.selector) {
      site.lastModified =
        site.content !== baseline.content ? new Date() : baseline.lastModified;
    } else if (!site.lastModified) {
      site.lastModified = subMilliseconds(new Date(), expiration);
    }
  }
  return sites;
}

NewWork.prototype.status = function(sites, lockfile, opts, cb) {
  var cb = cb || opts;
  if (typeof opts === 'function' || !opts) opts = {};

  var month = 1000 * 60 * 60 * 24 * 30; // ms in one month
  var expiration = opts.expiration || month;
  var crawlFunc = opts.crawl || crawl;
  var writeFunc = opts.write || yaml.writeLockfile;
  var readFunc = opts.read || yaml.read;

  readFunc(lockfile, (err, data) => {
    if (err) return cb(err, null);
    lock = data.sites;
    crawlFunc(sites, this, (err, sites) => {
      if (err) return cb(err, null);
      sites = diff(lock, sites, expiration);
      writeFunc(lockfile, { sites: sites }, err => {
        if (err) return cb(err, null);
        sites = markNew(sites, expiration);
        cb(null, sites);
      });
    });
  });

  function markNew(sites, expiration) {
    for (var site of sites) {
      var expirationDate = subMilliseconds(new Date(), expiration);
      site.new = isNewer(site.lastModified, expirationDate) == 1;
    }
    var cleanSites = sites.map(site => {
      return _.pick(site, ['name', 'url', 'new', 'category', 'lastModified']);
    });
    return cleanSites;
  }
};

NewWork.prototype.build = function(sites, lockfile, opts, cb) {
  var cb = cb || opts;
  if (typeof opts === 'function' || !opts) opts = {};
  var template = opts.template || view;

  this.status(sites, lockfile, opts, (err, sites) => {
    if (err) return cb(err, null);
    var body = template(sites).toString();
    var cssFile = path.join(__dirname, 'views/default.css');
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
};

NewWork.prototype.serve = function(sites, lockfile, opts, cb) {
  var cb = cb || opts;
  if (typeof opts === 'function' || !opts) opts = {};
  var port = opts.port || 3030;

  this.build(sites, lockfile, opts, (err, html) => {
    if (err) return cb(err, null);
    http
      .createServer((req, resp) => {
        resp.end(html);
      })
      .listen(port, err => {
        cb(null, port);
      });
  });
};
