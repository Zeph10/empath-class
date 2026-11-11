"""Compile pack-sources/<pack>/*.json into native LevelDB packs/<pack> and verify the roundtrip."""
import json,glob,os,sys
sys.path.insert(0,os.path.dirname(__file__)); import leveldb as L
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for pack in ['features','classes','macros']:
    items=[]
    for f in sorted(glob.glob(f'{root}/pack-sources/{pack}/*.json')):
        d=json.load(open(f,encoding='utf-8')); key=d.pop('_key')
        items.append((key.encode(),json.dumps(d,separators=(',',':'),ensure_ascii=False).encode()))
    L.write_db(f'{root}/packs/{pack}',items)
    back=L.read_db(f'{root}/packs/{pack}')
    assert back==dict(items),f'{pack}: roundtrip mismatch'
    print(f'{pack}: {len(items)} documents compiled and verified')
