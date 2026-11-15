from playwright.sync_api import sync_playwright
from pathlib import Path
import json,base64
root=Path(__file__).resolve().parents[1];out=root/'.test-artifacts';out.mkdir(exist_ok=True)
results=[]
def record(name,condition):
 assert condition,name
 results.append(name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=b.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,reduced_motion='reduce')
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4318');page.evaluate('document.fonts.ready');page.screenshot(path=str(out/'home.png'),full_page=True)
 record('Thmanyah Sans loaded',page.evaluate("document.fonts.check('16px \"Thmanyah Sans\"')"))
 page.locator('[data-example=steps]').first.click();page.wait_for_url('**/#studio')
 record('example creates five scenes',page.locator('#scene-list details').count()==5)
 page.wait_for_timeout(500);page.reload();page.wait_for_timeout(200)
 record('example survives real localStorage reload',page.locator('#project-title').input_value()=='من فكرة صغيرة إلى مشروع حيّ')
 page.screenshot(path=str(out/'studio.png'),full_page=True)
 page.locator('#present').click();record('viewer opens',page.locator('#viewer').evaluate('(x)=>x.open'))
 page.locator('#view-content [data-step="1"]').click();record('slide navigation', '2 / 5' in page.locator('#view-content .slide-controls').inner_text())
 page.keyboard.press('Escape');record('Escape closes viewer',not page.locator('#viewer').evaluate('(x)=>x.open'))
 page.locator('[data-editor=source]').click();source=('معلومة مهمة وتفصيل لا يجوز حذفه. '*90)+'نهاية_مهمة'
 page.locator('#source-text').fill(source);page.locator('#generate').click()
 record('source preserved',page.locator('#source-text').input_value()==source)
 record('generated content preserved',page.evaluate("JSON.parse(localStorage.getItem('takween-v4')||'{}').source") is not None)
 page.locator('[data-editor=design]').click();page.locator('#format').select_option('article')
 record('rendered content preserves tail','نهاية_مهمة' in page.locator('#preview').inner_text())
 page.locator('[data-editor=outline]').click();page.locator('#scene-list details').first.locator('summary').click();page.locator('#scene-list details').first.locator('[data-field=title]').fill('عنوان معدل');page.locator('#scene-list details').first.locator('[data-action=delete]').click();page.locator('#undo').click()
 record('undo restores edited scene',page.locator('#scene-list details').first.locator('[data-field=title]').input_value()=='عنوان معدل')
 for width,height in [(360,780),(393,852),(768,1024),(1024,768),(1440,1000)]:
  page.set_viewport_size({'width':width,'height':height})
  if width<=760:page.locator('button[data-panel=preview]').click()
  for fmt in ['article','cards','slides']:
   if width<=760:page.locator('button[data-panel=editor]').click()
   page.locator('[data-editor=design]').click();page.locator('#format').select_option(fmt)
   if width<=760:page.locator('button[data-panel=preview]').click()
   record(f'no horizontal overflow {width} {fmt}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   record(f'no clipped scene {width} {fmt}',page.locator('#preview .scene').evaluate_all('(xs)=>xs.every(x=>x.scrollHeight<=x.clientHeight+2)'))
  if width==393:page.screenshot(path=str(out/'mobile.png'),full_page=True)
 page.set_viewport_size({'width':1440,'height':1000});page.locator('[data-editor=source]').click();page.locator('#source-text').fill('</script><img src=x onerror="window.injected=true">\n\nمرحلة أخيرة');page.locator('#generate').click()
 with page.expect_download() as info:page.locator('#export').click()
 file=out/'export.html';info.value.save_as(file)
 exported=context.new_page();exported.on('pageerror',lambda e:errors.append(str(e)));awaits=[];exported.on('request',lambda r:awaits.append(r.url));context.set_offline(True);exported.set_content(file.read_text());exported.wait_for_timeout(300)
 record('export renders offline',exported.locator('.scene').count()>0)
 record('export text does not execute',exported.evaluate('window.injected!==true'))
 record('export has no network dependency',all(x.startswith(('file:','data:')) for x in awaits))
 record('export embeds original source',exported.evaluate("JSON.parse(document.getElementById('project').textContent).source.includes('مرحلة أخيرة')"))
 record('no JavaScript errors',not errors)
 exported.screenshot(path=str(out/'export.png'),full_page=True)
 context.close();b.close()
(out/'results.json').write_text(json.dumps({'passed':len(results),'checks':results},ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(results),'checks':results},ensure_ascii=False,indent=2))
