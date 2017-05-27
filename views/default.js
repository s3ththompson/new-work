const bel = require('bel');

module.exports = function(sites) {
  return bel`<div>
    <ul>
    ${sites.map(site => {
      return link(site);
    })}
    </ul>
  </div>`;
};

function link(site) {
  var newspan = site.new ? bel`<span class="new">New</span>` : '';
  return bel`<li>
    <a href="${site.url}">${site.name}</a>
    ${newspan}
  </li>`;
}
