"""Minimal pure-Python LevelDB reader/writer for Foundry compendium packs (no npm/native deps).
Reader: MANIFEST, write-ahead log and SSTable (.ldb, Snappy or uncompressed).
Writer: fresh DB = CURRENT + MANIFEST + one .log holding a WriteBatch of all puts; LevelDB/classic-level
replays the log on open (Foundry then compacts it). Format per google/leveldb doc/log_format.md & table_format.md."""
import struct, os, zlib

# ---- CRC32C (Castagnoli) with LevelDB masking ----
_T=[]
for i in range(256):
    c=i
    for _ in range(8): c=(c>>1)^0x82F63B78 if c&1 else c>>1
    _T.append(c)
def crc32c(data,crc=0):
    crc^=0xFFFFFFFF
    for b in data: crc=_T[(crc^b)&0xFF]^(crc>>8)
    return crc^0xFFFFFFFF
def mask(c): return (((c>>15)|(c<<17))+0xa282ead8)&0xFFFFFFFF
def unmask(m): r=(m-0xa282ead8)&0xFFFFFFFF; return ((r>>17)|(r<<15))&0xFFFFFFFF

def varint(b,i):
    r=s=0
    while True:
        x=b[i]; i+=1; r|=(x&0x7F)<<s; s+=7
        if not x&0x80: return r,i
def enc_varint(n):
    out=bytearray()
    while True:
        if n<0x80: out.append(n); return bytes(out)
        out.append((n&0x7F)|0x80); n>>=7

def snappy_decompress(b):
    n,i=varint(b,0); out=bytearray()
    while i<len(b):
        t=b[i]; i+=1; kind=t&3
        if kind==0:
            ln=t>>2
            if ln>=60: k=ln-59; ln=int.from_bytes(b[i:i+k],'little'); i+=k
            ln+=1; out+=b[i:i+ln]; i+=ln; continue
        if kind==1: ln=((t>>2)&7)+4; off=((t>>5)<<8)|b[i]; i+=1
        elif kind==2: ln=(t>>2)+1; off=int.from_bytes(b[i:i+2],'little'); i+=2
        else: ln=(t>>2)+1; off=int.from_bytes(b[i:i+4],'little'); i+=4
        for _ in range(ln): out.append(out[-off])
    assert len(out)==n,(len(out),n)
    return bytes(out)

# ---- log files (WAL and MANIFEST share this framing) ----
BLOCK=32768
def read_log_records(data):
    recs=[];i=0;buf=b''
    while i+7<=len(data):
        left=BLOCK-(i%BLOCK)
        if left<7: i+=left; continue
        crc,ln,typ=struct.unpack('<IHB',data[i:i+7])
        if typ==0 and ln==0: i+=left; continue
        payload=data[i+7:i+7+ln]
        assert unmask(crc)==crc32c(bytes([typ])+payload),'log CRC mismatch'
        i+=7+ln
        if typ==1: recs.append(payload)
        elif typ==2: buf=payload
        elif typ==3: buf+=payload
        elif typ==4: recs.append(buf+payload); buf=b''
    return recs
def write_log_records(records):
    out=bytearray()
    for rec in records:
        first=True; rest=rec
        while True:
            left=BLOCK-(len(out)%BLOCK)
            if left<7: out+=b'\x00'*left; left=BLOCK
            avail=left-7; frag=rest[:avail]; rest=rest[avail:]; end=not rest
            typ=1 if first and end else 2 if first else 4 if end else 3
            out+=struct.pack('<IHB',mask(crc32c(bytes([typ])+frag)),len(frag),typ)+frag
            first=False
            if end: break
    return bytes(out)

def parse_batch(b):
    seq,count=struct.unpack('<QI',b[:12]); i=12; ops=[]
    for _ in range(count):
        tag=b[i]; i+=1; kl,i=varint(b,i); k=b[i:i+kl]; i+=kl
        if tag==1: vl,i=varint(b,i); v=b[i:i+vl]; i+=vl; ops.append((k,v))
        else: ops.append((k,None))
    return seq,ops

# ---- SSTable ----
def _block_entries(block):
    nrest=struct.unpack('<I',block[-4:])[0]; end=len(block)-4-4*nrest; i=0; key=b''; out=[]
    while i<end:
        shared,i=varint(block,i); ns,i=varint(block,i); vl,i=varint(block,i)
        key=key[:shared]+block[i:i+ns]; i+=ns; out.append((key,block[i:i+vl])); i+=vl
    return out
def _read_block(data,off,size):
    raw=data[off:off+size]; typ=data[off+size]
    return snappy_decompress(raw) if typ==1 else raw
def read_table(data):
    footer=data[-48:]; assert footer[-8:]==bytes.fromhex('57fb808b247547db'),'bad table magic'
    _,i=varint(footer,0); _,i=varint(footer,i)  # metaindex handle
    ioff,i=varint(footer,i); isz,i=varint(footer,i)
    out=[]
    for _,h in _block_entries(_read_block(data,ioff,isz)):
        off,j=varint(h,0); sz,j=varint(h,j)
        for ik,v in _block_entries(_read_block(data,off,sz)):
            tag=struct.unpack('<Q',ik[-8:])[0]; out.append((ik[:-8],tag>>8,tag&0xFF,v))
    return out

def read_db(path):
    """Return {key: value} for a LevelDB directory (tables + logs, newest sequence wins)."""
    best={}
    def put(k,seq,v):
        if k not in best or best[k][0]<seq: best[k]=(seq,v)
    for f in sorted(os.listdir(path)):
        p=os.path.join(path,f); data=open(p,'rb').read()
        if f.endswith('.ldb') or f.endswith('.sst'):
            for k,seq,typ,v in read_table(data): put(k,seq,v if typ==1 else None)
        elif f.endswith('.log') and data:
            for rec in read_log_records(data):
                seq,ops=parse_batch(rec)
                for n,(k,v) in enumerate(ops): put(k,seq+n,v)
    return {k:v for k,(s,v) in best.items() if v is not None}

def write_db(path,items):
    """Create a fresh LevelDB at path containing items (iterable of (bytes key, bytes value))."""
    os.makedirs(path,exist_ok=True)
    for f in os.listdir(path): os.remove(os.path.join(path,f))
    items=sorted(items)
    batch=bytearray(struct.pack('<QI',1,len(items)))
    for k,v in items: batch+=b'\x01'+enc_varint(len(k))+k+enc_varint(len(v))+v
    log_no,manifest_no,next_file=3,2,4
    open(os.path.join(path,f'{log_no:06d}.log'),'wb').write(write_log_records([bytes(batch)]))
    cmp=b'leveldb.BytewiseComparator'
    edit=(enc_varint(1)+enc_varint(len(cmp))+cmp + enc_varint(2)+enc_varint(log_no)
          + enc_varint(3)+enc_varint(next_file) + enc_varint(4)+enc_varint(0))
    open(os.path.join(path,f'MANIFEST-{manifest_no:06d}'),'wb').write(write_log_records([edit]))
    open(os.path.join(path,'CURRENT'),'w').write(f'MANIFEST-{manifest_no:06d}\n')
    open(os.path.join(path,'LOCK'),'wb').close()
