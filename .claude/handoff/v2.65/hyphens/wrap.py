#!/usr/bin/env python3
"""Wrap every hyphenated compound in the visible copy of index.html in
<span class="nw">...</span>.

Edits TEXT NODES only (positions come from html.parser), never attributes,
never <head>, <script>, <style>, <title>, <svg>. Text already inside .nw /
.svc-nw, inside an element that is nowrap by its own rule, or inside an
address-like token (URL, e-mail) is left as it is.

usage: wrap.py <in.html> <out.html> [--skip "word@line" ...]
"""
import re, sys, collections
from html.parser import HTMLParser

args = sys.argv[1:]
SRC, DST = args[0], args[1]
SKIP_AT = set()
if '--skip' in args:
    SKIP_AT = set(args[args.index('--skip') + 1:])

html = open(SRC, encoding='utf-8', newline='').read()
line_off = [0]
for l in html.split('\n'):
    line_off.append(line_off[-1] + len(l) + 1)

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
NEVER = {'script', 'style', 'title', 'head', 'noscript', 'svg', 'textarea', 'option', 'button'}
# letters/digits joined by an ASCII hyphen-minus
COMPOUND = re.compile(r'[^\W_]+(?:-[^\W_]+)+', re.U)
# a token that is an address, not a word: it must stay breakable
ADDRESS = re.compile(r'@|://|www\.|\.(?:com|net|org|io|co|th|me|dev)\b', re.I)
OPEN, CLOSE = '<span class="nw">', '</span>'


def nowrap_already(stack):
    """elements whose own CSS rule is white-space: nowrap at every width (measured in the browser)"""
    for i, (tag, cls, _id) in enumerate(stack):
        if 'nw' in cls or 'svc-nw' in cls:
            return 'inside .nw/.svc-nw'
        if tag == 'li' and i and ({'skill-tools', 'svc-chips'} & set(stack[i - 1][1])):
            return 'nowrap chip (' + '.'.join(stack[i - 1][1]) + ' li)'
        # ".exp-modal-tech span" styles every span below it as a pill: a nested span
        # would get the pill's padding and background (measured), so these stay as they are
        if tag == 'span' and i and 'exp-modal-tech' in stack[i - 1][1]:
            return 'tech pill (.exp-modal-tech span would restyle a nested span)'
    return None


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.stack = []
        self.edits = []      # (start, end)
        self.left = []       # (line, word, reason)
        self.prev_end = None # source offset where the previous text chunk ended, and its last char
        self.edge = []       # hyphens that sit at the edge of a text chunk (never wrapped): for review

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        a = dict(attrs)
        self.stack.append((tag, (a.get('class') or '').split(), a.get('id')))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return
        raise SystemExit(f'unbalanced </{tag}> at {self.getpos()}')

    def handle_data(self, data):
        if '-' not in data:
            return
        tags = [s[0] for s in self.stack]
        if 'body' not in tags or any(t in NEVER for t in tags):
            if 'body' in tags and COMPOUND.search(data) and not ({'script', 'style', 'svg'} & set(tags)):
                raise SystemExit(f'compound in an unexpected element {tags[-3:]} at {self.getpos()}: {data[:60]!r}')
            return
        ln, col = self.getpos()
        start = line_off[ln - 1] + col
        if html[start:start + len(data)] != data:
            raise SystemExit(f'source position mismatch at line {ln}')
        if re.search(r'^-[^\W_]|[^\W_]-$', data):
            self.edge.append((ln, data[:40]))
        why = nowrap_already(self.stack)
        for m in COMPOUND.finditer(data):
            a, b = start + m.start(), start + m.end()
            # the whole whitespace-delimited token in the source, across inline tags
            x, y = a, b
            while x > 0 and not html[x - 1].isspace() and html[x - 1] not in '<>':
                x -= 1
            while y < len(html) and not html[y].isspace() and html[y] not in '<>':
                y += 1
            token = html[x:y]
            key = f'{m.group(0)}@{ln + data.count(chr(10), 0, m.start())}'
            if why:
                self.left.append((key, why))
            elif ADDRESS.search(token):
                self.left.append((key, 'address-like token ' + token))
            elif key in SKIP_AT:
                self.left.append((key, 'listed in --skip'))
            else:
                self.edits.append((a, b))


p = P()
p.feed(html)
p.close()
if p.stack:
    raise SystemExit('unclosed elements: ' + str([s[0] for s in p.stack]))

out = html
for a, b in sorted(p.edits, reverse=True):
    out = out[:a] + OPEN + out[a:b] + CLOSE + out[b:]

# proof 1: taking the added tags back out gives the original file, byte for byte
undo = out
n_open = 0
for a, b in sorted(p.edits):           # positions shift by the tags added before them
    pass
check = []
pos = 0
for a, b in sorted(p.edits):
    check.append(html[pos:a]); check.append(OPEN + html[a:b] + CLOSE); pos = b
check.append(html[pos:])
assert ''.join(check) == out
assert len(out) == len(html) + len(p.edits) * (len(OPEN) + len(CLOSE))
# proof 2: no edit touched anything but letters, digits and hyphens
for a, b in p.edits:
    assert re.fullmatch(r'[^\W_]+(?:-[^\W_]+)+', html[a:b]), html[a:b]

open(DST, 'w', encoding='utf-8', newline='').write(out)
words = collections.Counter(html[a:b] for a, b in p.edits)
print(f'wrapped {len(p.edits)} compounds ({len(words)} distinct); left {len(p.left)} as they are', file=sys.stderr)
for key, why in p.left:
    print(f'  left: {key}: {why}', file=sys.stderr)
for ln, d in p.edge:
    print(f'  REVIEW hyphen at the edge of a text chunk, line {ln}: {d!r}', file=sys.stderr)
