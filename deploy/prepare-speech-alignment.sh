#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l
root=/srv/bonbook-preproduction/shared
apt-get update -qq
apt-get install -y --no-install-recommends python3-venv libgomp1
if [[ ! -x "$root/speech-venv/bin/python" ]]; then python3 -m venv "$root/speech-venv"; fi
"$root/speech-venv/bin/pip" install --disable-pip-version-check 'faster-whisper==1.2.1' 'av==16.1.0'
install -d -m 0750 -o root -g bonbook "$root/speech-models"
"$root/speech-venv/bin/python" - "$root/speech-models/small" <<'PY'
import sys
from huggingface_hub import snapshot_download
snapshot_download('Systran/faster-whisper-small',revision='536b0662742c02347bc0e980a01041f333bce120',local_dir=sys.argv[1],allow_patterns=['config.json','preprocessor_config.json','model.bin','tokenizer.json','vocabulary.*'])
PY
"$root/speech-venv/bin/pip" freeze > "$root/speech-venv/installed-versions.txt"
chown -R root:bonbook "$root/speech-venv" "$root/speech-models"
chmod -R g+rX,o-rwx "$root/speech-venv" "$root/speech-models"
printf '%s\n' 'faster-whisper=1.2.1 av=16.1.0 model=small revision=536b0662742c02347bc0e980a01041f333bce120' > "$root/speech-models/.ready"
chmod 0640 "$root/speech-models/.ready"
echo 'BonBook offline speech recognition runtime is ready.'
