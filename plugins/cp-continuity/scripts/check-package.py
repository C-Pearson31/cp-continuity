#!/usr/bin/env python3
"""Offline packaging checks; this does not validate the Claude runtime."""
import json
import pathlib
import subprocess
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((root / '.claude-plugin/plugin.json').read_text())
hooks = json.loads((root / 'hooks/hooks.json').read_text())
assert manifest['name'] == 'cp-continuity'
assert manifest['userConfig']['mode']['default'] == 'normal'
for module in hooks['modules']:
    assert (root / 'hooks' / module).is_file()
for name in ['README.md', 'INSTALL_PROMPT.txt', 'docs/INSTALL.md', 'VALIDATION.md', 'LICENSE']:
    assert (root / name).is_file(), name
for file in (root / 'hooks').glob('*.js'):
    subprocess.run(['node', '--check', str(file)], check=True)
print('Package structure and JavaScript syntax verified. Live Claude checks remain required.')
