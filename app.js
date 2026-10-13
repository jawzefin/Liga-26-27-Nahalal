import { standings, anyPlayed, teamGames, nextGame, lastGames, homeVenue, played } from "./lib.mjs";

const get = async p => (await fetch(p, { cache: "no-cache" })).json();
const [teams, sched] = await Promise.all([get("data/teams.json"), get("data/schedule.json")]);
const R = sched.rounds, DEF = "4186"; // נהלל
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MON = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const MFULL = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const D = s => { const [y, m, d] = s.split("-"); return new Date(+y, m - 1, +d); };
const todayS = iso(new Date());
// favourite team: stored as a team id
// favourite team: stored as id (older versions stored the team name)
// "team2": a new key resets everyone once (the old "team" key held defaults chosen by mistake); bump it to reset again
const KEY = "team2";
let ME; try { ME = localStorage.getItem(KEY); localStorage.removeItem("team"); } catch {}
if (!teams[ME]) ME = DEF;
// first visit = nothing stored yet (skipped when storage is unavailable, so private mode never loops on the welcome screen)
let needOnboard = false, pick = null, syncUpd = () => {};
try { needOnboard = !localStorage.getItem(KEY); localStorage.setItem("_t", "1"); localStorage.removeItem("_t"); } catch { needOnboard = false; }
const setMe = id => { ME = id; try { localStorage.setItem(KEY, id); } catch {} calM = null; };

