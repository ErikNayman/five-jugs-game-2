#!/usr/bin/env python3
"""Собирает рукопись «Штанга 2» в один markdown и в HTML-страницу."""
import re, html, pathlib, datetime
ROOT = pathlib.Path(__file__).parent
ORDER = ["00-пролог.md","часть-1.md","часть-2.md","часть-3.md","часть-4.md","часть-5.md","часть-6.md"]
NB = ["тетрадь-1.md","тетрадь-2.md","тетрадь-3.md","тетрадь-4.md","тетрадь-5.md","тетрадь-6.md"]

def read(p): return (ROOT/p).read_text(encoding="utf-8").strip()

parts = [read(p) for p in ORDER]
nbs = [read(p) for p in NB]
intro_nb = ("# Рабочая тетрадь\n\nВопросы к главам собраны по частям книги; в частях I–V их задаёт Джон, в части VI — Софи. "
            "К каждой части — протокол с образцом из чисел Софи. Проходите часть тетради после той же части книги. "
            "Торговать для тетради не нужно; правая часть может быть нулевой. Если сведения не выяснены — пишите «не выяснено»; "
            "если инструмента у вас нет — «не применимо». Это разные ответы.")
full_md = "\n\n".join(parts + [intro_nb] + nbs) + "\n"
(ROOT/"Штанга-2.md").write_text(full_md, encoding="utf-8")

# --- word counts ---
def wc(s): return len(re.findall(r"[\w\-]+", s))
novel_words = sum(wc(p) for p in parts); nb_words = sum(wc(n) for n in nbs)

# --- minimal markdown -> html ---
def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"~~(.+?)~~", r"<s>\1</s>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
    return s

def md2html(md):
    out=[]; lines=md.split("\n"); i=0
    while i < len(lines):
        ln=lines[i]
        if ln.startswith("|") and i+1 < len(lines) and re.match(r"^\|\s*-", lines[i+1]):
            hdr=[c.strip() for c in ln.strip("|").split("|")]
            i+=2; rows=[]
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip("|").split("|")]); i+=1
            t="<table><thead><tr>"+"".join(f"<th>{inline(c)}</th>" for c in hdr)+"</tr></thead><tbody>"
            for r in rows: t+="<tr>"+"".join(f"<td>{inline(c)}</td>" for c in r)+"</tr>"
            out.append(t+"</tbody></table>"); continue
        m=re.match(r"^(#{1,4})\s+(.*)", ln)
        if m:
            lvl=len(m.group(1)); txt=inline(m.group(2)); anchor=re.sub(r"[^\w]+","-",m.group(2)).strip("-")
            out.append(f'<h{lvl} id="{anchor}">{txt}</h{lvl}>'); i+=1; continue
        m=re.match(r"^(\d+)\.\s+(.*)", ln)
        if m:
            items=[]
            while i < len(lines) and re.match(r"^\d+\.\s+", lines[i]):
                items.append(re.sub(r"^\d+\.\s+","",lines[i])); i+=1
            out.append("<ol>"+"".join(f"<li>{inline(x)}</li>" for x in items)+"</ol>"); continue
        if ln.strip()=="" : i+=1; continue
        para=[ln]; i+=1
        while i < len(lines) and lines[i].strip()!="" and not lines[i].startswith("#") and not lines[i].startswith("|") and not re.match(r"^\d+\.\s+",lines[i]):
            para.append(lines[i]); i+=1
        txt="<br>".join(inline(x) for x in para)
        cls=' class="dialog"' if para[0].startswith("—") else ""
        out.append(f"<p{cls}>{txt}</p>")
    return "\n".join(out)

body = md2html(full_md)
# table of contents from h1/h2
toc=[]
for m in re.finditer(r'<h([12]) id="([^"]+)">(.*?)</h\1>', body):
    toc.append(f'<li class="l{m.group(1)}"><a href="#{m.group(2)}">{m.group(3)}</a></li>')
stamp = datetime.date.today().strftime("%d.%m.%Y")
# Chapter eyebrows: turn "Глава 12. Название" into eyebrow + title
def eyebrow(bd):
    def rep(m):
        lvl, anchor, txt = m.group(1), m.group(2), m.group(3)
        mm = re.match(r"^(Глава \d+|Часть [IVX]+|Пролог|Эпилог|Стена|Хроника Илая|Кода|Рабочая тетрадь|Протокол [IVX]+)\.?\s*(.*)$", txt)
        if mm and mm.group(2):
            return f'<h{lvl} id="{anchor}"><span class="eyebrow">{mm.group(1)}</span><span class="ttl">{mm.group(2)}</span></h{lvl}>'
        return m.group(0)
    return re.sub(r'<h([12]) id="([^"]+)">(.*?)</h\1>', rep, bd)
