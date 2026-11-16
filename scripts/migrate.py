#!/usr/bin/env python3
"""Re-apply the Universal Books rebrand after each upstream sync (idempotent)."""
from pathlib import Path
import os, glob
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

def main():
    REPL = [
        ('com.bilingify.readest','com.universalbooks.app'),
        ('github.com/readest-app/readest','github.com/yashhasan570/UniversalBooks'),
        ('readestVoice','universalbooksVoice'),
        ('READEST_','UNIVERSALBOOKS_'),
        ('readest-app','universalbooks-app'),
        ('send-to-readest','send-to-universalbooks'),
        ('readest.koplugin','universalbooks.koplugin'),
        ('readest-calibre-plugin','universalbooks-calibre-plugin'),
        ('readest-crosspoint-plugin','universalbooks-crosspoint-plugin'),
        ('Readest','UniversalBooks'),
        ('readest','universalbooks'),
    ]
    TEXT_EXTS = {'.ts','.tsx','.js','.jsx','.json','.rs','.toml','.md','.xml','.yml','.yaml','.css','.html','.sh','.txt','.desktop','.snap','.kts','.gradle','.properties','.lua','.kt','.java','.py','.mjs','.swift'}
    SKIP = {'.github', '.git','node_modules','scripts','data'}
    changed = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP]
        for fn in filenames:
            p = Path(dirpath)/fn
            if p.suffix.lower() not in TEXT_EXTS: continue
            try: s = p.read_text(encoding='utf-8')
            except Exception: continue
            o = s
            for a,b in REPL: s = s.replace(a,b)
            if s != o:
                p.write_text(s, encoding='utf-8'); changed += 1
    badge = ROOT/'scripts/icons/badge.png'
    n = 0
    if badge.exists():
        img = Image.open(badge).convert('RGBA')
        targets = glob.glob(str(ROOT/'apps/universalbooks-app/src-tauri/icons/*')) + glob.glob(str(ROOT/'apps/universalbooks-app/public/*.png')) + glob.glob(str(ROOT/'apps/universalbooks-app/public/*.ico'))
        for t in targets:
            p = Path(t)
            if not p.is_file() or 'badge' in p.name.lower(): continue
            name = p.name.lower()
            try:
                if name.endswith('.icns'):
                    img.resize((512,512), Image.LANCZOS).save(p, format='ICNS')
                elif name.endswith('.ico'):
                    img.save(p, format='ICO', sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)])
                else:
                    ref = Image.open(p); w,h = ref.size
                    canvas = Image.new('RGBA',(w,h),(0,0,0,0))
                    inner = img.resize((w,h), Image.LANCZOS)
                    canvas.paste(inner,(0,0),inner)
                    canvas.save(p)
                n += 1
            except Exception:
                pass
    print(f'migrate: {changed} files swept, {n} icon files updated')

if __name__ == '__main__':
    main()
