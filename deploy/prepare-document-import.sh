#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
# Official distribution packages only. Do not upgrade the OS or restart shared services.
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=l
apt-get update -qq
apt-get install -y --no-install-recommends curl poppler-utils tesseract-ocr tesseract-ocr-fas tesseract-ocr-eng
tesseract --list-langs
models=/srv/bonbook-preproduction/shared/data/ocr-models
install -d -m 0700 -o bonbook -g bonbook "$models"
curl --fail --silent --show-error --location --proto '=https' https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/fas.traineddata -o "$models/fas.traineddata.next"
mv "$models/fas.traineddata.next" "$models/fas.traineddata"
english_model=$(dpkg -L tesseract-ocr-eng | sed -n '/\/eng.traineddata$/p' | head -1)
test -f "$english_model"
cp "$english_model" "$models/eng.traineddata"
chown bonbook:bonbook "$models/fas.traineddata" "$models/eng.traineddata"
chmod 0600 "$models/fas.traineddata" "$models/eng.traineddata"
