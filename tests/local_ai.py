from playwright.sync_api import sync_playwright
from pathlib import Path
import json
checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page();page.goto('http://127.0.0.1:4318/#studio')
 text='PRIVATE_TEST_TEXT_7349 نص خاص يبقى على الجهاز'
 page.locator('#source-text').fill(text);page.locator('#generate').click()
 before=page.locator('#preview').inner_text();requests=[]
 page.on('request',lambda r:requests.append((r.url,r.post_data)))
 page.route('https://huggingface.co/**',lambda route:route.abort())
 page.on('dialog',lambda d:d.accept())
 page.locator('#local-ai').click()
 page.wait_for_function("document.querySelector('#ai-status').textContent.includes('لم تكتمل')",timeout=30000)
 assert page.locator('#preview').inner_text()==before;checks.append('model download failure preserves preview')
 assert page.locator('#source-text').input_value()==text;checks.append('failure preserves original source')
 assert all('PRIVATE_TEST_TEXT_7349' not in u and 'PRIVATE_TEST_TEXT_7349' not in (body or '') for u,body in requests);checks.append('source absent from network URLs and request bodies')
 assert any('local-ai.worker.js' in u for u,_ in requests);checks.append('real bundled worker loaded')
 assert any('huggingface.co' in u for u,_ in requests);checks.append('worker attempted model assets; no mocked inference')
 b.close()
Path('.test-artifacts/local-ai-results.json').write_text(json.dumps(checks,indent=2));print('\n'.join(checks))
