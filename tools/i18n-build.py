#!/usr/bin/env python3
"""Встраивает словарь i18n/ua.json в cascade.html (объект D в скрипте «Язык интерфейса»)."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
page = root / 'cascade.html'
s = page.read_text(encoding='utf-8')
D = json.loads((root / 'i18n' / 'ua.json').read_text(encoding='utf-8'))
dj = json.dumps(D, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
head = "if(lang!=='ua')return;\nconst D="
i = s.index(head) + len(head)
j = s.index(";\nconst CY=", i)
page.write_text(s[:i] + dj + s[j:], encoding='utf-8')
print(f'{len(D)} строк встроено в {page.name}')
