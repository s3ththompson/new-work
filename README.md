<h1 align="center">new-work</h1>

<div align="center">
  <strong>Discover when artists post new work</strong>
</div>

---

## Usage
```txt
Usage: newwork <command> [options]

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
    -h, --help                  Print usage
```

## Installation
```sh
$ npm install new-work
```

## License
[MIT](https://tldrlegal.com/license/mit-license)