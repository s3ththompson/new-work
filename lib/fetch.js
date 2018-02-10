const cheerio = require('cheerio');
const request = require('request');

module.exports = function fetch(url, cb) {
  request(
    url,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36'
      },
      gzip: true
    },
    (err, resp, html) => {
      if (err) return cb(err, null, null);
      var $ = cheerio.load(html);
      cb(null, resp.headers['last-modified'], $);
    }
  );
};
