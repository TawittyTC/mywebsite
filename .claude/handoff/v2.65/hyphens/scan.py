#!/usr/bin/env python3
"""List every hyphenated compound in the text nodes of index.html (report only)."""
import re, sys, collections
from html.parser import HTMLParser

SRC = sys.argv[1]
html = open(SRC, encoding='utf-8').read()
lines = html.split('\n')
line_off = [0]
for l in lines:
    line_off.append(line_off[-1] + len(l) + 1)

VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
SKIP = {'script','style','title','head','noscript','svg'}
COMPOUND = re.compile(r'[^\W_]+(?:-[^\W_]+)+', re.U)

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.stack = []   # (tag, classes, id)
        self.hits = []
    def handle_starttag(self, tag, attrs):
        if tag in VOID: return
        a = dict(attrs)
        self.stack.append((tag, (a.get('class') or '').split(), a.get('id')))
    def handle_startendtag(self, tag, attrs):
        pass
    def handle_endtag(self, tag):
        if tag in VOID: return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return
    def handle_data(self, data):
        if '-' not in data: return
        tags = [s[0] for s in self.stack]
        if any(t in SKIP for t in tags): return
        if 'body' not in tags: return
        ln, col = self.getpos()
        start = line_off[ln - 1] + col
        assert html[start:start + len(data)] == data, (ln, col)
        for m in COMPOUND.finditer(data):
            self.hits.append((start + m.start(), m.group(0), list(self.stack), data))

p = P(); p.feed(html); p.close()
cnt = collections.Counter()
for pos, word, stack, data in p.hits:
    ln = html.count('\n', 0, pos) + 1
    chain = ' > '.join(t + ('.' + '.'.join(c) if c else '') + ('#' + i if i else '') for t, c, i in stack[-4:])
    tmpl = next((i for t, c, i in stack if t == 'template'), '')
    innw = any('nw' in c or 'svc-nw' in c for t, c, i in stack)
    # the whitespace-delimited token around the compound
    a = pos
    while a > 0 and not html[a - 1].isspace() and html[a - 1] not in '<>': a -= 1
    b = pos + len(word)
    while b < len(html) and not html[b].isspace() and html[b] not in '<>': b += 1
    tok = html[a:b]
    cnt[word.lower()] += 1
    print(f'{ln}\t{word}\t{tok if tok != word else ""}\t{"NW" if innw else ""}\t{tmpl}\t{chain}')
print('TOTAL', len(p.hits), 'distinct', len(cnt), file=sys.stderr)
