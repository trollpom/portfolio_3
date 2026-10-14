import { z } from "zod";

const uuid = z.string().uuid();
const inputSchema = z.object({
  id: uuid,
  accessToken: uuid,
  fullName: z.string().trim().min(2).max(100),
  attendance: z.enum(["yes", "no", "maybe"]),
  guests: z.number().int().min(1).max(4),
  companionNames: z.string().trim().max(200),
  menu: z.enum(["meat", "fish", "vegetarian", "any"]),
  drinks: z.array(z.enum(["sparkling", "white", "red", "nonalcoholic"])).max(4),
  notes: z.string().trim().max(800),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
}).strict();

export type RsvpInput = z.infer<typeof inputSchema>;
type RsvpRow = { id:string; access_token_hash:string; full_name:string; attendance:string; guests:number; companion_names:string; menu:string; drinks:string; notes:string; created_at:string };
export type RsvpDatabase = {
  prepare(sql:string): {
    bind(...values:unknown[]): {
      run():Promise<{success?:boolean;meta?:{changes?:number}}>;
      first<T>():Promise<T|null>;
    };
  };
};
const response = (body:unknown,status=200) => Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function hashToken(token:string) {
  const bytes = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
function sameOrigin(request:Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
function publicRow(row:RsvpRow) {
  return {id:row.id,fullName:row.full_name,attendance:row.attendance,guests:row.guests,companionNames:row.companion_names,menu:row.menu,drinks:JSON.parse(row.drinks),notes:row.notes,createdAt:row.created_at};
}

export async function postRsvp(request:Request,db:RsvpDatabase|undefined) {
  if (!sameOrigin(request)) return response({error:"Запрос должен быть отправлен с этого сайта."},403);
  if (!request.headers.get("content-type")?.includes("application/json")) return response({error:"Неверный формат запроса."},415);
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > 8192) return response({error:"Ответ слишком большой."},413);
  let payload:unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 8192) return response({error:"Ответ слишком большой."},413);
    payload = JSON.parse(text);
  } catch {return response({error:"Не удалось прочитать ответ."},400);}
  const parsed = inputSchema.safeParse(payload);
  if (!parsed.success) return response({error:"Проверьте имя, участие и обязательные поля."},400);
  if (!db) return response({error:"Сохранение временно недоступно. Попробуйте позднее."},503);
  const data = parsed.data;
  if (new Set(data.drinks).size !== data.drinks.length) return response({error:"Повторяющиеся предпочтения напитков."},400);
  if (data.attendance === "yes" && data.guests > 1 && !data.companionNames) return response({error:"Укажите имена тех, кто будет с вами."},400);
  const tokenHash = await hashToken(data.accessToken);
  const guests = data.attendance === "yes" ? data.guests : 0;
  const now = new Date().toISOString();
  try {
    const existing = await db.prepare("SELECT id, access_token_hash FROM rsvps WHERE id = ?").bind(data.id).first<{id:string;access_token_hash:string}>();
    if (existing && existing.access_token_hash !== tokenHash) return response({error:"Не удалось сохранить ответ. Обновите страницу."},409);
    const result = await db.prepare("INSERT INTO rsvps (id, access_token_hash, full_name, attendance, guests, companion_names, menu, drinks, notes, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
      .bind(data.id,tokenHash,data.fullName,data.attendance,guests,data.attendance==="yes"?data.companionNames:"",data.attendance==="yes"?data.menu:"",JSON.stringify(data.attendance==="yes"?data.drinks:[]),data.notes,now,now).run();
    if (result.success === false) throw new Error("Database write failed");
    const stored = await db.prepare("SELECT id, access_token_hash, full_name, attendance, guests, companion_names, menu, drinks, notes, created_at FROM rsvps WHERE id = ?").bind(data.id).first<RsvpRow>();
    if (!stored || stored.access_token_hash !== tokenHash) return response({error:"Не удалось сохранить ответ. Попробуйте ещё раз."},409);
    return response({saved:true,id:data.id,duplicate:result.meta?.changes===0,response:publicRow(stored)},existing?200:201);
  } catch {return response({error:"Не удалось сохранить ответ. Попробуйте ещё раз."},503);}
}

export async function getRsvp(request:Request,db:RsvpDatabase|undefined) {
  const id = new URL(request.url).searchParams.get("id");
  const token = request.headers.get("authorization")?.replace(/^Bearer /,"");
  if (!uuid.safeParse(id).success || !uuid.safeParse(token).success) return response({error:"Ответ не найден."},404);
  if (!db) return response({error:"Сохранение временно недоступно."},503);
  try {
    const row = await db.prepare("SELECT id, access_token_hash, full_name, attendance, guests, companion_names, menu, drinks, notes, created_at FROM rsvps WHERE id = ?").bind(id).first<RsvpRow>();
    if (!row || row.access_token_hash !== await hashToken(token!)) return response({error:"Ответ не найден."},404);
    return response({response:publicRow(row)});
  } catch {return response({error:"Ответ временно недоступен."},503);}
}

export async function deleteRsvp(request:Request,db:RsvpDatabase|undefined) {
  if (!sameOrigin(request)) return response({error:"Неверный источник запроса."},403);
  const id = new URL(request.url).searchParams.get("id");
  const token = request.headers.get("authorization")?.replace(/^Bearer /,"");
  if (!uuid.safeParse(id).success || !uuid.safeParse(token).success) return response({error:"Ответ не найден."},404);
  if (!db) return response({error:"Сохранение временно недоступно."},503);
  try {
    const row = await db.prepare("SELECT id, access_token_hash FROM rsvps WHERE id = ?").bind(id).first<{id:string;access_token_hash:string}>();
    if (!row || row.access_token_hash !== await hashToken(token!)) return response({error:"Ответ не найден."},404);
    const result = await db.prepare("DELETE FROM rsvps WHERE id = ? AND access_token_hash = ?").bind(id,row.access_token_hash).run();
    if (result.success === false) throw new Error("Database delete failed");
    return response({deleted:true});
  } catch {return response({error:"Не удалось удалить ответ. Попробуйте ещё раз."},503);}
}
