import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../supabase/functions/account-management/index.ts', import.meta.url),'utf8').replace(/^import[^\n]*\n/, '')
const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const userId='70000000-0000-0000-0000-000000000001'
const targetId='70000000-0000-0000-0000-000000000002'

function endpoint({admin=false,invalid=false,blocked=false,photoCleanupFailed=false}={}) {
  let handler
  const calls=[]
  const service={storage:{from:bucket=>({remove:async paths=>{calls.push({action:'remove_photo',bucket,paths});return {error:photoCleanupFailed?{message:'storage unavailable'}:null}}})},auth:{getUser:async _token=>({data:{user:invalid?null:{id:userId}},error:invalid?{message:'invalid'}:null}),admin:{
    deleteUser:async id=>{calls.push({action:'delete',id});return {error:null}},
    updateUserById:async(id,data)=>{calls.push({action:'email',id,data});return {error:null}},
    inviteUserByEmail:async(email,data)=>{calls.push({action:'invite',email,data});return {data:{user:{id:targetId}},error:null}},
  },signInWithOtp:async()=>({error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})}
  const scoped={rpc:async(name,args)=>{
    calls.push({rpc:name,args})
    if(name==='is_platform_admin')return {data:admin,error:null}
    if(name==='check_account_deletion')return {error:blocked?{message:'Transfer café ownership first'}:null}
    if(name==='username_available')return {data:true,error:null}
    return {data:null,error:null}
  }}
  const deno={env:{get:key=>key==='SUPABASE_SERVICE_ROLE_KEY'?'service-test-key':'test'},serve:callback=>{handler=callback}}
  new Function('Deno','createClient','exports',compiled)(deno,(_url,key)=>key==='service-test-key'?service:scoped,{})
  return {calls,request:async(body,auth=true)=>handler(new Request('https://example.test/function',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer verified-test-token'}:{})},body:JSON.stringify(body)}))}
}

test('missing or invalid credentials cannot perform account operations',async()=>{
  const missing=endpoint();assert.equal((await missing.request({action:'delete_self',confirmation:'DELETE'},false)).status,401);assert.equal(missing.calls.length,0)
  const invalid=endpoint({invalid:true});assert.equal((await invalid.request({action:'delete_self',confirmation:'DELETE'})).status,401)
})
test('self deletion ignores supplied target IDs and requires explicit confirmation',async()=>{
  const server=endpoint()
  assert.equal((await server.request({action:'delete_self',confirmation:'no',user_id:targetId})).status,400)
  assert.equal((await server.request({action:'delete_self',confirmation:'DELETE',user_id:targetId})).status,200)
  assert.deepEqual(server.calls.filter(call=>call.action==='delete'),[{action:'delete',id:userId}])
  assert.deepEqual(server.calls.find(call=>call.action==='remove_photo'),{action:'remove_photo',bucket:'profile-photos',paths:[`${userId}/profile.jpg`]})
  assert.ok(server.calls.findIndex(call=>call.action==='remove_photo')<server.calls.findIndex(call=>call.action==='delete'))
})
test('ownership and last-admin guards block deletion before the Auth API',async()=>{
  const server=endpoint({blocked:true})
  assert.equal((await server.request({action:'delete_self',confirmation:'DELETE'})).status,400)
  assert.equal(server.calls.some(call=>call.action==='delete'),false)
  assert.equal(server.calls.some(call=>call.action==='remove_photo'),false)
})
test('customers cannot use admin account operations',async()=>{
  for(const action of ['delete_user','update_email','invite_user']){
    const server=endpoint();assert.equal((await server.request({action,user_id:targetId,confirmation:'DELETE',reason:'test change'})).status,403)
    assert.equal(server.calls.some(call=>call.action),false)
  }
})
test('admin email changes are audited and do not silently verify the new email',async()=>{
  const server=endpoint({admin:true})
  assert.equal((await server.request({action:'update_email',user_id:targetId,email:'new@example.test',reason:'Requested email correction'})).status,200)
  assert.deepEqual(server.calls.find(call=>call.action==='email').data,{email:'new@example.test',email_confirm:false})
  assert.ok(server.calls.some(call=>call.rpc==='admin_record_account_action'&&call.args.p_action==='EMAIL_CHANGED'))
})
test('admin user deletion still requires typed confirmation and an audit reason',async()=>{
  const server=endpoint({admin:true})
  assert.equal((await server.request({action:'delete_user',user_id:targetId,confirmation:'DELETE',reason:''})).status,400)
  assert.equal((await server.request({action:'delete_user',user_id:targetId,confirmation:'no',reason:'Delete test user'})).status,400)
  assert.equal((await server.request({action:'delete_user',user_id:targetId,confirmation:'DELETE',reason:'Delete test user'})).status,200)
  assert.ok(server.calls.some(call=>call.action==='delete'&&call.id===targetId))
  assert.deepEqual(server.calls.find(call=>call.action==='remove_photo').paths,[`${targetId}/profile.jpg`])
})

test('photo cleanup failure prevents Auth deletion and can be retried',async()=>{
  const server=endpoint({photoCleanupFailed:true})
  assert.equal((await server.request({action:'delete_self',confirmation:'DELETE'})).status,400)
  assert.equal(server.calls.some(call=>call.action==='delete'),false)
})