const NAV = '<svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8z"/></svg>';
const waze = (v, cls = "") => `<a class="waze ${cls}" target="_blank" rel="noopener" href="https://waze.com/ul?q=${encodeURIComponent(v)}&navigate=yes">${NAV}ניווט ב-Waze</a>`;
const nm = id => teams[id].name.replace(/\s*"צו פיוס"/, "");
const zp = id => teams[id].zp ? '<span class="zp">צו פיוס</span>' : "";
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const ini = id => nm(id).replace(/^(מכבי|הפועל|הפ'|מ\.ס\.|מ\.כ\.|ע\.)\s+/, "")[0];
const STAR = '<svg class="star" viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>';
const logo = (id, star) => `<div class="lg">${teams[id].logo ? `<img src="logos/${teams[id].logo}.png" alt="" loading="lazy">` : `<div class="bd" style="background:hsl(${hue(teams[id].name)} 40% 36%)">${ini(id)}</div>`}${star ? STAR : ""}</div>`;
const score = g => `<bdi dir="ltr">${g.as} - ${g.hs}</bdi>`; // home score on the right, as the teams are laid out
const dmy = s => `${s.slice(8)}/${s.slice(5, 7)}`;
const dayName = s => DAYS[D(s).getDay()];
const dayHdr = s => `<div class="day">יום ${dayName(s)} · ${D(s).getDate()} ${MON[D(s).getMonth()]}</div>`;
const mine = r => r.games.find(g => g.home === ME || g.away === ME);
const sideA = (id, a) => `<a class="s ${a ? "a" : ""}" href="#/team/${id}">${logo(id, id === ME)}<div><span>${nm(id)}</span>${zp(id)}</div></a>`;
const mid = g => played(g) ? `<b>${score(g)}</b>` : g.time ? `<i>${g.time}</i>` : "נגד";
const row = g => `<div class="g">${sideA(g.home)}<div class="vs">${mid(g)}</div>${sideA(g.away, 1)}</div>`;
// home team on the right (first in RTL), away on the left
const tmb = id => `<a class="tm ${id === ME ? "me" : ""}" href="#/team/${id}">${logo(id, id === ME)}${nm(id)}${zp(id)}</a>`;
const head = g => `${tmb(g.home)}@@${tmb(g.away)}`;

let lastTab = "#/table", calM = null, calD = 0, cur = 0;
const tabs = on => `<div class="tabs"><a href="#/table" class="${on == "t" ? "on" : ""}">טבלה</a><a href="#/rounds" class="${on == "r" ? "on" : ""}">מחזורים</a></div>`;
const backBar = (title, sub, right = "") => `<div class="bar"><a class="ic" href="${lastTab}" aria-label="חזרה"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></a><div style="text-align:center"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${right || '<span style="width:44px"></span>'}</div>`;

function table() {
  lastTab = "#/table";
  const rows = standings(R, teams);
  return tabs("t") + `<div class="tbl"><div class="th"><span>#</span><span>קבוצה</span><span>מש׳</span><span>הפרש</span><span>נק׳</span></div>${rows.map(r => `<a class="tr ${r.id === ME ? "fav" : ""}" href="#/team/${r.id}"><span class="ps">${r.pos}</span><span class="tn">${logo(r.id, r.id === ME)}<span class="tt"><b>${nm(r.id)}</b>${zp(r.id)}</span></span><span class="m">${r.p}</span><span class="m" dir="ltr">${r.gd > 0 ? "+" + r.gd : r.gd}</span><span class="pt">${r.pts}</span></a>`).join("")}</div><p class="note">לחיצה על קבוצה פותחת את הדף שלה</p>`;
}

const nextIdx = () => { const i = R.findIndex(r => { const g = mine(r); return g && !played(g) && g.date >= todayS; }); return i < 0 ? R.length - 1 : i; };

function rounds(n) {
  cur = n ? Math.max(0, R.findIndex(r => r.n == n)) : nextIdx();
  const r = R[cur], g = mine(r), d = D(g.date), homeG = g.home === ME;
  lastTab = "#/rounds/" + r.n;
  const by = {}; r.games.filter(x => x !== g).forEach(x => (by[x.date] = by[x.date] || []).push(x));
  const ks = Object.keys(by).sort(), many = ks.length > 1 || ks[0] !== g.date;
  const centre = played(g) ? `<div class="dt mid"><b>${score(g)}</b>${DAYS[d.getDay()]} · ${d.getDate()} ${MON[d.getMonth()]}</div>`
    : `<div class="dt">${DAYS[d.getDay()]}<b>${d.getDate()}</b>${MON[d.getMonth()]}${g.time ? `<i>${g.time}</i>` : ""}</div>`;
  const [a, b] = head(g).split("@@");
  return tabs("r") + `<div class="nav"><a class="ic" ${cur ? `href="#/rounds/${R[cur - 1].n}"` : "disabled"} aria-label="מחזור קודם"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></a>
 <div><h2>מחזור ${r.n}</h2><small>${DAYS[d.getDay()]} · ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}</small></div>
 <a class="ic" ${cur < R.length - 1 ? `href="#/rounds/${R[cur + 1].n}"` : "disabled"} aria-label="מחזור הבא"><svg viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="M9 6l6 6-6 6"/></svg></a></div>
 <div class="prog"><i><b style="width:${(cur + 1) / R.length * 100}%"></b></i><span dir="ltr">${cur + 1} / ${R.length}</span></div>
 <div class="hero"><div class="hh"><span>המשחק של ${nm(ME)}</span><span class="chip">${homeG ? "בית" : "חוץ"}</span></div><div class="hm">${a}${centre}${b}</div></div>
 <div class="sec">שאר המשחקים במחזור<span>${r.games.length - 1}</span></div>
 <div class="list">${ks.map(ds => (many ? dayHdr(ds) : "") + by[ds].map(row).join("")).join("")}</div>
 <p class="note"><span class="zp" style="display:inline">צו פיוס</span> לא משחקת בשבת</p>`;
}

const fxRowOf = (g, id, nx) => {
  const o = g.home === id ? g.away : g.home, [f, a] = g.home === id ? [g.hs, g.as] : [g.as, g.hs];
  return `<a class="fx ${g === nx ? "next" : ""}" href="#/team/${o}"><div class="n">${g.n}</div><div class="o">${logo(o)}<div><b>${nm(o)}</b><small>${g.home === id ? "בית" : "חוץ"}</small></div></div><div class="r">${played(g) ? `<bdi dir="ltr">${f} - ${a}</bdi>` : g.time || "שעה טרם נקבעה"}<small style="display:block;font-weight:600">${dayName(g.date)} ${dmy(g.date)}</small></div></a>`;
};

function team(id) {
  const gs = teamGames(R, id), st = standings(R, teams).find(r => r.id === id), nx = nextGame(gs, todayS), last = lastGames(gs, 5), venue = homeVenue(gs, id);
  const fav = id === ME, opp = g => g.home === id ? g.away : g.home;
  const mine$ = g => g.home === id ? [g.hs, g.as] : [g.as, g.hs];
  const res = g => { const [f, a] = mine$(g); return f > a ? "W" : f < a ? "L" : "D"; };
  const HE = { W: "נ", D: "ת", L: "ה" };
  const sc = g => { const [f, a] = mine$(g); return `<bdi dir="ltr">${f} - ${a}</bdi>`; };
  const days = nx ? Math.round((D(nx.date) - D(todayS)) / 864e5) : 0;
  const nextCard = nx ? (() => { const d = D(nx.date), [a, b] = head(nx).split("@@");
    return `<div class="nx"><div class="hh"><span>המשחק הבא · מחזור ${nx.n}</span><span class="chip">${nx.home === id ? "בית" : "חוץ"}</span></div>
 <div class="hm">${a}<div class="dt">${DAYS[d.getDay()]}<b>${d.getDate()}</b>${MON[d.getMonth()]}</div>${b}</div>
 <div class="nf"><span>${nx.time ? "שעה: " + nx.time : "שעה: טרם נקבעה"}${nx.venue ? " · " + nx.venue : ""}</span><span>${days <= 0 ? "היום" : days == 1 ? "מחר" : "בעוד " + days + " ימים"}</span></div>${nx.venue ? waze(nx.venue) : ""}</div>` })() : "";
  const resRow = g => { const o = opp(g), r = res(g);
    return `<a class="fx res" href="#/team/${o}"><div class="n">${g.n}</div><div class="o">${logo(o)}<div><b>${nm(o)}</b><small>${g.home === id ? "בית" : "חוץ"} · ${dmy(g.date)}</small></div></div><div class="scr">${sc(g)}</div><span class="fm ${r}">${HE[r]}</span></a>`; };
  const ni = Math.max(0, gs.indexOf(nx)), from = Math.max(0, ni - 1), WIN = 6;
  const shown = gs.slice(from, from + WIN);
  const fxRow = g => fxRowOf(g, id, nx);
  const star = `<button class="fav-b ${fav ? "on" : ""}" id="fav" aria-label="הקבוצה שלי"><svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg></button>`;
  return backBar("דף קבוצה", "", star) + `<div class="tp">${logo(id)}<h2>${nm(id)}</h2><div class="pl">${fav ? '<span class="chip">הקבוצה שלי</span>' : ""}${zp(id)}${st.p ? "" : "<span>עוד לא שוחקו משחקים</span>"}</div>${st.form.length ? `<div class="form">${st.form.map(f => `<span class="fm ${f}">${HE[f]}</span>`).join("")}</div>` : ""}</div>
 <div class="kpi"><div class="kt"><div class="kp"><b>${st.pts}</b><span>נקודות</span><small>${st.p} משחקים</small></div>${st.p ? `<span class="chip">מקום ${st.pos}</span>` : ""}</div>
 <div class="wdl">${st.p ? `${st.w ? `<i class="W" style="flex:${st.w}"></i>` : ""}${st.d ? `<i class="D" style="flex:${st.d}"></i>` : ""}${st.l ? `<i class="L" style="flex:${st.l}"></i>` : ""}` : '<i class="E"></i>'}</div>
 <div class="wl"><span>${st.w} נצחונות</span><span>${st.d} תיקו</span><span>${st.l} הפסדים</span></div>
 <div class="k3"><div><b dir="ltr">${st.gf}:${st.ga}</b><span>שערים</span></div><div><b dir="ltr">${st.gd > 0 ? "+" : ""}${st.gd}</b><span>הפרש</span></div><div><b>${st.p ? st.pct + "%" : "—"}</b><span>הצלחה</span></div></div></div>
 ${nextCard}
 ${venue && venue !== nx?.venue ? `<div class="ven"><svg viewBox="0 0 24 24"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><div><small>מגרש בית</small><b>${venue}</b></div>${waze(venue)}</div>` : ""}
 <div class="sec">תוצאות אחרונות</div>
 ${last.length ? `<div class="list">${last.map(resRow).join("")}</div>` : '<div class="dash">עוד לא שוחקו משחקים. התוצאות יופיעו כאן אחרי המחזור הראשון.</div>'}
 <div class="sec">כל המשחקים<span>${gs.length} מחזורים</span></div>
 <div class="list" id="fxl">${shown.map(fxRow).join("")}${gs.length > WIN ? `<button class="more" id="more">הצג את כל ${gs.length} המשחקים</button>` : ""}</div>`;
}

function cal() {
  const games = teamGames(R, ME);
  if (!calM) { const n = games.find(x => x.date >= todayS) || games[games.length - 1], d = D(n.date); calM = new Date(d.getFullYear(), d.getMonth(), 1); calD = d.getDate(); }
  const y = calM.getFullYear(), m = calM.getMonth(), lead = calM.getDay(), nd = new Date(y, m + 1, 0).getDate();
  const by = {}; games.forEach(x => { const d = D(x.date); if (d.getFullYear() == y && d.getMonth() == m) by[d.getDate()] = x; });
  const first = D(games[0].date), last = D(games[games.length - 1].date), pm = new Date(y, m - 1, 1), nx = new Date(y, m + 1, 1);
  const cells = Array(lead).fill("<span></span>").join("") + Array.from({ length: nd }, (_, k) => { const d = k + 1, x = by[d];
    const c = ["", x && "gm", x && x.home === ME && "h", d == calD && "sel", iso(new Date(y, m, d)) == todayS && "td"].filter(Boolean).join(" ");
    return `<button class="${c}" data-d="${d}" aria-label="${d}">${d}<i></i></button>`; }).join("");
  const s = by[calD]; let card = '<div class="empty">אין משחק ביום הזה</div>';
  if (s) { const d = D(s.date), [a, b] = head(s).split("@@");
    card = `<div class="hh"><b>מחזור ${s.n}</b><span>${DAYS[d.getDay()]} · ${d.getDate()} ${MON[d.getMonth()]}${s.time ? " · " + s.time : ""}</span><span class="chip">${s.home === ME ? "בית" : "חוץ"}</span></div><div class="hm">${a}<div class="vs">${played(s) ? `<b>${score(s)}</b>` : "נגד"}</div>${b}</div><a href="#/rounds/${s.n}">למחזור ${s.n} ←</a>`; }
  return backBar("לוח שנה", "המשחקים של " + nm(ME)) + `<div class="cal"><div class="cm"><button class="ic" id="cp" aria-label="חודש קודם" ${pm < new Date(first.getFullYear(), first.getMonth(), 1) ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button><b>${MFULL[m]} ${y}</b><button class="ic" id="cn" aria-label="חודש הבא" ${nx > last ? "disabled" : ""}><svg viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="M9 6l6 6-6 6"/></svg></button></div>
 <div class="wd">${["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map(x => `<div>${x}</div>`).join("")}</div><div class="gr">${cells}</div>
 <div class="lgd"><span><i class="f"></i>בית</span><span><i></i>חוץ</span></div></div><div class="sc">${card}</div>`;
}

const picker = (q, sel) => {
  const list = Object.keys(teams).sort((a, b) => (a === DEF ? -1 : b === DEF ? 1 : 0) || nm(a).localeCompare(nm(b), "he")).filter(t => nm(t).includes(q));
  return `<label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="q" placeholder="חיפוש קבוצה" value="${q}"></label>
 <div class="cl">${list.map(t => `<button class="${t === sel ? "on" : ""}" data-t="${t}"><span class="rd"></span>${logo(t)}<span class="n">${nm(t)}</span>${zp(t)}</button>`).join("") || '<div class="empty">לא נמצאו קבוצות</div>'}</div>`;
};

function settings(q = "") {
  return backBar("הגדרות", "ליגת ילדים ב׳ שרון · 2026/27") + `<div><h2 class="h2">הקבוצה שלי</h2><p class="sub">המשחק של הקבוצה הזאת יופיע ראשון בכל מחזור ובלוח השנה.</p></div>
 ${picker(q, ME)}
 <a class="save" href="${lastTab}">שמירה</a>`;
}

function welcome(q = "") {
  return `<div class="wel"><h2>ברוכים הבאים</h2><p class="sub">ליגת ילדים ב׳ שרון · עונת 2026/27</p></div>
 <div><h2 class="h2">איזו קבוצה אתם עוקבים אחריה?</h2><p class="sub">המשחק שלה יופיע ראשון בכל מחזור ובלוח השנה. אפשר להחליף בכל רגע בהגדרות.</p></div>
 ${picker(q, pick)}
 <button class="save" id="go" ${pick ? "" : "disabled"}>המשך</button>
 <button class="skip" id="skip">דלג, אבחר אחר כך</button>`;
}

function render() {
  const h = location.hash.replace(/^#\/?/, ""), [a, b] = h.split("/");
  const sub = needOnboard || a == "cal" || a == "set" || (a == "team" && teams[b]);
  $("top").style.display = sub ? "none" : "";
  let html;
  if (needOnboard) html = welcome();
  else if (a == "cal") html = cal();
  else if (a == "set") html = settings();
  else if (a == "team" && teams[b]) html = team(b);
  else if (a == "rounds" || /^\d+$/.test(a)) html = rounds(+(b || a) || 0);
  else html = table();
  $("app").innerHTML = html;
  bind(needOnboard ? "welcome" : a, b);
  scrollTo(0, 0);
}

function bind(a, b) {
  if (a == "cal") {
    const g = teamGames(R, ME);
    $("cp").onclick = () => { calM = new Date(calM.getFullYear(), calM.getMonth() - 1, 1); calD = 0; rerender(); };
    $("cn").onclick = () => { calM = new Date(calM.getFullYear(), calM.getMonth() + 1, 1); calD = 0; rerender(); };
    document.querySelectorAll(".gr button").forEach(x => x.onclick = () => { calD = +x.dataset.d; rerender(); });
  } else if (a == "welcome") {
    const draw = q => { $("app").innerHTML = welcome(q); bind("welcome"); };
    document.querySelectorAll(".cl button").forEach(x => x.onclick = () => { pick = x.dataset.t; draw($("q").value); });
    const i = $("q"); i.oninput = () => { const p = i.selectionStart; draw(i.value); $("q").focus(); $("q").setSelectionRange(p, p); };
    const done = id => { setMe(id); needOnboard = false; syncUpd(); if (!location.hash) location.hash = "#/table"; render(); };
    if (pick) $("go").onclick = () => done(pick);
    $("skip").onclick = () => done(DEF);
  } else if (a == "set") {
    document.querySelectorAll(".cl button").forEach(x => x.onclick = () => { setMe(x.dataset.t); rerender(); });
    const i = $("q"); i.oninput = () => { const p = i.selectionStart; $("app").innerHTML = settings(i.value); bind("set"); $("q").focus(); $("q").setSelectionRange(p, p); };
  } else if (a == "team" && teams[b]) {
    $("fav").onclick = () => { setMe(b); rerender(); };
    const more = $("more");
    if (more) more.onclick = () => {
      const gs = teamGames(R, b), nx = nextGame(gs, todayS);
      $("fxl").innerHTML = gs.map(g => fxRowOf(g, b, nx)).join("");
    };
  }
}
const rerender = () => { const y = scrollY; render(); scrollTo(0, y); };
addEventListener("hashchange", render);

// "schedule updated" notice, driven by data/schedule.json (shown for 3 days, dismissible)
{
  const up = sched.updatedAt, day = up.slice(0, 10);
  let seen; try { seen = localStorage.getItem("upd"); } catch {}
  const recent = Date.now() - new Date(up) < 3 * 864e5;
  $("updt").innerHTML = `🔔 לוח המשחקים עודכן בתאריך <bdi>${dmy(day)}/${day.slice(2, 4)}</bdi>`;
  const sync = () => { const h = location.hash; $("upd").hidden = needOnboard || !recent || seen === up || /#\/(cal|set|team)/.test(h); };
  $("ux").onclick = () => { seen = up; try { localStorage.setItem("upd", up); } catch {} sync(); };
  syncUpd = sync; addEventListener("hashchange", sync); sync();
}

let x0;
addEventListener("touchstart", e => (x0 = e.touches[0].clientX));
addEventListener("touchend", e => {
  const h = location.hash.replace(/^#\/?/, "");
  if (!(h.startsWith("rounds") || /^\d+$/.test(h))) return;
  const d = e.changedTouches[0].clientX - x0;
  if (Math.abs(d) > 80) location.hash = "#/rounds/" + R[Math.min(R.length - 1, Math.max(0, cur + (d > 0 ? 1 : -1)))].n;
});

render();
