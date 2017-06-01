const cheerio = require('cheerio');
const request = require('request');

module.exports = function fetch(url, cb) {
  request(url, (err, resp, html) => {
    if (err) return cb(err, null, null);
    var $ = cheerio.load(html);
    cb(null, resp.headers['last-modified'], $);
  });
};
