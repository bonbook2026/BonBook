#!/usr/bin/env python3
"""Add only the BonBook location include, validating and rolling back on failure."""
import datetime
import os
from pathlib import Path
import re
import subprocess
import sys

if os.geteuid() != 0:
    raise SystemExit('Run as root.')
site = Path(sys.argv[1]).resolve(strict=True)
if site.parent != Path('/etc/nginx/sites-available'):
    raise SystemExit('Choose an existing site under /etc/nginx/sites-available.')
source = Path(__file__).with_name('bonbook-preproduction.nginx.conf')
snippet = Path('/etc/nginx/snippets/bonbook-preproduction.conf')
include = '    include /etc/nginx/snippets/bonbook-preproduction.conf;'
original = site.read_text()
desired_snippet = source.read_text()
if snippet.exists() and snippet.read_text() != desired_snippet:
    raise SystemExit('An unexpected BonBook proxy snippet already exists; nothing changed.')
subprocess.run(['nginx', '-t'], check=True)
if include in original:
    print('BonBook proxy include already present; nothing changed.')
    raise SystemExit(0)
marker = r'(?m)^\s*ssl_certificate_key\s+[^;]+;\s*$'
if len(re.findall(marker, original)) != 1:
    raise SystemExit('Expected exactly one HTTPS certificate block; nothing changed.')
updated = re.sub(marker, lambda match: match.group(0) + '\n' + include, original, count=1)
backup = Path('/srv/bonbook-preproduction/shared/backups') / ('nginx-before-bonbook-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.conf')
backup.write_text(original)
backup.chmod(0o600)

def replace_site(text):
    pending = site.with_name(site.name + '.bonbook-next')
    pending.write_text(text)
    pending.chmod(0o644)
    pending.replace(site)

created_snippet = not snippet.exists()
try:
    snippet.write_text(desired_snippet)
    snippet.chmod(0o644)
    replace_site(updated)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    replace_site(original)
    if created_snippet:
        snippet.unlink(missing_ok=True)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
print('BonBook HTTPS route enabled; existing routes retained and Nginx gracefully reloaded.')
