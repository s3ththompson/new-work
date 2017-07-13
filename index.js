const _ = require('lodash');
const async = require('async');
const isNewer = require('date-fns/compare_asc');
const normalizeUrl = require('normalize-url');
const subMilliseconds = require('date-fns/sub_milliseconds');

const fetch = require('./lib/fetch');
const view = require('./views/default');
const yaml = require('./lib/yaml');

module.exports = {
  status: status,
  render: render
};

function crawl(sites, cb) {
  async.mapLimit(sites, 100, scrape, cb);

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

/**
* Get the status of a list of sites to see whether new work has been posted.
* @name status
* @param {Object[]} sites
* @param {String} sites.name - name of artist / title of site
* @param {String} sites.url
* @param {String} sites.category
* @param {String} [sites.selector] - jQuery selector that will return an element to diff for changes
* @param {String} lockfile - filename of lockfile to store previous diffs & metadata
* @param {Object} [opts]
* @param {Number} opts.expiration - duration in ms for which a given site is still "new", default ms in one month
**/
function status(sites, lockfile, opts, cb) {
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
    crawlFunc(sites, (err, sites) => {
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
}

/**
* Render an HTML view of a list of sites, highlighting when new work has been posted.
* @name render
* @param {Object[]} sites
* @param {String} sites.name - name of artist / title of site
* @param {String} sites.url
* @param {String} sites.category
* @param {String} [sites.selector] - jQuery selector that will return an element to diff for changes
* @param {String} lockfile - filename of lockfile to store previous diffs & metadata
* @param {Object} [opts]
* @param {Function} opts.template - template function to return str of HTML, given sites
* @param {Number} opts.expiration - duration in ms for which a given site is still "new", default ms in one month
**/
function render(sites, lockfile, opts, cb) {
  var cb = cb || opts;
  if (typeof opts === 'function' || !opts) opts = {};

  var template = opts.template || view;

  status(sites, lockfile, opts, (err, sites) => {
    if (err) return cb(err, null);
    var str = template(sites).toString();
    cb(null, str);
  });
}
