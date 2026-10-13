const json=(data,status=200,cookie)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const tokenFrom=request=>request.headers.get('Cookie')?.match(/(?:^|;\s*)seat_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
const sessionKey=async token=>'scholarship/admin-sessions/'+await digest(token);
const cookie=(token='',age=0)=>`seat_admin=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export const passwordAuth=env=>typeof env.ADMIN_PASSWORD==='string'&&env.ADMIN_PASSWORD.length>=16;
export async function isOwner(request,env){
 if(env.TESTING_MODE==='true')return true;
 if(env.ADMIN_PASSWORD){if(!passwordAuth(env)||!env.BUCKET)return false;const token=tokenFrom(request);if(!token)return false;const obj=await env.BUCKET.get(await sessionKey(token));if(!obj)return false;const data=await obj.json();return data.expires>Date.now()&&data.passwordVersion===await digest(env.ADMIN_PASSWORD)}
 const email=request.headers.get('oai-authenticated-user-email');return !!env.ADMIN_EMAIL&&!!request.headers.get('oai-authenticated-user-id')&&email?.toLowerCase()===env.ADMIN_EMAIL.toLowerCase();
}
export async function adminApi(request,env){
 const path=new URL(request.url).pathname;if(!['/api/admin/login','/api/admin/logout'].includes(path))return null;
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Origin mismatch'},403);
 if(!env.BUCKET)return json({error:'Storage unavailable'},503);
 const token=tokenFrom(request);
 if(path.endsWith('/logout')){if(token)await env.BUCKET.delete(await sessionKey(token));return json({ok:true},200,cookie())}
 if(!passwordAuth(env))return json({error:'Administrator sign-in is not configured.'},503);
 const key='scholarship/admin-attempts/'+await digest(request.headers.get('CF-Connecting-IP')||'unknown');
 const obj=await env.BUCKET.get(key),previous=obj?await obj.json():null,now=Date.now();
 const attempts=previous&&previous.until>now?previous:{count:0,until:now+15*60*1000};
 if(attempts.count>=10)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
 const saved=await env.BUCKET.put(key,JSON.stringify({...attempts,count:attempts.count+1}),{onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'}});
 if(!saved)return json({error:'Please try signing in again.'},409);
 let input;try{const text=await request.text();if(text.length>2048)throw Error();input=JSON.parse(text)}catch{return json({error:'Invalid sign-in request'},400)}
 if(typeof input.password!=='string'||input.password.length>512)return json({error:'Incorrect password.'},401);
 const actual=await digest(input.password),expected=await digest(env.ADMIN_PASSWORD);let difference=0;for(let i=0;i<expected.length;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);
 if(difference)return json({error:'Incorrect password.'},401);
 const fresh=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 await env.BUCKET.put(await sessionKey(fresh),JSON.stringify({expires:now+12*60*60*1000,passwordVersion:expected}));
 await env.BUCKET.delete(key);
 return json({owner:true},200,cookie(fresh,12*60*60));
}
