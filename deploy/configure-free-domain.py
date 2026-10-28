#!/usr/bin/env python3
"""Give BonBook its own HTTPS host using an existing ACME account."""
import glob
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

if os.geteuid() != 0:
    raise SystemExit('Run as root.')
hostname = sys.argv[1]
if not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?', hostname) or '.' not in hostname:
    raise SystemExit('Invalid hostname.')
accounts = glob.glob('/etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory/*/regr.json')
if len(accounts) != 1:
    raise SystemExit('An existing, unambiguous Let\'s Encrypt account is required; no account was created.')
site = Path('/etc/nginx/sites-available/bonbook-preproduction')
enabled = Path('/etc/nginx/sites-enabled/bonbook-preproduction')
marker = '# Managed by BonBook preproduction\n'
if site.exists() and not site.read_text().startswith(marker):
    raise SystemExit('Unexpected existing BonBook vhost; nothing changed.')
if enabled.exists() and enabled.resolve() != site:
    raise SystemExit('Unexpected enabled BonBook vhost; nothing changed.')
webroot = Path('/var/lib/bonbook-preproduction/acme')
webroot.mkdir(parents=True, exist_ok=True, mode=0o755)
http = f'''server {{
    listen 80;
    listen [::]:80;
    server_name {hostname};
    location ^~ /.well-known/acme-challenge/ {{ root {webroot}; }}
    location / {{ return 308 https://$host$request_uri; }}
}}
'''

def write_site(content):
    previous = site.read_text() if site.exists() else None
    pending = site.with_name(site.name + '.next')
    pending.write_text(marker + content)
    pending.chmod(0o644)
    pending.replace(site)
    if not enabled.exists():
        enabled.symlink_to(site)
    try:
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except Exception:
        if previous is None:
            enabled.unlink(missing_ok=True)
            site.unlink(missing_ok=True)
        else:
            site.write_text(previous)
        raise

write_site(http)
subprocess.run(['certbot', 'certonly', '--non-interactive', '--webroot',
    '--webroot-path', str(webroot), '--cert-name', 'bonbook-preproduction',
    '--domain', hostname, '--account', Path(accounts[0]).parent.name,
    '--keep-until-expiring', '--deploy-hook', '/usr/bin/systemctl reload nginx'], check=True)
renewal = Path('/etc/letsencrypt/renewal/bonbook-preproduction.conf')
renewal_text = renewal.read_text()
if not re.search(r'(?m)^renew_hook\s*=', renewal_text):
    if renewal_text.count('[renewalparams]') != 1:
        raise SystemExit('Unexpected BonBook renewal settings; review them before continuing.')
    renewal.write_text(renewal_text.replace('[renewalparams]',
        '[renewalparams]\nrenew_hook = /usr/bin/systemctl reload nginx', 1))
https = f'''server {{
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name {hostname};
    ssl_certificate /etc/letsencrypt/live/bonbook-preproduction/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bonbook-preproduction/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    location / {{
        proxy_pass http://127.0.0.1:3135;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        client_max_body_size 1m;
    }}
}}
'''
write_site(http + https)

# Remove only our earlier location include from the shared site's configuration.
shared = Path('/etc/nginx/sites-available/signal.easybitpay.com')
if shared.exists():
    old = shared.read_text()
    revised, count = re.subn(r'(?m)^[ \t]*include /etc/nginx/snippets/bonbook-preproduction\.conf;\r?\n', '', old)
    if count > 1:
        raise SystemExit('Unexpected duplicate shared include; the free host is ready but the old route was retained.')
    if count == 1:
        backup = Path('/srv/bonbook-preproduction/shared/backups/nginx-before-free-domain.conf')
        if not backup.exists():
            shutil.copyfile(shared, backup)
            backup.chmod(0o600)
        shared.write_text(revised)
        try:
            subprocess.run(['nginx', '-t'], check=True)
            subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        except Exception:
            shared.write_text(old)
            subprocess.run(['nginx', '-t'], check=True)
            subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
            raise
print(f'BonBook HTTPS host ready: https://{hostname}/')