body = eyebrow(body)
page = f"""<title>Штанга 2</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=PT+Mono&display=swap" rel="stylesheet">
<style>
:root{{--bg:#eceeeb;--paper:#f6f7f4;--ink:#18222b;--muted:#5d6a72;--rule:#c9d0cc;--accent:#b88600;--accent-ink:#5a4200;--link:#245a86;--radius:3px;color-scheme:light;}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#151a1e;--paper:#1c2227;--ink:#e6e9e4;--muted:#98a4ab;--rule:#333d44;--accent:#e0b23a;--accent-ink:#f0d07a;--link:#8cc0ea;color-scheme:dark;}}}}
:root[data-theme="dark"]{{--bg:#151a1e;--paper:#1c2227;--ink:#e6e9e4;--muted:#98a4ab;--rule:#333d44;--accent:#e0b23a;--accent-ink:#f0d07a;--link:#8cc0ea;color-scheme:dark;}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth}}
@media (prefers-reduced-motion: reduce){{html{{scroll-behavior:auto}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:"PT Serif",Georgia,"Times New Roman",serif;font-size:19px;line-height:1.6;}}
.wrap{{max-width:68ch;margin:0 auto;padding-block:36px 96px;padding-inline:16px;}}
.sheet{{background:var(--paper);border:1px solid var(--rule);border-radius:var(--radius);padding:28px 22px;}}
@media (min-width:700px){{.sheet{{padding:44px 56px}}}}
header.top{{border-bottom:2px solid var(--ink);padding-bottom:18px;margin-bottom:22px;display:flex;flex-direction:column;gap:6px}}
header.top .label{{font-family:Oswald,"Roboto Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:13px;color:var(--accent-ink)}}
header.top h1{{font-family:Oswald,"Roboto Condensed","Arial Narrow",sans-serif;font-weight:600;font-size:44px;margin:0;line-height:1.05;letter-spacing:.01em;text-wrap:balance}}
header.top h1 small{{display:block;font-weight:400;font-size:24px;color:var(--muted);letter-spacing:.02em;margin-top:2px}}
header.top p{{margin:0;color:var(--muted);font-size:15px}}
nav.toc{{margin:0 0 40px;font-size:15px;border:1px solid var(--rule);border-radius:var(--radius);padding:12px 16px;background:var(--bg)}}
nav.toc summary{{cursor:pointer;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.12em;font-size:13px;color:var(--accent-ink)}}
nav.toc ul{{list-style:none;padding:0;margin:12px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:3px 24px}}
@media (max-width:600px){{nav.toc ul{{grid-template-columns:1fr}}}}
nav.toc li.l1{{font-family:Oswald,sans-serif;font-size:14px;letter-spacing:.06em;text-transform:uppercase;margin-top:8px;grid-column:1 / -1}}
nav.toc li.l2{{padding-left:12px;color:var(--muted)}}
nav.toc a{{color:inherit;text-decoration:none}}
nav.toc a:hover,nav.toc a:focus-visible{{color:var(--link);outline:none;text-decoration:underline}}
h1,h2,h3{{font-family:Oswald,"Roboto Condensed","Arial Narrow",sans-serif;font-weight:500;line-height:1.15;text-wrap:balance}}
h1{{font-size:32px;margin:72px 0 18px;padding-top:18px;border-top:2px solid var(--ink)}}
h2{{font-size:24px;margin:56px 0 14px}}
h3{{font-size:15px;margin:40px 0 10px;text-transform:uppercase;letter-spacing:.12em;color:var(--accent-ink)}}
.eyebrow{{display:block;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-ink);font-weight:500;margin-bottom:4px}}
.ttl{{display:block}}
.sheet > h1:first-of-type{{margin-top:0;border-top:none;padding-top:0}}
p{{margin:0 0 15px;hyphens:auto;-webkit-hyphens:auto}}
p.dialog{{margin-bottom:5px;padding-left:1.2em;text-indent:-1.2em}}
p.dialog + p:not(.dialog){{margin-top:15px}}
strong{{font-weight:700}}
s{{text-decoration:line-through;text-decoration-color:var(--accent);text-decoration-thickness:1.5px}}
.tablewrap{{overflow-x:auto;margin:16px 0 22px;border:1px solid var(--rule);border-radius:var(--radius);background:var(--bg)}}
table{{width:100%;border-collapse:collapse;font-family:"PT Mono","Courier New",monospace;font-size:13.5px;line-height:1.45;font-variant-numeric:tabular-nums}}
th,td{{padding:8px 10px;border-bottom:1px solid var(--rule);vertical-align:top;text-align:left}}
th{{font-family:Oswald,sans-serif;font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--accent-ink);background:var(--paper)}}
tr:last-child td{{border-bottom:none}}
ol{{padding-left:22px}}
a{{color:var(--link)}}
a:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
footer{{margin-top:64px;border-top:1px solid var(--rule);padding-top:14px;color:var(--muted);font-size:14px}}
@media (max-width:600px){{body{{font-size:17px}}header.top h1{{font-size:34px}}header.top h1 small{{font-size:19px}}h1{{font-size:26px}}h2{{font-size:21px}}}}
</style>
<div class="wrap"><div class="sheet">
<header class="top">
<span class="label">Рукопись · сборка от {stamp}</span>
<h1>Штанга 2<small>Следующая попытка</small></h1>
<p>Продолжение романа «Штанга». Рассказчик — Софи Келлер, из 2030-го. Пролог, шесть частей, эпилог, кода и рабочая тетрадь.</p>
<p>Около {novel_words:,} слов романа и {nb_words:,} слов тетради. Числа компаний, отчётов и пилота — условные, см. примечания автора.</p>
</header>
<nav class="toc"><details><summary>Оглавление</summary><ul>{"".join(toc)}</ul></details></nav>
{body.replace("<table>", '<div class="tablewrap"><table>').replace("</table>", "</table></div>")}
<footer>Идея и редактура — Эрик Найман. Текст создан искусственным интеллектом.</footer>
</div></div>
"""
(ROOT/"Штанга-2.html").write_text(page, encoding="utf-8")
print(f"novel words: {novel_words}, workbook words: {nb_words}; wrote Штанга-2.md and Штанга-2.html")
