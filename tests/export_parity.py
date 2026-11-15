from playwright.sync_api import sync_playwright
from pathlib import Path
import base64,json,subprocess
root=Path(__file__).resolve().parents[1];out=root/'.test-artifacts';checks=[]
def check(n,b):
 assert b,n
 checks.append(n)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
 page=ctx.new_page();page.goto('http://127.0.0.1:4318');page.locator('[data-example=steps]').first.click()
 page.locator('[data-editor=design]').click();page.locator('#motion-level').select_option('none')
 for fmt in ['article','cards','slides']:
  page.locator('#format').select_option(fmt)
  with page.expect_download() as info:page.locator('#export').click()
  f=out/f'parity-{fmt}.html';info.value.save_as(f)
  ex=ctx.new_page();ex.set_content(f.read_text());ex.evaluate('document.fonts.ready')
  check(f'identical document markup {fmt}',page.locator('#preview .document').inner_html()==ex.locator('#content .document').inner_html())
  check(f'identical rendered text {fmt}',page.locator('#preview .document').inner_text()==ex.locator('#content .document').inner_text())
  for selector in ['.scene h3','.scene p']:
   check(f'identical font {fmt} {selector}',page.locator('#preview '+selector).first.evaluate('(x)=>getComputedStyle(x).fontFamily')==ex.locator('#content '+selector).first.evaluate('(x)=>getComputedStyle(x).fontFamily'))
  check(f'embedded font available {fmt}',ex.evaluate("document.fonts.check('16px \"Thmanyah Sans\"')"))
  # PDF view is the actual window opened by the product, not a substitute test renderer.
  with page.expect_popup() as pop:page.locator('#pdf').click()
  pdfpage=pop.value;pdfpage.wait_for_load_state();pdfpage.evaluate('document.fonts.ready');pdfpage.wait_for_timeout(400)
  check(f'PDF contains all scenes {fmt}',pdfpage.locator('.scene').count()==5)
  check(f'PDF content matches source rendering {fmt}',all(t in pdfpage.locator('#content').inner_text() for t in ['اكتشف السؤال','ارسم الاحتمالات','حسّن ثم انطلق']))
  pdfpage.pdf(path=str(out/f'{fmt}.pdf'),print_background=True,prefer_css_page_size=True)
  pdfpage.screenshot(path=str(out/f'pdf-{fmt}.png'),full_page=True)
  pdfpage.close();ex.close()
 browser.close()
for fmt in ['article','cards','slides']:
 fonts=subprocess.check_output(['pdffonts',str(out/f'{fmt}.pdf')],text=True)
 check(f'PDF embeds Thmanyah font {fmt}','thmanyah' in fonts.lower() and 'yes' in fonts)
 info=subprocess.check_output(['pdfinfo',str(out/f'{fmt}.pdf')],text=True)
 check(f'PDF contains no JavaScript {fmt}','JavaScript:      no' in info)
(out/'export-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False,indent=2))
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False,indent=2))
