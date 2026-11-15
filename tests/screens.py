from playwright.sync_api import sync_playwright
from pathlib import Path
import json
out=Path(__file__).resolve().parents[1]/'.test-artifacts';checks=[]
def check(name,value):
 assert value,name
 checks.append(name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 ctx=b.new_context(reduced_motion='reduce');page=ctx.new_page();page.add_init_script('localStorage.clear()');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for width,height in [(360,780),(393,852),(768,1024),(1024,768),(1440,900)]:
  page.set_viewport_size({'width':width,'height':height});page.goto('http://127.0.0.1:4318/#home');page.evaluate('localStorage.clear()');page.reload()
  check(f'home overflow {width}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  page.locator('[data-example=article]').first.click()
  if width<=760:page.locator('button[data-panel=editor]').click()
  for tab in ['source','outline','design']:
   page.locator('[data-editor='+tab+']').click()
   check(f'editor {tab} {width}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  for theme in ['mist','sand','olive']:
   page.locator('[data-theme='+theme+']').click()
   page.locator('#present').click()
   check(f'viewer {theme} {width}',page.locator('#viewer').evaluate('(x)=>x.scrollWidth<=x.clientWidth+2'))
   check(f'content unclipped {theme} {width}',page.locator('#viewer .scene').evaluate_all('(xs)=>xs.every(x=>x.scrollHeight<=x.clientHeight+2)'))
   page.keyboard.press('Escape')
  if width==393:page.screenshot(path=str(out/'mobile-editor.png'),full_page=True)
 # Explicit reduced motion means no running animation in the real DOM.
 page.locator('#present').click()
 check('reduced motion respected',page.evaluate('document.getAnimations().filter(x=>x.playState==="running").length===0'))
 page.keyboard.press('Escape')
 check('dialog restores focus',page.locator('#present').evaluate('(x)=>document.activeElement===x'))
 page.locator('[data-editor=source]').click();page.locator('#source-text').fill('');page.locator('#generate').click()
 check('empty source explained','أضف نصًا' in page.locator('#toast').inner_text())
 check('empty source does not erase existing work',page.locator('#scene-list details').count()>0)
 check('no runtime exceptions',not errors)
 # Animation is actually present when the OS allows it.
 page.emulate_media(reduced_motion='no-preference');page.locator('[data-editor=design]').click();page.locator('#motion-level').select_option('expressive');page.locator('#present').click()
 check('expressive animations execute',page.evaluate('document.getAnimations().some(x=>x.playState==="running")'))
 b.close()
(out/'screen-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks},indent=2))
print('Passed',len(checks),'screen and interaction checks')
