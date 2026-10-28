"""Compare all installed APK contents with the source build, excluding JAR signatures."""
import argparse, hashlib, json, zipfile
from pathlib import Path

def contents(apk):
    with zipfile.ZipFile(apk) as z:
        names=z.namelist()
        if len(names)!=len(set(names)): raise ValueError('Duplicate APK entries')
        def signature(name):
            parts=name.upper().split('/')
            return len(parts)==2 and parts[0]=='META-INF' and (parts[1]=='MANIFEST.MF' or parts[1].endswith(('.SF','.RSA','.DSA','.EC')))
        return {name:hashlib.sha256(z.read(name)).hexdigest() for name in names if not name.endswith('/') and not signature(name)}

def compare(source,signed):
    expected,actual=contents(source),contents(signed)
    changed=sorted(name for name in set(expected)|set(actual) if expected.get(name)!=actual.get(name))
    return {'all_apk_content_matches_source':not changed,'compared_entries':len(expected),'changed_entries':changed,'scope':'Manifest, DEX, resources and assets; only APK/JAR signing material is excluded'}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('signed');parser.add_argument('--output');args=parser.parse_args()
    report=compare(args.source,args.signed);text=json.dumps(report,indent=2)
    if args.output:
        target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text+'\n',encoding='utf-8')
    print(text)
    raise SystemExit(0 if report['all_apk_content_matches_source'] else 1)
