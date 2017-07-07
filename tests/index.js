const test = require('tape');
const newwork = require('../');
const yaml = require('../lib/yaml');
const path = require('path');
const _ = require('lodash');

function writeNop(filename, data, cb) {
  cb(null);
}

function crawlNop(sites, cb) {
  cb(null, sites);
}

test('status', t => {
  yaml.read(path.join(__dirname, 'fixtures', 'a.yaml'), (err, data) => {
    t.notOk(err);
    var sites = data.sites;
    var lockfile = path.join(__dirname, 'fixtures', 'a.lock');
    var opts = {
      write: writeNop,
      crawl: crawlNop
    };
    newwork.status(sites, lockfile, opts, (err, sites) => {
      t.notOk(err);
      t.ok(sites);
      var oldSite = _.find(sites, { url: 'http://oldexample.com/' });
      var newSite = _.find(sites, { url: 'http://newexample.com/' });
      t.notOk(oldSite.new);
      t.ok(newSite.new);
      t.end();
    });
  });
});

test('render', t => {
  yaml.read(path.join(__dirname, 'fixtures', 'a.yaml'), (err, data) => {
    t.notOk(err);
    var sites = data.sites;
    var lockfile = path.join(__dirname, 'fixtures', 'a.lock');
    var opts = {
      write: writeNop,
      crawl: crawlNop
    };
    newwork.render(sites, lockfile, opts, (err, str) => {
      t.notOk(err);
      t.ok(str.includes('<a href="http://oldexample.com/">Old Example</a>'));
      t.end();
    });
  });
});

test('last modified', t => {
  yaml.read(path.join(__dirname, 'fixtures', 'a.yaml'), (err, data) => {
    t.notOk(err);
    var sites = data.sites;
    _.find(sites, { url: 'http://oldexample.com/' }).lastModified = new Date();
    var lockfile = path.join(__dirname, 'fixtures', 'a.lock');
    var opts = {
      write: writeNop,
      crawl: crawlNop
    };
    newwork.status(sites, lockfile, opts, (err, sites) => {
      t.notOk(err);
      t.ok(sites);
      var site = _.find(sites, { url: 'http://oldexample.com/' });
      t.ok(site.new);
      t.end();
    });
  });
});

test('if last modified specified, but header is missing, error');

test('when selector starts returning nothing, error');

test("if last modified is earlier than what's in file, it should warn");

test("if selector doesn't change, nothing should happen");

test('if selector changes, content is new');

test(
  'if selector changes, lock should be updated, last modified should be updated'
);

test('if lastmodified date is new, update lockfile');

test('if lastmodified date is within expiration, new');

test('if no lastmodified in lockfile, add lastmodified, new based on date');

test(
  'if no selector in lockfile, add selector, add lastmodified, should not read new'
);

test('custom expiration');

test('custom view');
