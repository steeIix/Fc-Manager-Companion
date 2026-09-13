"""Synthetic fixtures only; no personal save data. Run from app/ with Python 3."""
import json, struct, datetime, pathlib
root=pathlib.Path(__file__).resolve().parent.parent
meta=json.loads((root/'public/data/meta.json').read_text())
out=root/'tests/fixtures'; out.mkdir(exist_ok=True)
def lilian(y,m=1,d=1): return (datetime.date(y,m,d)-datetime.date(1582,10,14)).days

def fixture(later=False):
    def player(i,name,ovr,pot,pos,age,team=1,also=-1,contract=2031):
        r={v[0]:max(0,v[1]) for v in meta['fields']['players'].values()}
        r.update(playerid=i,overallrating=ovr,potential=pot,birthdate=lilian(2029-age),nationality=21,preferredfoot=1,skillmoves=4,weakfootabilitytypecode=4,height=180,weight=75,contractvaliduntil=contract)
        for n in range(1,8): r[f'preferredposition{n}']=-1
        r['preferredposition1']=pos; r['preferredposition2']=also
        for key in ['acceleration','sprintspeed','finishing','shotpower','shortpassing','dribbling','ballcontrol','strength','stamina','standingtackle','interceptions','defensiveawareness','gkdiving','gkhandling','gkkicking','gkreflexes','gkpositioning']: r[key]=ovr
        return r,dict(playerid=i,teamid=team,position=pos if i!=102 else 28,jerseynumber=i%100),dict(playerid=i,firstname=name,surname='Fixture',commonname='')
    specs=[(101,'Senior',91,91,25,32,1,-1,2029),(102,'Backup',84 if later else 81,90,25,23,2 if later else 1),(103,'Versatile',85,87,14,27,1,10),(104,'Keeper',86,86,0,31),(105,'Left',82,85,7,25),(106,'Right',83,86,3,25),(107,'CentreA',87,88,5,28),(108,'CentreB',86,89,5,24),(109,'WingA',88,90,27,26),(110,'WingB',87,91,23,24),(111,'Midfield',83,90,14,22),(112,'Youth',58,92,25,16,-1),(113,'AcademyMissing',60,88,14,16,-1),(201,'Rival',93,94,25,27,2),(301,'Neves',93,93,14,25,3),(302,'Vitinha',92,92,14,30,3),(303,'ThirdCM',89,91,14,25,3),(401,'Estevao',88,92,12,23,4),(402,'Palmer',89,90,18,27,4,12)]
    ps=[player(*s) for s in specs]
    teams=[]
    for i,name in [(1,'Example FC'),(2,'Rival FC'),(3,'Paris Fixture'),(4,'Chelsea Fixture')]:
        r={v[0]:max(0,v[1]) for v in meta['fields']['teams'].values()}; r.update(teamid=i,teamname=name,overallrating=85,attackrating=87,midfieldrating=84,defenserating=83,clubworth=100000,teamcolor1g=90,teamcolor2r=230,teamcolor3r=80); teams.append(r)
    tables={'players':[p[0] for p in ps if p[0]['playerid']!=113], 'teamplayerlinks':[p[1] for p in ps if p[1]['teamid']>=0], 'editedplayernames':[p[2] for p in ps], 'teams':teams,
      'leagues':[dict(leagueid=1,leaguename='Fixture League',isinternationalleague=0,level=1,iswomencompetition=0)],
      'leagueteamlinks':[dict(teamid=i,leagueid=1) for i in [1,2,3,4]],
      'career_users':[dict(clubteamid=1,commonname='Test Manager',seasoncount=4,wage=10000)],
      'persistent_events':[dict(eventdate=20291001 if later else 20290101)],
      'career_youthplayers':[dict(playerid=i,monthsinsquad=2,potentialvariance=5,swinglowpotential=-3,playertier=2) for i in [112,113]],
      'career_managerhistory':[dict(season=1,teamid=1,leagueid=1,tableposition=3,games_played=54,wins=29,draws=10,losses=15,goals_for=109,goals_against=76,points=96,bigbuyplayername='Long transfer name',bigbuyamount=57000000,jobsecurityscore=100),dict(season=1,teamid=2,leagueid=1,tableposition=9,games_played=1,wins=0,draws=1,losses=0,goals_for=1,goals_against=1,points=1,jobsecurityscore=80)],
      'career_scouts':[dict(scoutid=1,firstname='Test',lastname='Scout',experience=4,knowledge=5,regionid=1,state=2)]}
    chunks=[]
    for name,rows in tables.items():
        known={v[0]:k for k,v in meta['fields'][name].items()}
        keys=list(dict.fromkeys(k for r in rows for k in r if k in known))
        fields=[]; size=0
        for k in keys:
            string=any(isinstance(r.get(k),str) for r in rows); length=128 if string else 4
            fields.append((k,known[k],0 if string else 3,size,length)); size+=length
        b=bytearray(36+16*len(fields)+size*len(rows)); struct.pack_into('<I',b,4,size); struct.pack_into('<H',b,18,len(rows)); b[24]=len(fields)
        for j,(k,short,typ,offset,length) in enumerate(fields): struct.pack_into('<II4sI',b,36+j*16,typ,offset*8,short.encode(),length*8)
        for j,r in enumerate(rows):
            for k,short,typ,offset,length in fields:
                at=36+16*len(fields)+size*j+offset
                if typ==0:
                    value=str(r.get(k,'')).encode()[:127]; b[at:at+len(value)]=value
                else:
                    rl=meta['fields'][name][short][1]
                    struct.pack_into('<I',b,at,(int(r.get(k,max(0,rl)))-rl)&0xffffffff)
        chunks.append((next(k for k,v in meta['tables'].items() if v==name),b))
    header=bytearray(28+8*len(chunks)); header[:8]=b'DB\0\x08\0\0\0\0'; struct.pack_into('<I',header,8,len(header)+sum(len(b) for _,b in chunks)); struct.pack_into('<I',header,16,len(chunks))
    offset=0
    for j,(name,b) in enumerate(chunks): struct.pack_into('<4sI',header,24+j*8,name.encode(),offset); offset+=len(b)
    return b'FBCHUNKS'+header+b''.join(b for _,b in chunks)
for later in [False,True]: (out/('CmMgr-later' if later else 'CmMgr-first')).write_bytes(fixture(later))
print('Created two synthetic career saves')
