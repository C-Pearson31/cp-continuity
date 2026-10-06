#!/usr/bin/env python3
"""Optional Anthropic API fallback registry. No credentials are saved or printed.
Runtime session capacity always takes precedence. Requires Python 3 + API access.
"""
import argparse
import datetime
import json
import os
import pathlib
import tempfile
import urllib.parse
import urllib.request


def build_registry(pages):
    models = {}
    for page in pages:
        for entry in page.get('data', []):
            value = entry.get('max_input_tokens')
            if isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0:
                models[entry['id']] = {'max_input_tokens': int(value)}
    if not models:
        raise ValueError('API supplied no positive context limits; existing registry retained')
    return {'provider': 'anthropic-api', 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'source': 'https://api.anthropic.com/v1/models', 'models': models}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', help='Absolute path for the fallback JSON registry')
    args = parser.parse_args()
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        parser.error('ANTHROPIC_API_KEY is required for this optional helper; the mod itself does not need it')
    destination = pathlib.Path(args.output).expanduser().resolve()
    pages, after, seen = [], None, set()
    for _ in range(100):
        query = {'limit': 1000}
        if after:
            query['after_id'] = after
        request = urllib.request.Request('https://api.anthropic.com/v1/models?' + urllib.parse.urlencode(query),
                                        headers={'x-api-key': key, 'anthropic-version': '2023-06-01'})
        with urllib.request.urlopen(request, timeout=30) as response:
            page = json.load(response)
        pages.append(page)
        if not page.get('has_more'):
            break
        after = page.get('last_id')
        if not after or after in seen:
            raise ValueError('Invalid pagination; existing registry retained')
        seen.add(after)
    else:
        raise ValueError('Too many pages; existing registry retained')
    registry = build_registry(pages)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=destination.parent, delete=False, encoding='utf-8') as handle:
        json.dump(registry, handle, indent=2)
        temporary = pathlib.Path(handle.name)
    os.chmod(temporary, 0o600)
    os.replace(temporary, destination)
    print(f'Updated verified fallback registry: {len(registry["models"])} models')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Do not print exceptions that might contain request headers or secrets.
        raise SystemExit(f'Registry refresh failed ({type(exc).__name__}); existing file retained')
