#!/usr/bin/env bash
set -euo pipefail
cd /root/.openclaw/workspace/skills/marknice-wechat/scripts
npm install
node convert.js --input ../references/sample.md --theme amber --title 'Fragment Test' --fragment --summary ../references/fragment-summary.json --output ../references/fragment-output.html
node convert.js --input ./node_modules/mammoth/test/test-data/tables.docx --theme minimal --title 'DOCX Full Test' --output ../references/docx-full-test.html --summary ../references/docx-full-test.json
