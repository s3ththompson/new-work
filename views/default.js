const bel = require('bel');
const _ = require('lodash');

module.exports = function(sites) {
  var categories = _.groupBy(sites, site => {
    return site.category || 'Default';
  });
  return bel`<table>
      ${head(categories)}
      ${body(categories)}
  </table>`;
};

function head(categories) {
  if (_.keys(categories).length == 1 && _.keys(categories)[0] == 'Default')
    return '';
  return bel`<thead>
    <tr>
      ${_.keys(categories).map(category => {
        return bel`<th>${category}</th>`;
      })}
    </tr>
  </thead>`;
}

function body(categories) {
  var maxLength = 0;
  for (var category in categories) {
    var list = categories[category];
    if (list.length > maxLength) maxLength = list.length;
  }
  return bel`<tbody>
      ${_.range(0, maxLength).map(i => {
        return row(categories, i);
      })}
  </tbody>`;
}

function row(categories, i) {
  return bel`<tr>
    ${_.values(categories).map(list => {
      var content = list[i] ? link(list[i]) : '';
      return bel`<td>${content}</td>`;
    })}
  </tr>`;
}

function link(site) {
  var newspan = site.new ? bel`<span class="new">New</span>` : '';
  return bel`<div>
    <a href="${site.url}">${site.name}</a>
    ${newspan}
  </div>`;
}
