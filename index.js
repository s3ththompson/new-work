const yaml = require('./lib/yaml');
const async = require('async');
const _ = require('lodash');
const normalizeUrl = require('normalize-url');
var subMilliseconds = require('date-fns/sub_milliseconds');
var isNewer = require('date-fns/compare_asc');

const view = require('./views/default');
const fetch = require('./lib/fetch');

module.exports = {
  status: status,
  render: render
};

function crawl(sites, cb) {
  async.mapLimit(
    sites,
    10,
    (site, cb) => {
      fetch(site.url, (err, lastModified, $) => {
        if (err) return cb(err, null);
        if (site.selector) {
          site.content = $.html($(site.selector).first());
          cb(null, site);
        } else if (lastModified) {
          site.lastModified = new Date(lastModified);
          cb(null, site);
        } else {
          cb(
            new Error(
              `${site.url}: no 'last-modified' header, specify selector instead`
            ),
            null
          );
        }
      });
    },
    cb
  );
}

function diff(lock, sites, expiration) {
  for (var site of sites) {
    var baseline = _.find(lock, ['url', site.url]);
    if (site.selector && baseline && baseline.selector) {
      site.lastModified = site.content !== baseline.content
        ? new Date()
        : baseline.lastModified;
    } else if (!site.lastModified) {
      site.lastModified = subMilliseconds(new Date(), expiration);
    }
  }
  return sites;
}

function status(sites, lockfile, opts, cb) {
  var cb = cb || opts;
  if (typeof opts === 'function' || !opts) opts = {};

  var month = 1000 * 60 * 60 * 24 * 30; // ms in one month
  var expiration = opts.expiration || month;

  yaml.read(lockfile, (err, lock) => {
    if (err) return cb(err, null);
    lock = lock.sites;
    crawl(sites, (err, sites) => {
      if (err) return cb(err, null);
      sites = diff(lock, sites, expiration);
      yaml.writeLockfile(lockfile, { sites: sites }, err => {
        if (err) return cb(err, null);
        for (var site of sites) {
          var expirationDate = subMilliseconds(new Date(), expiration);
          site.new = isNewer(site.lastModified, expirationDate) == 1;
        }
        cb(
          null,
          sites.map(site => {
            return _.pick(site, ['name', 'url', 'new', 'lastModified']);
          })
        );
      });
    });
  });
}

function render(sites, lockfile, opts, cb) {
  var cb = cb || opts;
  if (typeof opts === 'function' || !opts) opts = {};

  var template = opts.template || view;

  status(sites, lockfile, opts, (err, sites) => {
    if (err) return cb(err, null);
    cb(null, template(sites).toString());
  });
}
