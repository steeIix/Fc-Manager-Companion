import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { parseSave } from '../src/parser'
import { buildWorld } from '../src/model'
import * as db from '../src/snapshots'
import { assignXI, depthIndex, depthRank, opportunity, lineupIndex } from '../src/planning'
async function main() {
 const root=new URL('../',import.meta.url)
 const json=async(n:string)=>JSON.parse(await readFile(new URL(`public/data/${n}.json`,root),'utf8'))
 const [meta,names,nations,vm]=await Promise.all(['meta','names','nations','valuemodel'].map(json))
 const first=await readFile(new URL('tests/fixtures/CmMgr-first',root)), later=await readFile(new URL('tests/fixtures/CmMgr-later',root))
 const buffer=(b:Uint8Array)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer
 const w=buildWorld(parseSave(buffer(first),meta),names,nations,vm), w2=buildWorld(parseSave(buffer(later),meta),names,nations,vm)
 assert.equal(w.youth.length,2); assert.equal(w.youth[0].name,'Youth Fixture'); assert.equal(w.youth[1].player,undefined)
 assert(!w.career.club!.players.some(p=>p.id===112)); assert.equal(w.scouts[0].firstname,'Test'); assert.equal((w.career as any).asOf,undefined); assert.equal(w.players[0].age,null); assert.equal(w.players[0].value,null); assert(w.players[0].birth)
 assert.equal(depthRank(depthIndex(w),w.playerById.get(102)!,'ST').best!.id,101)
 const player=(id:number,ovr:number,positions:string[])=>({id,ovr,pot:ovr,positions,age:25}) as any
 const xi=assignXI([player(1,95,['ST','CM']),player(2,80,['ST'])],['ST','CM'])
 assert.deepEqual(xi.map(p=>p?.id),[2,1])
 assert.equal(assignXI([player(1,90,['CB'])],['CB','CB']).filter(Boolean).length,1)
 assert.equal(depthRank(new Map([['1:ST',[player(1,90,['ST']),player(2,90,['ST'])]]]),{...player(2,90,['ST']),teamId:1},'ST').rank,1)
 const primary = depthIndex(w), lineup = lineupIndex(w)
 assert.equal(opportunity(primary,lineup,w.playerById.get(302)!,'CM',2).blocked,false, 'Second CM fits two user-selected starting slots')
 assert.equal(opportunity(primary,lineup,w.playerById.get(303)!,'CM').slots,null);
 const buried=opportunity(primary,lineup,w.playerById.get(303)!,'CM',2)
 assert.equal(buried.blocked,true); assert.deepEqual(buried.ahead.map(p=>p.id),[301,302])
 assert.equal(opportunity(primary,lineup,w.playerById.get(401)!,'RM').ahead.length,0,'CAM secondary RM must not block a primary RM')
 assert.deepEqual(opportunity(depthIndex(w,true),lineup,w.playerById.get(401)!,'RM').ahead.map(p=>p.id),[402])
 // A complete saved XI supplies exact counts, including three CBs and two CMs.
 const positions=['GK','CB','CB','CB','LB','RB','CM','CM','LW','RW','ST']
 const xiPlayers=positions.map((pos,i)=>({...w.playerById.get(301)!,id:500+i,teamId:9,pos,positions:[pos],squadPos:pos,ovr:95-i}))
 const reserve={...xiPlayers[6],id:599,ovr:70,squadPos:'SUB'}
 const knownWorld={...w,teams:[{...w.teams[0],id:9,players:[...xiPlayers,reserve]}]}
 const knownLineup=lineupIndex(knownWorld), knownDepth=depthIndex(knownWorld)
 assert.equal(opportunity(knownDepth,knownLineup,reserve,'CM').slots,2)
 assert.equal(opportunity(knownDepth,knownLineup,reserve,'CM').source,'Saved XI')
 assert.equal(opportunity(knownDepth,knownLineup,xiPlayers[3],'CB').slots,3)
 assert.equal(opportunity(knownDepth,knownLineup,xiPlayers[7],'CM').blocked,false)
 assert.equal(opportunity(primary,lineup,w.playerById.get(302)!,'CM',1).blocked,true,'Manual slots change fallback opportunities')
 const history=[{season:4,team:32,league:19,position:1,completed:true}]
 assert.equal(db.recoverFinish(history,3,32,19),null,'Previous season result must not fill season 3')
 history.push({season:3,team:32,league:19,position:2,completed:true})
 assert.equal(db.recoverFinish(history,3,32,19),2)
 assert.equal(db.recoverFinish([...history,{season:3,team:32,league:19,position:3,completed:true}],3,32,19),null,'Conflicting observations cannot be guessed')
 assert.equal(db.recoverFinish([{season:3,team:32,league:19,position:2,completed:false}],3,32,19),null,'Interim placement is not final')
 // Migration: create a v1 DB, then open through v3 and retain all observations.
 const oldSnap=db.fromWorld(w,'CmMgr-first'); delete oldSnap.gameId; oldSnap.players[0].age=32;oldSnap.players[0].v=999999;oldSnap.asOf=Date.UTC(2099,0,1);oldSnap.savedAt=1000
 await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('fc26-companion',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots',{keyPath:'id'}).put(oldSnap);r.onsuccess=()=>{r.result.close();resolve()};r.onerror=()=>reject(r.error)})
 assert.equal((await db.allSnapshots('legacy')).length,1);assert.equal((await db.getSnapshot(oldSnap.id))!.players[0].age,null);assert.equal((await db.getSnapshot(oldSnap.id))!.players[0].v,null)
 const game=(await db.listGames())[0]; assert.equal(game.id,'legacy')
 const a=db.fromWorld(w,'CmMgr-first','legacy'), b=db.fromWorld(w2,'CmMgr-later','legacy')
 await db.saveWithFile(a,buffer(first)); await db.saveWithFile(b,buffer(later))
 await db.toggleTarget('legacy',102)
 await db.setHistoryPosition('legacy','3:32:19',2)
 const ordered=await db.allSnapshots('legacy');assert.deepEqual(ordered.map(s=>s.id),[oldSnap.id,a.id,b.id]);assert.deepEqual(ordered.map(s=>s.order),[1,2,3]);assert.equal(ordered[1].players[0].contract,w.players[0].contractUntil)
 // FileReader browser API shim for Node; base64 conversion matches browser data URLs.
 ;(globalThis as any).FileReader=class {result='';onload=()=>{};onerror=()=>{};readAsDataURL(blob:Blob){blob.arrayBuffer().then(b=>{this.result='data:application/octet-stream;base64,'+Buffer.from(b).toString('base64');this.onload()}).catch(()=>this.onerror())}}
 const updated=(await db.listGames())[0], exported=await db.exportGame(updated), imported=await db.importGame(exported)
 assert.deepEqual(imported.shortlist,[102]);assert.equal(imported.historyPositions?.['3:32:19'],2); const importedSnaps=await db.allSnapshots(imported.id)
 assert.equal(importedSnaps.length,3);assert.deepEqual(importedSnaps.map(s=>s.order),[1,2,3]);assert(importedSnaps.every(s=>s.players.every(p=>p.age===null&&p.v===null)))
 for(const s of importedSnaps){const f=await db.getSavedFile(s.id);if(f) assert.deepEqual(new Uint8Array(f.data),new Uint8Array(s.fileName==='CmMgr-later'?buffer(later):buffer(first)))}
 assert.equal((await db.allSnapshots('legacy')).length,3)
 const count=(await db.listGames()).length
 await assert.rejects(()=>db.importGame(JSON.stringify({format:'fc26-companion-game',version:1,game:updated,snapshots:[{id:'bad'}],files:[]})))
 const broken=JSON.parse(exported); broken.files[0].data='!!!';await assert.rejects(()=>db.importGame(JSON.stringify(broken)))
 assert.equal((await db.listGames()).length,count)
 await db.renameSnapshot(a.id,'Early season'); assert.equal((await db.getSnapshot(a.id))!.label,'Early season')
 await db.deleteSnapshot(a.id); assert.equal(await db.getSnapshot(a.id),undefined); assert.equal(await db.getSavedFile(a.id),undefined)
 assert.equal((await db.allSnapshots(imported.id)).length,3)
 const malformed=buffer(first);new DataView(malformed).setUint32(16,0,true);assert.throws(()=>parseSave(malformed,meta),/size/)
 // Upgrade an existing v2 game: date estimates must not determine save order.
 globalThis.indexedDB=new IDBFactory()
 const existingGame={id:'career',name:'Existing career',createdAt:1,shortlist:[102]}
 const v2a={...oldSnap,id:'a',gameId:'career',savedAt:10,asOf:999999}, v2b={...oldSnap,id:'b',gameId:'career',savedAt:20,asOf:1}
 await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('fc26-companion',2);r.onupgradeneeded=()=>{const d=r.result,st=d.createObjectStore('snapshots',{keyPath:'id'});st.put(v2b);st.put(v2a);d.createObjectStore('games',{keyPath:'id'}).put(existingGame);d.createObjectStore('files',{keyPath:'id'}).put({id:'a',gameId:'career',name:'CmMgr-first',data:buffer(first)})};r.onsuccess=()=>{r.result.close();resolve()};r.onerror=()=>reject(r.error)})
 const migrated=await db.allSnapshots('career');assert.deepEqual(migrated.map(s=>[s.id,s.order]),[['a',1],['b',2]]);assert(migrated.every(s=>s.asOf===0&&s.players[0].age===null&&s.players[0].v===null));assert.deepEqual((await db.listGames())[0].shortlist,[102]);assert.deepEqual(new Uint8Array((await db.getSavedFile('a'))!.data),new Uint8Array(first))
 console.log('PASS: binary parsing; youth/scouts; recorded data only; ranking and unique XI; v1/v2 migration and import-order preservation; history recovery and manual corrections; game isolation; shortlist; byte-exact export/import; malformed import rollback; rename; cascade deletion; corrupt save rejection.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
