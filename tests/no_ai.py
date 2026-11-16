from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
assert sorted(p.name for p in (root/'dist').iterdir())==['app.js','core.js','fonts.css','index.html','styles.css']
package=json.loads((root/'package-lock.json').read_text())
assert len(package['packages'])==1
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page();requests=[];errors=[]
 page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4318/dist/#studio')
 assert page.locator('#local-ai,#ai-status').count()==0
 text='١. الفكرة الأولى\nنص يبقى كاملًا.\n\n٢. الفكرة الثانية\nلا نموذج ولا تنزيل.'
 page.locator('#source-text').fill(text);page.locator('#generate').click()
 assert page.locator('#scene-list details').count()==2
 assert page.locator('#source-text').input_value()==text
 assert all(u.startswith('http://127.0.0.1:4318/') for u in requests),requests
 assert not errors,errors
 b.close()
print('PASS: five-file build, zero dependencies, no AI controls, preserved source, working generation, no external requests or JS errors.')
