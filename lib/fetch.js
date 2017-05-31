const request = require('request');
const cheerio = require('cheerio');

module.exports = function fetch(url, cb) {
  request(url, (err, resp, html) => {
    if (err) return cb(err, null, null);
    var $ = cheerio.load(html);
    cb(null, resp.headers['last-modified'], $);
  });
};
