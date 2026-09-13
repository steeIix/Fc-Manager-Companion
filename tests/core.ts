import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { parseSave } from '../src/parser'
import { buildWorld } from '../src/model'
import * as db from '../src/snapshots'
import { assignXI, depthIndex, depthRank } from '../src/planning'
async function main() {
 const root=new URL('../',import.meta.url)
 const json=async(n:string)=>JSON.parse(await readFile(new URL(`public/data/${n}.json`,root),'utf8'))
 const [meta,names,nations,vm]=await Promise.all(['meta','names','nations','valuemodel'].map(json))
 const first=await readFile(new URL('tests/fixtures/CmMgr-first',root)), later=await readFile(new URL('tests/fixtures/CmMgr-later',root))
 const buffer=(b:Uint8Array)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer
 const w=buildWorld(parseSave(buffer(first),meta),names,nations,vm), w2=buildWorld(parseSave(buffer(later),meta),names,nations,vm)
 assert.equal(w.youth.length,2); assert.equal(w.youth[0].name,'Youth Fixture'); assert.equal(w.youth[1].player,undefined)
 assert(!w.career.club!.players.some(p=>p.id===112)); assert.equal(w.scouts[0].firstname,'Test'); assert.equal(w.career.asOf.toISOString().slice(0,10),'2029-01-01')
 assert.equal(depthRank(depthIndex(w),w.playerById.get(102)!,'ST').best!.id,101)
 const player=(id:number,ovr:number,positions:string[])=>({id,ovr,pot:ovr,positions,age:25}) as any
 const xi=assignXI([player(1,95,['ST','CM']),player(2,80,['ST'])],['ST','CM'])
 assert.deepEqual(xi.map(p=>p?.id),[2,1])
 assert.equal(assignXI([player(1,90,['CB'])],['CB','CB']).filter(Boolean).length,1)
 assert.equal(depthRank(new Map([['1:ST',[player(1,90,['ST']),player(2,90,['ST'])]]]),{...player(2,90,['ST']),teamId:1},'ST').rank,1)
 // Migration: create a v1 DB, then open through v3 and retain all observations.
 const oldSnap=db.fromWorld(w,'CmMgr-first'); delete oldSnap.gameId
 await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('fc26-companion',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots',{keyPath:'id'}).put(oldSnap);r.onsuccess=()=>{r.result.close();resolve()};r.onerror=()=>reject(r.error)})
 assert.equal((await db.allSnapshots('legacy')).length,1)
 const game=(await db.listGames())[0]; assert.equal(game.id,'legacy')
 const a=db.fromWorld(w,'CmMgr-first','legacy'), b=db.fromWorld(w2,'CmMgr-later','legacy')
 await db.saveWithFile(a,buffer(first)); await db.saveWithFile(b,buffer(later))
 await db.toggleTarget('legacy',102)
 // FileReader browser API shim for Node; base64 conversion matches browser data URLs.
 ;(globalThis as any).FileReader=class {result='';onload=()=>{};onerror=()=>{};readAsDataURL(blob:Blob){blob.arrayBuffer().then(b=>{this.result='data:application/octet-stream;base64,'+Buffer.from(b).toString('base64');this.onload()}).catch(()=>this.onerror())}}
 const updated=(await db.listGames())[0], exported=await db.exportGame(updated), imported=await db.importGame(exported)
 assert.deepEqual(imported.shortlist,[102]); const importedSnaps=await db.allSnapshots(imported.id)
 assert.equal(importedSnaps.length,3)
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
 console.log('PASS: binary parsing; youth/scouts; inferred date; ranking and unique XI; v1 migration; game isolation; shortlist; byte-exact export/import; malformed import rollback; rename; cascade deletion; corrupt save rejection.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
