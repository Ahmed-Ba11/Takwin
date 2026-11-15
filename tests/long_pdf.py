from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess,json
root=Path(__file__).resolve().parents[1];out=root/'.test-artifacts'
# Searchable sentinels test that every original segment reaches the PDF, including final text.
source='\n\n'.join(f'SEGMENT_{i:03d} '+('تفاصيل عربية طويلة يجب أن تبقى كاملة. '*25)+f' END_{i:03d}' for i in range(12))
checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');page.goto('http://127.0.0.1:4318/#studio');page.locator('#project-title').fill('تجربة طويلة / Long export');page.locator('#source-text').fill(source);page.locator('#generate').click();page.locator('[data-editor=design]').click()
 for fmt in ['article','cards','slides']:
  page.locator('#format').select_option(fmt)
  with page.expect_popup() as popup:page.locator('#pdf').click()
  win=popup.value;win.wait_for_load_state();win.evaluate('document.fonts.ready');win.wait_for_timeout(300)
  file=out/f'long-{fmt}.pdf';win.pdf(path=str(file),print_background=True,prefer_css_page_size=True)
  txt=subprocess.check_output(['pdftotext','-layout',str(file),'-'],text=True)
  for i in range(12):
   assert f'SEGMENT_{i:03d}' in txt,(fmt,i,'start missing')
   assert f'END_{i:03d}' in txt,(fmt,i,'end missing')
  checks.append(f'{fmt}: all 12 start/end markers survive PDF pagination');win.close()
 b.close()
(out/'long-pdf-results.json').write_text(json.dumps(checks,indent=2));print('\n'.join(checks))
