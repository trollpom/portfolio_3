"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Flower2, Heart, Leaf, Loader2, MapPin, Menu, Send, Trash2, X } from "lucide-react";

const EVENT_DATE = "2027-07-17T15:30:00+03:00";
const STORAGE_KEY = "wedding-anna-mikhail-rsvp";
type Credentials = {id:string;accessToken:string};
type SavedResponse = {id:string;fullName:string;attendance:"yes"|"no"|"maybe";guests:number};
type RsvpAnswer = {saved?:boolean;error?:string;response?:SavedResponse};
const photos = [{src:"/images/couple.webp",caption:"Вместе — наше любимое место"},{src:"/images/details.webp",caption:"Маленькие детали большого дня"},{src:"/images/table.webp",caption:"Вечер, который мы разделим с вами"},{src:"/images/venue.webp",caption:"Среди деревьев, у самой воды"}];

function Botanical({className=""}:{className?:string}) {
  return <svg className={"botanical "+className} viewBox="0 0 110 210" fill="none" aria-hidden="true"><path d="M26 200C66 148 44 89 76 11M39 175C21 171 13 153 17 141c17 4 29 16 22 34Zm10-31c23-1 36-17 35-30-19 1-37 12-35 30Zm-1-27c-22-7-27-24-20-36 17 8 25 22 20 36Zm7-31c22 0 33-14 31-27-19 3-31 12-31 27Zm7-30C43 50 39 33 47 23c16 9 22 22 15 33Zm8-22C87 33 98 17 91 6 76 10 68 21 70 34Z" stroke="currentColor" strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function WeddingPage() {
  const [menuOpen,setMenuOpen]=useState(false);
  const [countdown,setCountdown]=useState<number[]|null>(null);
  const [photoIndex,setPhotoIndex]=useState(0);
  const [mapOpen,setMapOpen]=useState(false);
  const [attendance,setAttendance]=useState("");
  const [guests,setGuests]=useState(1);
  const [drinks,setDrinks]=useState<string[]>([]);
  const [status,setStatus]=useState<"idle"|"saving"|"deleting">("idle");
  const [error,setError]=useState("");
  const [saved,setSaved]=useState<SavedResponse|null>(null);
  const [restoring,setRestoring]=useState(true);
  const credentials=useRef<Credentials|null>(null);
  const photoDialog=useRef<HTMLDialogElement>(null);
  const mapDialog=useRef<HTMLDialogElement>(null);
  const photoTrigger=useRef<HTMLButtonElement|null>(null);
  const formRef=useRef<HTMLFormElement>(null);

  useEffect(()=>{
    const tick=()=>{const total=Math.max(0,Math.floor((new Date(EVENT_DATE).getTime()-Date.now())/1000));setCountdown([Math.floor(total/86400),Math.floor(total%86400/3600),Math.floor(total%3600/60),total%60]);};
    tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    if(!("IntersectionObserver" in window)||media.matches)return;
    document.documentElement.classList.add("has-motion");
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target);}}),{threshold:.06});
    document.querySelectorAll(".reveal").forEach(element=>observer.observe(element));
    const stopMotion=()=>{if(media.matches)document.documentElement.classList.remove("has-motion");};media.addEventListener("change",stopMotion);
    return()=>{observer.disconnect();media.removeEventListener("change",stopMotion);document.documentElement.classList.remove("has-motion");};
  },[]);
  useEffect(()=>{
    let cancelled=false;
    async function restore(){
      try{
        const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;
        const item=JSON.parse(raw) as Credentials;
        if(typeof item.id!=="string"||typeof item.accessToken!=="string"){localStorage.removeItem(STORAGE_KEY);return;}
        credentials.current=item;
        const result=await fetch("/api/rsvp?id="+encodeURIComponent(item.id),{headers:{Authorization:"Bearer "+item.accessToken},cache:"no-store"});
        if(cancelled)return;
        if(result.ok){const data=await result.json() as RsvpAnswer;if(!data.response)throw new Error("Invalid saved response");setSaved(data.response);}
        else if(result.status===404){credentials.current=null;localStorage.removeItem(STORAGE_KEY);}
        else{setError("Не удалось проверить ранее сохранённый ответ. Обновите страницу перед повторной отправкой.");}
      }catch{if(!cancelled)setError("Не удалось проверить сохранённый ответ. Проверьте соединение и обновите страницу.");}
      finally{if(!cancelled)setRestoring(false);}
    }
    void restore();return()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(photoDialog.current?.open){if(event.key==="ArrowLeft"){event.preventDefault();setPhotoIndex(i=>(i-1+photos.length)%photos.length);}if(event.key==="ArrowRight"){event.preventDefault();setPhotoIndex(i=>(i+1)%photos.length);}}
      else if(event.key==="Escape")setMenuOpen(false);
    };document.addEventListener("keydown",handler);return()=>document.removeEventListener("keydown",handler);
  },[]);

  function openPhoto(index:number,trigger:HTMLButtonElement){setPhotoIndex(index);photoTrigger.current=trigger;photoDialog.current?.showModal();document.body.classList.add("dialog-open");}
  function closePhoto(){photoDialog.current?.close();document.body.classList.remove("dialog-open");photoTrigger.current?.focus();}
  function showMap(){setMapOpen(true);mapDialog.current?.showModal();document.body.classList.add("dialog-open");}
  function closeMap(){mapDialog.current?.close();setMapOpen(false);document.body.classList.remove("dialog-open");}

  async function submitRsvp(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(status!=="idle"||restoring)return;
    const form=event.currentTarget;if(!form.reportValidity())return;
    const data=new FormData(form);const name=String(data.get("fullName")||"").trim();
    if(name.length<2){setError("Пожалуйста, укажите имя и фамилию.");return;}
    if(!attendance){setError("Уточните, сможете ли вы прийти.");return;}
    setError("");setStatus("saving");
    if(!credentials.current)credentials.current={id:crypto.randomUUID(),accessToken:crypto.randomUUID()};
    const keys=credentials.current;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(keys));}catch{}
    const payload={...keys,fullName:name,attendance,guests,companionNames:String(data.get("companionNames")||""),menu:String(data.get("menu")||"any"),drinks,notes:String(data.get("notes")||""),consent:data.get("consent")==="on",website:String(data.get("website")||"")};
    try{
      const result=await fetch("/api/rsvp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const answer=await result.json() as RsvpAnswer;if(!result.ok||!answer.saved||!answer.response)throw new Error(answer.error||"Не удалось сохранить ответ.");
      setSaved(answer.response);
    }catch(err){setError(err instanceof Error?err.message:"Не удалось отправить ответ. Проверьте соединение.");}
    finally{setStatus("idle");}
  }
  async function removeRsvp(){
    if(!credentials.current||status!=="idle")return;setStatus("deleting");setError("");
    const keys=credentials.current;
    try{const result=await fetch("/api/rsvp?id="+encodeURIComponent(keys.id),{method:"DELETE",headers:{Authorization:"Bearer "+keys.accessToken}});if(!result.ok&&result.status!==404)throw new Error("Не удалось удалить ответ. Попробуйте снова.");credentials.current=null;try{localStorage.removeItem(STORAGE_KEY);}catch{}setSaved(null);setAttendance("");setGuests(1);setDrinks([]);formRef.current?.reset();}
    catch(err){setError(err instanceof Error?err.message:"Не удалось удалить ответ.");}finally{setStatus("idle");}
  }

  return <>
    <a className="skip-link" href="#main">Перейти к приглашению</a>
    <header className="header"><div className="wrap header-inner"><a className="monogram" href="#home" aria-label="Анна и Михаил">A<span>&</span>M</a><nav className={"navigation "+(menuOpen?"is-open":"")} aria-label="Основная навигация" id="navigation">{[["#invitation","Приглашение"],["#day","Наш день"],["#place","Место"],["#details","Детали"],["#rsvp","Ваш ответ"]].map(([href,label])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{label}</a>)}</nav><div className="header-right"><span className="demo-pill">Демо для портфолио</span><button className="menu-toggle" aria-label={menuOpen?"Закрыть меню":"Открыть меню"} aria-expanded={menuOpen} aria-controls="navigation" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?<X size={21}/>:<Menu size={21}/>}</button></div></div></header>
    <main id="main">
      <section className="hero" id="home"><div className="wrap hero-grid"><div className="hero-copy"><span className="eyebrow">Мы приглашаем вас на нашу свадьбу</span><h1>Анна<span className="ampersand">&</span>Михаил</h1><div className="hero-date"><span>17</span><span>июля<br/>2027</span><span className="date-line"/><span>Суббота<br/>15:30</span></div><p>У каждого счастья есть своя история.<br/>В этот день мы начнём новую главу —<br/>и очень хотим, чтобы вы были рядом.</p><a className="button button-dark" href="#rsvp">Буду рядом <ArrowRight size={17}/></a><a className="hero-scroll" href="#invitation">Листайте наше приглашение <span>↓</span></a></div><div className="hero-visual"><span className="vertical-label">A day to remember · 17.07.2027</span><button className="hero-image" onClick={event=>openPhoto(0,event.currentTarget)} aria-label="Рассмотреть фотографию Анны и Михаила"><img src="/images/couple.webp" width="1086" height="1448" alt="Вымышленные жених и невеста нежно касаются лбами" fetchPriority="high"/><span className="photo-open"><ArrowUpRight size={19}/></span></button><span className="hero-stamp">A<span>forever begins</span>M</span><Botanical className="hero-branch"/></div></div><div className="wrap hero-caption"><span>Два сердца. Одна история.</span><span>С любовью, Анна и Михаил</span></div></section>

      <section className="invitation section" id="invitation"><div className="wrap invitation-wrap reveal"><Flower2 size={32} strokeWidth={.8}/><p className="eyebrow">Дорогие родные и друзья</p><h2>Есть моменты, которые хочется<br/>разделить с <em>самыми близкими.</em></h2><p className="invitation-copy">Скоро мы скажем друг другу «да» — и будем счастливы сказать его в вашем присутствии. Приглашаем вас на тёплый летний вечер: с объятиями, разговорами, музыкой и танцами под звёздами.</p><p className="signature">Анна и Михаил</p><div className="countdown" aria-label="До свадебного дня">{["дней","часов","минут","секунд"].map((label,index)=><div key={label}><strong>{countdown?String(countdown[index]).padStart(2,"0"):"—"}</strong><span>{label}</span></div>)}</div><a className="text-link" href="/wedding.ics" download><CalendarDays size={16}/> Сохранить дату в календарь</a></div><Botanical className="invitation-branch"/></section>

      <section className="section story"><div className="wrap story-grid"><button className="story-photo reveal" aria-label="Рассмотреть свадебный букет" onClick={event=>openPhoto(1,event.currentTarget)}><img src="/images/details.webp" width="1086" height="1448" alt="Белые розы, оливковые ветви и обручальные кольца" loading="lazy"/><span className="image-number">01 / Наша история</span></button><div className="story-copy reveal"><p className="eyebrow">Самое важное — вместе</p><h2>Одна встреча.<br/>Много маленьких радостей.<br/><em>Целая жизнь впереди.</em></h2><p>Когда-то всё началось с обычного разговора. Потом появились общие прогулки, любимые места, свои шутки и чувство, что рядом — твой человек.</p><p>Теперь мы готовимся к новому началу. И хотим, чтобы первый день нашей семейной истории был наполнен теплом людей, которых мы любим.</p><div className="story-note"><Heart size={23} strokeWidth={.9}/><span>Этот день станет особенным,<br/>потому что рядом будете вы.</span></div></div></div></section>

      <section className="section program-section" id="day"><div className="wrap"><div className="section-heading reveal"><div><p className="eyebrow">17 июля 2027</p><h2>Наш день.<br/><em>От первой улыбки до танцев.</em></h2></div><p>Планы на красивую субботу.<br/>Приезжайте чуть заранее —<br/>нам будет приятно обнять каждого.</p></div><ol className="program">{[{time:"15:30",title:"Собираемся вместе",sub:"Приветственные напитки, знакомства и первые фотографии.",icon:Heart},{time:"16:00",title:"Говорим «да»",sub:"Выездная церемония. Самые важные слова в самом тёплом кругу.",icon:Flower2},{time:"17:00",title:"Ужин и тосты",sub:"Большой стол, любимые люди и разговоры, которые хочется продолжать.",icon:Leaf},{time:"20:30",title:"Танцы под звёздами",sub:"Музыка, свадебный торт и ещё один повод быть счастливыми.",icon:Heart}].map(({time,title,sub,icon:Icon})=><li key={time} className="reveal"><span className="program-time">{time}</span><div className="program-icon"><Icon size={25} strokeWidth={1}/></div><h3>{title}</h3><p>{sub}</p></li>)}</ol><div className="program-note reveal"><Clock size={16}/><span>Встречаемся в 15:30 · Провожаем этот день около 23:00</span></div></div></section>

      <section className="section venue-section" id="place"><div className="wrap venue-grid"><div className="venue-copy reveal"><p className="eyebrow">Место, в котором хочется остаться</p><h2>Среди деревьев.<br/>У самой воды.<br/><em>Вместе с вами.</em></h2><p>Представьте тихую загородную усадьбу, летний сад и длинный стол под открытым небом. Мы выбрали такое настроение для нашего дня.</p><div className="venue-address"><MapPin size={23} strokeWidth={1}/><div><strong>Усадьба «Лесной берег»</strong><span>Церемония — в саду · Ужин — на террасе</span></div></div><button className="text-link" onClick={showMap}>Посмотреть схему площадки <ArrowUpRight size={17}/></button><p className="small-note">Площадка вымышленная: это свадебный демопроект для портфолио.</p></div><button className="venue-photo reveal" aria-label="Рассмотреть демонстрационную площадку" onClick={event=>openPhoto(3,event.currentTarget)}><img src="/images/venue.webp" width="1536" height="1024" alt="Вымышленная усадьба с садом и свадебной аркой у озера" loading="lazy"/><span className="venue-image-label">A little place for a big day</span></button></div></section>

      <section className="section details-section" id="details"><div className="wrap details-grid"><div className="details-photo reveal"><button onClick={event=>openPhoto(2,event.currentTarget)} aria-label="Рассмотреть сервировку свадебного ужина"><img src="/images/table.webp" width="1536" height="1024" alt="Свадебный стол со свечами, белыми розами и льняной скатертью" loading="lazy"/></button><span>Маленькие детали. Большое настроение.</span></div><div className="details-copy reveal"><p className="eyebrow">Несколько тёплых пожеланий</p><h2>Настроение<br/><em>нашего праздника.</em></h2><p>Будем рады, если вы поддержите спокойную природную палитру. Главное — чтобы вам было красиво и удобно.</p><div className="palette" aria-label="Цвета дресс-кода">{[{color:"#e6ddd0",name:"Молочный"},{color:"#c4b59e",name:"Песочный"},{color:"#9d9e88",name:"Оливковый"},{color:"#8c7563",name:"Какао"},{color:"#454e40",name:"Лесной"}].map(({color,name})=><div key={name}><span style={{backgroundColor:color}}/><small>{name}</small></div>)}</div><div className="detail-text"><h3>О цветах и подарках</h3><p>Самый ценный подарок — ваше присутствие. Вместо большого букета можно принести одну любимую веточку: мы соберём из них общую композицию.</p></div><div className="detail-text"><h3>О комфорте</h3><p>Часть вечера пройдёт на улице. Возьмите лёгкую накидку и удобную обувь для прогулки по саду.</p></div></div></div></section>

      <section className="section faq-section"><div className="wrap faq-grid"><div className="reveal"><p className="eyebrow">Чтобы всё было легко</p><h2>Важные<br/><em>мелочи.</em></h2></div><div className="faq-list reveal">{[["Можно ли прийти с парой?","Да. В форме отметьте общее количество гостей и укажите имена тех, кто будет с вами. В настоящем приглашении состав гостей можно согласовать с парой."],["Что делать, если пока не уверен?","Выберите «Пока не знаю». Так мы будем понимать ваши планы. Чтобы изменить ответ в демоверсии, удалите его и отправьте новый."],["Что будет, если пойдёт дождь?","В сценарии этого приглашения церемония и ужин могут переехать на крытую террасу. Реальные условия площадки уточняются перед настоящим мероприятием."],["Это настоящая свадьба?","Это демонстрационный проект для портфолио. Пара, дата и площадка вымышлены, фотографии созданы ИИ. Форма работает по-настоящему: можно сохранить ответ с вымышленным именем, посмотреть его после перезагрузки и удалить."]].map(([question,answer])=><details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="section rsvp-section" id="rsvp"><div className="wrap rsvp-grid"><div className="rsvp-copy reveal"><p className="eyebrow">Будем счастливы видеть вас</p><h2>Увидимся<br/><em>в июле?</em></h2><p>Пожалуйста, расскажите о своих планах<br/>до 17 июня 2027 года.<br/>Мы приготовим для вас самое тёплое место.</p><Botanical className="rsvp-branch"/><span className="rsvp-date">17 · 07 · 2027</span></div><div className="rsvp-card reveal"><span className="form-eyebrow">Ваш ответ · RSVP</span>{saved?<div className="saved-response"><span className="saved-icon"><Check size={25} strokeWidth={1.3}/></span><h3>Спасибо, {saved.fullName.split(" ")[0]}.</h3><p>{saved.attendance==="yes"?"Будем ждать встречи и самых крепких объятий.":saved.attendance==="no"?"Спасибо, что сообщили. Будем рады встретиться в другой день.":"Спасибо за ответ. Надеемся, у вас получится присоединиться."}</p><div className="saved-details"><span>Ответ сохранён</span><strong>{saved.attendance==="yes"?"Буду · гостей: "+saved.guests:saved.attendance==="no"?"Не смогу прийти":"Пока не уверен"}</strong></div><p className="saved-note">Этот ответ можно открыть после перезагрузки на этом устройстве. Для изменения удалите его и отправьте новый.</p><button className="text-link delete-link" onClick={removeRsvp} disabled={status!=="idle"}>{status==="deleting"?<Loader2 className="spin" size={15}/>:<Trash2 size={15}/>} Удалить мой демоответ</button></div>:<form ref={formRef} onSubmit={submitRsvp}><div className="field"><label htmlFor="fullName">Имя и фамилия</label><input id="fullName" name="fullName" autoComplete="name" placeholder="Например, Елена Иванова" minLength={2} maxLength={100} required/></div><fieldset className="field"><legend>Сможете разделить этот день с нами?</legend><div className="choice-group">{[["yes","С удовольствием"],["no","Не смогу"],["maybe","Пока не знаю"]].map(([value,label])=><label className={"choice "+(attendance===value?"selected":"")} key={value}><input type="radio" name="attendance" value={value} required checked={attendance===value} onChange={()=>setAttendance(value)}/><span>{label}</span></label>)}</div></fieldset>{attendance==="yes"&&<><div className="field"><label htmlFor="guests">Сколько вас будет, включая вас?</label><select id="guests" name="guests" value={guests} onChange={event=>setGuests(Number(event.target.value))}>{[1,2,3,4].map(count=><option value={count} key={count}>{count===1?"Только я":count+" человека"}</option>)}</select></div>{guests>1&&<div className="field"><label htmlFor="companionNames">Имена тех, кто будет с вами</label><input name="companionNames" id="companionNames" placeholder="Имена ваших спутников" maxLength={200} required/></div>}<div className="field"><label htmlFor="menu">Предпочтения по меню</label><select id="menu" name="menu" defaultValue="any"><option value="any">Буду рад любому варианту</option><option value="meat">Мясо</option><option value="fish">Рыба</option><option value="vegetarian">Вегетарианское меню</option></select></div><fieldset className="field"><legend>Что предпочитаете из напитков?</legend><div className="drink-options">{[["sparkling","Игристое"],["white","Белое вино"],["red","Красное вино"],["nonalcoholic","Безалкогольное"]].map(([value,label])=><label key={value}><input type="checkbox" checked={drinks.includes(value)} onChange={event=>setDrinks(current=>event.target.checked?[...current,value]:current.filter(item=>item!==value))}/><span>{label}</span></label>)}</div></fieldset></>}<div className="field"><label htmlFor="notes">Пожелания или пара тёплых слов</label><textarea id="notes" name="notes" placeholder="Что нам стоит учесть?" maxLength={800}/></div><label className="consent"><input type="checkbox" name="consent" required/><span>Согласен сохранить мой ответ для списка гостей.</span></label><div className="honeypot" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" autoComplete="off" tabIndex={-1}/></div><button className="button button-dark submit-button" type="submit" disabled={status!=="idle"||restoring}>{status==="saving"?<><Loader2 className="spin" size={17}/> Сохраняем ответ</>:restoring?<>Проверяем сохранённый ответ</>:<>Отправить ответ <Send size={16}/></>}</button><p className="form-demo-note">Демо для портфолио: используйте вымышленное имя. Ответ действительно сохранится; его можно удалить по кнопке.</p></form>}{error&&<p className="form-error" role="alert">{error}</p>}</div></div></section>

      <section className="closing"><div className="wrap reveal"><p className="eyebrow">С любовью и нетерпением</p><h2>Этот день будет прекрасным.<br/><em>Потому что вы будете рядом.</em></h2><span className="closing-names">Анна <span>&</span> Михаил</span><span className="closing-date">17 · 07 · 2027</span><Heart size={22} strokeWidth={.8}/></div></section>
    </main>
    <footer className="footer"><div className="wrap"><span>Свадебное приглашение · Демопроект</span><span>Пара и площадка вымышлены · Фотографии созданы ИИ</span><a href="#home">Наверх ↑</a></div></footer>

    <dialog className="photo-dialog" ref={photoDialog} onClose={()=>{document.body.classList.remove("dialog-open");photoTrigger.current?.focus();}} onClick={event=>{if(event.target===event.currentTarget)closePhoto();}} aria-label="Свадебная фотография"><button className="dialog-close" aria-label="Закрыть фото" onClick={closePhoto}><X size={21}/></button><div className="photo-dialog-stage"><button className="photo-nav" aria-label="Предыдущее фото" onClick={()=>setPhotoIndex(i=>(i-1+photos.length)%photos.length)}><ChevronLeft size={23}/></button><img src={photos[photoIndex].src} alt={photos[photoIndex].caption}/><button className="photo-nav" aria-label="Следующее фото" onClick={()=>setPhotoIndex(i=>(i+1)%photos.length)}><ChevronRight size={23}/></button></div><p>{photos[photoIndex].caption}<span>{photoIndex+1} / {photos.length}</span></p></dialog>
    <dialog className="map-dialog" ref={mapDialog} onClose={()=>{setMapOpen(false);document.body.classList.remove("dialog-open");}} aria-labelledby="mapTitle"><button className="dialog-close" aria-label="Закрыть схему" onClick={closeMap}><X size={20}/></button><p className="eyebrow">Лесной берег · Демосхема</p><h2 id="mapTitle">Наш маленький<br/><em>мир на один день.</em></h2>{mapOpen&&<svg className="venue-map" viewBox="0 0 600 340" role="img" aria-label="Иллюстративная схема: усадьба, терраса, сад для церемонии и парковка"><rect width="600" height="340" rx="8" fill="#ebe9df"/><path d="M410 0c-45 96 22 137-17 195-31 47-9 109 55 145h152V0Z" fill="#c5d5d4"/><path d="M0 270C100 242 154 227 210 174s82-95 167-94" stroke="#fbfaf5" strokeWidth="25" fill="none"/><path d="M0 270C100 242 154 227 210 174s82-95 167-94" stroke="#b9b09b" strokeWidth="1" strokeDasharray="6 5" fill="none"/><rect x="266" y="93" width="97" height="67" rx="4" fill="#88795e"/><rect x="266" y="166" width="97" height="27" rx="2" fill="#c8b997"/><rect x="97" y="254" width="87" height="52" rx="4" fill="#d2cbbb"/><circle cx="320" cy="250" r="29" fill="#d9dbbe" stroke="#7d895b"/><g fill="#a9b78b">{[[76,91],[127,123],[171,64],[221,36],[400,303],[222,304],[40,180]].map(([x,y])=><g key={x}><circle cx={x} cy={y} r="18"/><circle cx={x+9} cy={y-8} r="13"/></g>)}</g><g fill="#413f34" fontFamily="Arial,sans-serif" fontSize="13"><text x="280" y="83">Усадьба</text><text x="278" y="211">Терраса</text><text x="277" y="295">Церемония</text><text x="102" y="325">Парковка</text><text x="491" y="185">Озеро</text></g><path d="M319 244c-11-12-19 0 0 13 19-13 11-25 0-13Z" fill="#88795e"/></svg>}<p className="small-note">Иллюстративная схема вымышленной площадки. В настоящем приглашении здесь будут адрес и маршрут к месту свадьбы.</p><button className="button button-dark" onClick={closeMap}>Всё понятно <Check size={17}/></button></dialog>
  </>;
}

