// Ищет русские строки игры, которых нет в i18n/ua.json, и пишет их в i18n/missing.json.
// Запуск: node tools/i18n-missing.js (нужен пакет typescript: npm i -g typescript).
const ts=(()=>{try{return require('typescript');}catch(_){return require(require('child_process').execSync('npm root -g').toString().trim()+'/typescript');}})();
const fs=require('fs');let s=fs.readFileSync(require('path').join(__dirname,'..','cascade.html'),'utf8');
const i=s.indexOf('/* Язык интерфейса'),j=s.indexOf('</script>',i);s=s.slice(0,i)+s.slice(j);
const lits=[];const re=/<script>([\s\S]*?)<\/script>/g;let m;
while((m=re.exec(s))){const sf=ts.createSourceFile('a.js',m[1],ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const walk=n=>{if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))lits.push(n.text);
  else if(ts.isTemplateExpression(n)){lits.push(n.head.text);n.templateSpans.forEach(sp=>lits.push(sp.literal.text));}
  ts.forEachChild(n,walk);};walk(sf);}
lits.push(s.replace(/<script>[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g,''));
const CY=/[А-Яа-яЁё]/,frags=new Set();
for(let L of lits){if(!CY.test(L))continue;
 for(const part of L.split(/<[^<>]*>/)){const t=part.replace(/\s+/g,' ').trim().replace(/^,|,$/g,'').trim();if(CY.test(t))frags.add(t);}
 for(const mm of L.matchAll(/(?:title|aria-label|placeholder|alt)=["']([^"'<>]*)/g)){const t=mm[1].trim();if(CY.test(t))frags.add(t);}}
const D=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','i18n','ua.json'),'utf8'));
const nw=[...frags].filter(f=>!(f in D)).sort((a,b)=>b.length-a.length);
fs.writeFileSync(require('path').join(__dirname,'..','i18n','missing.json'),JSON.stringify(nw,null,1));
console.log(frags.size,nw.length,nw.reduce((a,b)=>a+b.length,0));nw.slice(0,25).forEach(x=>console.log(JSON.stringify(x.slice(0,110))));
