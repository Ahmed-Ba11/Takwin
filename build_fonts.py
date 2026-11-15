"""Embed original, user-supplied fonts unchanged. Never commit standalone font binaries."""
from pathlib import Path
import base64, hashlib, json
root=Path(__file__).resolve().parent
spec=[('Thmanyah Sans','thmanyahsans-Regular.woff2',400),('Thmanyah Sans','thmanyahsans-Medium.woff2',500),('Thmanyah Sans','thmanyahsans-Bold.woff2',700),('Thmanyah Serif Display','thmanyahserifdisplay-Bold.woff2',700)]
css=[]; hashes={}
for family,name,weight in spec:
    p=root/'thmanyah'/name
    data=p.read_bytes();hashes[name]=hashlib.sha256(data).hexdigest()
    encoded=base64.b64encode(data).decode()
    assert base64.b64decode(encoded)==data
    css.append(f"@font-face{{font-family:'{family}';src:url(data:font/woff2;base64,{encoded}) format('woff2');font-weight:{weight};font-display:swap;}}")
(root/'fonts.css').write_text('\n'.join(css))
(root/'docs'/'font-hashes.json').write_text(json.dumps(hashes,indent=2))
print('Embedded 4 original font files; byte integrity verified.')
