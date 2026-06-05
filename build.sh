#!/bin/sh
# Rebuild production assets from sources.
# style.min.css = bootstrap-subset.min.css + minified style.css
# main.min.js   = minified main.js
# After running: bump the ?v= query strings on both assets in index.html.
set -e
cd "$(dirname "$0")"
npx --yes csso-cli assets/css/style.css --no-restructure -o /tmp/style-custom.min.css
cat assets/css/bootstrap-subset.min.css /tmp/style-custom.min.css > assets/css/style.min.css
npx --yes terser assets/js/main.js --compress --mangle --comments false -o assets/js/main.min.js
echo "built: assets/css/style.min.css ($(wc -c < assets/css/style.min.css) bytes), assets/js/main.min.js ($(wc -c < assets/js/main.min.js) bytes)"
