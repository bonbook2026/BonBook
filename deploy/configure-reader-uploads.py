#!/usr/bin/env python3
"""Permit bounded media uploads only on BonBook's authenticated admin endpoint."""
import os
from pathlib import Path
import subprocess

if os.geteuid() != 0:
    raise SystemExit('Run as root.')
site = Path('/etc/nginx/sites-available/bonbook-preproduction')
previous = site.read_text()
if not previous.startswith('# Managed by BonBook preproduction\n') or 'proxy_pass http://127.0.0.1:3135;' not in previous:
    raise SystemExit('Unexpected BonBook vhost; nothing changed.')
if 'location ^~ /api/admin/media/' in previous:
    print('BonBook upload route already configured.')
    raise SystemExit(0)
marker = '    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;\n'
if previous.count(marker) != 1:
    raise SystemExit('Unexpected BonBook HTTPS layout; nothing changed.')
location = '''    location ^~ /api/admin/media/ {
        proxy_pass http://127.0.0.1:3135;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        client_max_body_size 31m;
        proxy_read_timeout 60s;
    }
'''
backup = Path('/srv/bonbook-preproduction/shared/backups/nginx-before-reader.conf')
if not backup.exists():
    backup.write_text(previous)
    backup.chmod(0o600)
try:
    site.write_text(previous.replace(marker, marker + location, 1))
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    site.write_text(previous)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
print('BonBook authenticated media upload route configured; ordinary request limits unchanged.')
