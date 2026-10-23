(function(){
  var SOURCES = [
    'https://nascardataguy2.github.io/nba-2026-27/data/db.json',
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/db.json'
  ];
  var SSOURCES = [
    'https://nascardataguy2.github.io/nba-2026-27/data/stars.json',
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/stars.json'
  ];
  var PSOURCES = [
    'https://nascardataguy2.github.io/nba-2026-27/data/projections.json',
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/projections.json'
  ];
  var CSOURCES = [
    'https://nascardataguy2.github.io/nba-2026-27/data/context_notes.json',
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/context_notes.json'
  ];
  var RSOURCES = [
    'https://nascardataguy2.github.io/nba-2026-27/data/season.json',
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/season.json'
  ];
  var LPSOURCES = [
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/site/lp.js',
    'https://nascardataguy2.github.io/nba-2026-27/site/lp.js'
  ];
  var GBASE = [
    'https://nascardataguy2.github.io/nba-2026-27/data/games/',
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/games/'
  ];
  var WSOURCES = [
    'https://nascardataguy2.github.io/nba-2026-27/data/wowy.json',
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/wowy.json'
  ];
  var NAMES = {ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',LAC:'LA Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'};
  // Team primary colors (Color 1 from teamcolorcodes.com NBA team color codes).
  var TEAMC = {ATL:'#E03A3E',BOS:'#007A33',BKN:'#000000',CHA:'#1D1160',CHI:'#CE1141',CLE:'#860038',DAL:'#00538C',DEN:'#0E2240',DET:'#C8102E',GSW:'#1D428A',HOU:'#CE1141',IND:'#002D62',LAC:'#C8102E',LAL:'#552583',MEM:'#5D76A9',MIA:'#98002E',MIL:'#00471B',MIN:'#0C2340',NOP:'#0C2340',NYK:'#006BB6',OKC:'#007AC1',ORL:'#0077C0',PHI:'#006BB6',PHX:'#1D1160',POR:'#E03A3E',SAC:'#5A2D81',SAS:'#C4CED4',TOR:'#CE1141',UTA:'#002B5C',WAS:'#002B5C'};
  var LIGHT = {SAS:1};
  var db = null, srcById = {};
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function srcLink(id){ return ''; }
  function tm(code, first){
    if (!code) return '';
    var bg = TEAMC[code] || '#5d6370', fg = LIGHT[code] ? '#15171c' : '#ffffff';
    return '<span class="tm' + (first ? ' first' : '') + '" style="background:' + bg + ';color:' + fg + '" title="' + esc(NAMES[code] || code) + '">' + esc(code) + '</span>';
  }

  function fetchFirst(urls, asText){
    var i = 0;
    function next(){
      if (i >= urls.length) return Promise.reject(new Error('all sources failed'));
      var u = urls[i++] + (urls[i-1].indexOf('github.io') > -1 ? ('?t=' + Date.now()) : '');
      return fetch(u, {cache:'no-store'}).then(function(r){
        if (!r.ok) throw new Error('bad status');
        return asText ? r.text() : r.json();
      }).catch(next);
    }
    return next();
  }

  function quick(){
    var q = db.quickhits || {};
    function panel(cls, title, hint, items, fn){
      items = (items || []).filter(function(it){ return keep(it.team); });
      if (!items.length) return '';
      return '<div class="panel ' + cls + '"><h2>' + title + '</h2><p class="hint">' + hint + '</p>' + items.map(fn).join('') + '</div>';
    }
    function simple(it){ return '<div class="hit"><span class="who">' + esc(it.player) + '</span>' + tm(it.team) + tn(it.team, it.player) + bdg(it.player) + '<p>' + esc(it.text) + '</p>' + srcLink(it.source) + '</div>'; }
    var st = q.storylines || {}, sd = '';
    if (st.date){ var dd = new Date(st.date + 'T12:00:00'); sd = isNaN(dd) ? st.date : dd.toLocaleDateString('en-US', {month:'short', day:'numeric'}); }
    var html = (Object.keys(SLATE).length ? '<div class="toolbar">' + tbtn() + '</div>' : '') + panel('story', 'Today\u2019s Storylines', 'The biggest news for the slate' + (sd ? ' \u00b7 updated ' + esc(sd) : '') + '.', st.items, simple) +
      '<div class="grid">' +
      panel('sits', 'If He Sits, Who Benefits', 'Check this when late injury news drops before lock.', q.if_sits, function(it){
        return '<div class="hit"><span class="who">' + esc(it.out) + '</span>' + tm(it.team) + tn(it.team, it.out) + ' <span class="arrow">\u2192</span> <span class="who">' + esc(it.benefits) + '</span>' + bdg(it.benefits) + '<p>' + esc(it.text) + '</p>' + srcLink(it.source) + '</div>';
      }) +
      panel('up', 'Role Up', 'New team or bigger job. Early-season prices often lag behind these changes.', q.role_up, simple) +
      panel('down', 'Role Down', 'Last season\u2019s numbers probably will not repeat.', q.role_down, simple) +
      panel('rest', 'Rest Watch', 'Players likely to sit back-to-backs or get rest days early.', q.rest_watch, simple) +
      panel('out', 'Out to Start the Season', 'Known injuries as of the latest episodes.', q.out_to_start, simple) +
      '</div>';
    if (TONLY && html.indexOf('class="hit"') < 0) html += '<p class="sub">No quick hits for tonight\u2019s teams.</p>';
    $('v-quick').innerHTML = html;
  }

  var BADGES = [['minutes','Minutes'],['usage','Usage'],['threes','Threes'],['rebounds','Rebounds'],['assists','Assists'],['stocks','Stocks']];
  var bOn = {}, BMAP = {};
  function nkey(s){
    s = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.']/g, '').replace(/\u2019/g, '').trim();
    return s.replace(/ (iii|ii|jr)$/, '');
  }
  var SLATE = {}, OUTN = {}, TONLY = false;
  function onSlate(team){ return !!SLATE[team]; }
  function tn(team, name){
    if (!SLATE[team]) return '';
    if (name && OUTN[nkey(name)]) return '<span class="tn out">Out tonight</span>';
    return '<span class="tn">Tonight</span>';
  }
  function keep(team){ return !TONLY || !!SLATE[team]; }
  function tbtn(){ return '<button class="tonly' + (TONLY ? ' on' : '') + '" type="button" aria-pressed="' + (TONLY ? 'true' : 'false') + '">Tonight only</button>'; }
  function syncToggles(){
    var b = document.querySelectorAll('.tonly-slot');
    for (var i = 0; i < b.length; i++) b[i].innerHTML = Object.keys(SLATE).length ? tbtn() : '';
  }
  function renderAll(){
    if (!db) return;
    syncToggles(); quick(); ranks(); teams(); players(); injuries(); moves(); research();
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('.tonly') : null;
    if (!t) return;
    TONLY = !TONLY; renderAll();
  });
  function badgeInit(){
    (db.picks || []).forEach(function(p){ BMAP[nkey(p.player)] = p; });
    var icons = db.badge_icons || {};
    $('r4p-bfilter').innerHTML = BADGES.map(function(b){
      return '<button class="bf" data-b="' + b[0] + '" type="button"><img alt="" src="' + (icons[b[0]] || '') + '"/>' + b[1] + '</button>';
    }).join('');
    var btns = document.querySelectorAll('#r4p-bfilter .bf');
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', function(){
      var k = this.getAttribute('data-b'); bOn[k] = !bOn[k]; this.classList.toggle('on', !!bOn[k]); ranks();
    });
  }
  function badgesOf(name){ var p = BMAP[nkey(name)]; return p ? p.badges : {}; }
  function bdg(name){
    var p = BMAP[nkey(name)], icons = db.badge_icons || {};
    if (!p) return '';
    var out = BADGES.map(function(b){
      var tier = p.badges[b[0]];
      if (!tier) return '';
      var rk = p.ranks && p.ranks[b[0]] ? ' (No. ' + p.ranks[b[0]] + ')' : '';
      var tip = (tier === 'gold' ? 'Gold ' : 'Silver ') + b[1] + rk;
      return '<span class="bdg ' + tier + '" title="' + esc(tip) + '"><img alt="' + esc(tip) + '" src="' + (icons[b[0]] || '') + '"/></span>';
    }).join('');
    return out ? '<span class="bdgs">' + out + '</span>' : '';
  }

  function ranks(){
    var q = $('r4p-rq').value.trim().toLowerCase(), pos = $('r4p-rpos').value, fl = $('r4p-rflag').value;
    var all = db.rankings || [];
    var list = all.filter(function(r){
      if (pos && (',' + r.pos.replace(/\s/g,'') + ',').indexOf(',' + pos + ',') < 0) return false;
      if (fl && r.flag !== fl) return false;
      if (!keep(r.team)) return false;
      var bb = badgesOf(r.player);
      for (var k in bOn) if (bOn[k] && !bb[k]) return false;
      if (!q) return true;
      return (r.player + ' ' + r.team + ' ' + (NAMES[r.team] || '')).toLowerCase().indexOf(q) > -1;
    });
    $('r4p-rcount').textContent = list.length + ' of ' + all.length + ' players';
    $('r4p-ranklist').innerHTML = list.map(function(r){
      return '<div class="rk-row"><div class="rk-n">' + r.rank + '</div><div><span class="rk-name">' + esc(r.player) + '</span>' + tm(r.team) + '<span class="rk-pos">' + esc(r.pos) + '</span>' + tn(r.team, r.player) + bdg(r.player) +
        (r.flag ? '<span class="tag ' + esc(r.flag) + '">' + esc(r.change) + '</span>' : '') + '</div>' +
        (r.note ? '<p class="rk-note">' + esc(r.note) + '</p>' : '') + '</div>';
    }).join('') || '<div class="rk-row"><div></div><p class="rk-note">No players match.</p></div>';
  }

  function teamOptions(sel){
    var codes = {};
    db.teams.forEach(function(t){ if (t.team) codes[t.team] = 1; });
    db.players.forEach(function(p){ if (p.team) codes[p.team] = 1; });
    Object.keys(codes).sort().forEach(function(c){
      var o = document.createElement('option'); o.value = c; o.textContent = c + ' \u2013 ' + (NAMES[c] || c); sel.appendChild(o);
    });
  }

  function teams(){
    var t = $('r4p-team').value;
    var list = db.teams.slice().sort(function(a,b){ return a.team < b.team ? -1 : 1; }).filter(function(x){ return (!t || x.team === t) && keep(x.team); });
    $('r4p-teamcards').innerHTML = list.map(function(x){
      return '<div class="card"><h3>' + esc(NAMES[x.team] || x.team) + tm(x.team) + tn(x.team) + '</h3>' +
        '<span class="lbl">Projected starters</span><div class="row">' + esc(x.starters) + '</div>' +
        (x.bench ? '<span class="lbl">Bench order</span><div class="row">' + esc(x.bench) + '</div>' : '') +
        (x.backup_c ? '<span class="lbl">Backup center</span><div class="row">' + esc(x.backup_c) + '</div>' : '') +
        (x.coach ? '<span class="lbl">Coach</span><div class="row">' + esc(x.coach) + '</div>' : '') +
        '<span class="lbl">Notes</span><div class="row">' + esc(x.notes) + '</div>' + srcLink(x.source) + '</div>';
    }).join('') || '<p class="sub">No team preview has been processed for this team yet.</p>';
  }

  function playerCard(p){
    var pills = '';
    if (/starter/i.test(p.role)) pills += '<span class="pill start">' + esc(p.role) + '</span>';
    else if (p.role) pills += '<span class="pill">' + esc(p.role) + '</span>';
    if (p.status && !/^healthy$/i.test(p.status)) pills += '<span class="pill hurt">Health note</span>';
    return '<div class="card"><h3>' + esc(p.player) + ' ' + tm(p.team) + tn(p.team, p.player) + bdg(p.player) + '</h3>' + pills +
      (p.minutes ? '<span class="lbl">Minutes</span><div class="row">' + esc(p.minutes) + '</div>' : '') +
      (p.usage ? '<span class="lbl">Usage</span><div class="row">' + esc(p.usage) + '</div>' : '') +
      (p.status ? '<span class="lbl">Health</span><div class="row">' + esc(p.status) + '</div>' : '') +
      (p.note ? '<span class="lbl">Note</span><div class="row">' + esc(p.note) + '</div>' : '') + srcLink(p.source) + '</div>';
  }

  function players(){
    var q = $('r4p-q').value.trim().toLowerCase(), t = $('r4p-pteam').value;
    var list = db.players.filter(function(p){
      if (t && p.team !== t) return false;
      if (!keep(p.team)) return false;
      if (!q) return true;
      return (p.player + ' ' + p.team + ' ' + (NAMES[p.team] || '') + ' ' + p.role + ' ' + p.minutes + ' ' + p.usage + ' ' + p.status + ' ' + p.note).toLowerCase().indexOf(q) > -1;
    }).sort(function(a,b){ return (a.team + a.player) < (b.team + b.player) ? -1 : 1; });
    $('r4p-count').textContent = list.length + ' of ' + db.players.length + ' players';
    $('r4p-playercards').innerHTML = list.map(playerCard).join('');
  }

  function injuries(){
    $('r4p-injcards').innerHTML = db.injuries.slice().filter(function(p){ return keep(p.team); }).sort(function(a,b){ return a.team < b.team ? -1 : 1; }).map(function(p){
      return '<div class="card"><h3>' + esc(p.player) + ' ' + tm(p.team) + tn(p.team, p.player) + bdg(p.player) + '</h3><div class="row">' + esc(p.status) + '</div>' + (p.note ? '<div class="row">' + esc(p.note) + '</div>' : '') + srcLink(p.source) + '</div>';
    }).join('') || '<p class="sub">No injury notes for tonight\u2019s teams.</p>';
  }

  function moves(){
    var q = $('r4p-mq').value.trim().toLowerCase();
    $('r4p-movecards').innerHTML = db.moves.filter(function(m){
      if (!keep(m.to)) return false;
      return !q || (m.player + ' ' + m.from + ' ' + m.to + ' ' + (NAMES[m.from]||'') + ' ' + (NAMES[m.to]||'')).toLowerCase().indexOf(q) > -1;
    }).map(function(m){
      return '<div class="card"><h3>' + esc(m.player) + tn(m.to, m.player) + bdg(m.player) + '</h3><div class="row">' + (m.from ? tm(m.from, true) : 'Unknown') + ' <span class="arrow">\u2192</span> ' + tm(m.to, true) + (m.type ? ' \u00b7 ' + esc(m.type) : '') + '</div>' + (m.note ? '<div class="row">' + esc(m.note) + '</div>' : '') + srcLink(m.source) + '</div>';
    }).join('');
  }


  var PJ = null;
  function n1(v){ return (v == null || isNaN(v)) ? '\u2013' : (Math.round(v * 10) / 10).toFixed(1); }
  function money(v){ return v ? '$' + (v / 1000).toFixed(1) + 'K' : '\u2013'; }
  function gameTime(t){
    if (!t) return '';
    var d = new Date(t);
    return isNaN(d) ? '' : d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', timeZone:'America/New_York'}) + ' ET';
  }
  function setSub(){
    if (!db) return;
    var up = db.updated;
    if (PJ && PJ.date && PJ.date > up) up = PJ.date;
    $('r4p-sub').textContent = 'Updated ' + up + ' \u00b7 ' + db.players.length + ' players \u00b7 ' + db.teams.length + ' teams';
  }
  function projInit(d){
    PJ = d;
    setSub();
    var today = new Date().toLocaleDateString('en-CA', {timeZone:'America/New_York'});
    SLATE = {}; OUTN = {};
    if (d.date === today){
      (d.games || []).forEach(function(g){ SLATE[g.away] = 1; SLATE[g.home] = 1; });
      (d.out || []).forEach(function(o){ OUTN[nkey(o.player)] = 1; });
    }
    renderAll();
    var dd = new Date(d.date + 'T12:00:00');
    var day = isNaN(dd) ? d.date : dd.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'});
    var acc = d.accuracy ? ' Our minutes have missed by ' + n1(d.accuracy.our_min_miss) + ' a player on average over ' + d.accuracy.days + (d.accuracy.days === 1 ? ' night' : ' nights') + '.' : '';
    $('r4p-psub').textContent = day + ' \u00b7 ' + d.players.length + ' players \u00b7 updated ' + d.updated + '.' + acc;
    $('r4p-games').innerHTML = (d.games || []).map(function(g){
      var fav = g.fav ? esc(g.fav) + ' \u2212' + n1(g.line) : 'Even';
      return '<div class="gm"><div class="gm-t">' + tm(g.away, true) + ' <span class="gm-at">at</span> ' + tm(g.home, true) + '<span class="gm-time">' + esc(gameTime(g.time)) + '</span></div>' +
        '<div class="gm-l">Total ' + n1(g.ou) + ' \u00b7 ' + fav + '</div>' +
        '<div class="gm-l">' + esc(g.away) + ' ' + n1(g.away_pts) + ' \u00b7 ' + esc(g.home) + ' ' + n1(g.home_pts) + '</div></div>';
    }).join('');
    var sel = $('r4p-pgame');
    (d.games || []).forEach(function(g){ var o = document.createElement('option'); o.value = g.away + '|' + g.home; o.textContent = g.away + ' at ' + g.home; sel.appendChild(o); });
    var outs = d.out || [];
    $('r4p-pout').innerHTML = outs.length ? '<div class="panel out-list"><h2>Ruled Out Tonight</h2>' + outs.map(function(o){
      return '<div class="hit"><span class="who">' + esc(o.player) + '</span>' + tm(o.team) + '<p>' + esc(o.note) + '</p></div>';
    }).join('') + '</div>' : '';
    proj();
  }
  // Player notes: everything we know about a player, opened by the notes icon.
  var CTX = {}, NOPEN = {};
  var NICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.5 1.8h6.2l2.8 2.8v9.6h-9zM5.6 7h4.8M5.6 9.6h4.8M5.6 12.2h3"/></svg>';
  function noteBits(name){
    var k = nkey(name), out = [], seen = {};
    function same(x){ return nkey(x) === k; }
    function add(lbl, txt){ txt = String(txt == null ? '' : txt).trim(); if (!txt || seen[txt]) return; seen[txt] = 1; out.push([lbl, txt]); }
    if (CTX[k]) add('Tonight', CTX[k]);
    if (SS){
      (SS.stars || []).concat(SS.scrubs || []).forEach(function(p){
        if (same(p.player) && p.why && !(CTX[k] && p.why.indexOf(CTX[k]) === 0)) add('Why', p.why);
      });
    }
    if (PJ) PJ.players.forEach(function(p){ if (same(p.player)) add('Projection', p.note); });
    if (db){
      db.players.forEach(function(p){
        if (!same(p.player)) return;
        add('Role', p.role);
        add('Minutes', p.minutes);
        add('Usage', p.usage);
        if (p.status && !/^healthy$/i.test(p.status)) add('Health', p.status);
        add('Note', p.note);
      });
      (db.injuries || []).forEach(function(p){ if (same(p.player)){ add('Injury', p.status); add('Injury', p.note); } });
      var q = db.quickhits || {};
      [['role_up','Role up'], ['role_down','Role down'], ['rest_watch','Rest watch'], ['out_to_start','Out to start']].forEach(function(x){
        (q[x[0]] || []).forEach(function(it){ if (same(it.player)) add(x[1], it.text); });
      });
      ((q.storylines || {}).items || []).forEach(function(it){ if (same(it.player)) add('Storyline', it.text); });
      (q.if_sits || []).forEach(function(it){
        var outs = String(it.out || '').split(' or '), ben = String(it.benefits || '').split(' and ');
        if (outs.some(same)) add('If he sits', it.benefits ? it.benefits + ' benefits. ' + it.text : it.text);
        else if (ben.some(same)) add('If ' + it.out + ' sits', it.text);
      });
      (db.moves || []).forEach(function(m){
        if (same(m.player)) add('Move', (m.from || 'Unknown') + ' to ' + m.to + (m.type ? ' (' + m.type + ')' : '') + (m.note ? '. ' + m.note : ''));
      });
    }
    return out;
  }
  function noteHtml(bits){
    return '<div class="nt-box">' + bits.map(function(b){ return '<p class="nt"><b>' + esc(b[0]) + ':</b> ' + esc(b[1]) + '</p>'; }).join('') + '</div>';
  }
  function nbtn(name, has){
    if (!has) return '';
    var on = !!NOPEN[nkey(name)];
    return '<button class="nb' + (on ? ' on' : '') + '" type="button" data-n="' + esc(name) + '" aria-expanded="' + on + '" title="Notes" aria-label="Notes for ' + esc(name) + '">' + NICON + '</button>';
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('.nb, .pj-name.has') : null;
    if (!t) return;
    var n = t.getAttribute('data-n'), k = nkey(n);
    NOPEN[k] = !NOPEN[k];
    proj(); research(); optPool();
  });

  var PCOLS = [
    ['player','Player','t'], ['pos','Pos','p'], ['salary','Sal','n'], ['team','Team','t'], ['opp','Opp','t'],
    ['ou','O/U','n'], ['spread','Spread','s'], ['dk','DK','n'], ['value','Val','n'], ['min','Min','n'], ['usg','Usg','n'],
    ['pts','Pts','n'], ['reb','Reb','n'], ['ast','Ast','n'], ['stl','Stl','n'], ['blk','Blk','n'], ['to','TO','n']
  ];
  var HEAT = {ou:1, dk:1, value:1, min:1, usg:1, pts:1, reb:1, ast:1, stl:1, blk:1, to:-1};
  var PSORT = {key:'dk', dir:-1};
  var POSORD = {PG:1, SG:2, SF:3, PF:4, C:5, G:1.5, F:3.5};
  function heatCss(key, v){
    if (!HEAT[key] || v == null || !PJ) return '';
    var vals = PJ.players.map(function(p){ return p[key]; }).filter(function(x){ return x != null; });
    if (vals.length < 3) return '';
    var lo = 0, eq = 0;
    for (var i = 0; i < vals.length; i++){ if (vals[i] < v) lo++; else if (vals[i] === v) eq++; }
    var t = (lo + eq / 2) / vals.length;
    if (HEAT[key] < 0) t = 1 - t;
    if (t >= 0.6) return 'background:rgba(31,122,77,' + ((t - 0.6) / 0.4 * 0.20).toFixed(3) + ')';
    if (t <= 0.4) return 'background:rgba(228,87,46,' + ((0.4 - t) / 0.4 * 0.14).toFixed(3) + ')';
    return '';
  }
  function sortVal(p, k){
    if (k === 'pos') return POSORD[String(p.pos).split('/')[0]] || 9;
    return p[k];
  }
  function fmt(p, k){
    var v = p[k];
    if (k === 'salary') return money(v);
    if (k === 'value') return v == null ? '\u2013' : v.toFixed(2) + 'x';
    if (k === 'spread') return v == null ? '\u2013' : (v > 0 ? '+' : v < 0 ? '\u2212' : '') + n1(Math.abs(v));
    if (k === 'usg') return v == null ? '\u2013' : n1(v) + '%';
    return n1(v);
  }
  function setSort(k){
    if (PSORT.key === k) PSORT.dir = -PSORT.dir;
    else {
      var typ = '';
      PCOLS.forEach(function(c){ if (c[0] === k) typ = c[2]; });
      PSORT = {key:k, dir:(typ === 't' || typ === 'p' || typ === 's') ? 1 : -1};
    }
    var sel = $('r4p-psort'), found = false;
    for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === k) found = true;
    sel.value = (found && PSORT.dir < 0) ? k : '';
    proj();
  }
  function proj(){
    if (!PJ) return;
    var q = $('r4p-pq').value.trim().toLowerCase(), g = $('r4p-pgame').value, pos = $('r4p-ppos').value;
    var k = PSORT.key, dir = PSORT.dir;
    var list = PJ.players.filter(function(p){
      if (g){ var gg = g.split('|'); if (p.team !== gg[0] && p.team !== gg[1]) return false; }
      if (pos && ('/' + p.pos + '/').indexOf('/' + pos + '/') < 0) return false;
      if (!q) return true;
      return (p.player + ' ' + p.team + ' ' + (NAMES[p.team] || '')).toLowerCase().indexOf(q) > -1;
    }).sort(function(a, b){
      var x = sortVal(a, k), y = sortVal(b, k);
      if (x == null && y == null) return b.dk - a.dk;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === 'string') return dir * x.localeCompare(y) || (b.dk - a.dk);
      return dir * (x - y) || (b.dk - a.dk);
    });
    $('r4p-pcount').textContent = list.length + ' of ' + PJ.players.length + ' players';
    var arrow = function(c){ return c === k ? (dir > 0 ? ' \u25b2' : ' \u25bc') : ''; };
    var th = PCOLS.map(function(c){
      return '<th class="c-' + c[0] + (c[0] === k ? ' on' : '') + '" data-k="' + c[0] + '" scope="col" tabindex="0" aria-sort="' + (c[0] === k ? (dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + c[1] + arrow(c[0]) + '</th>';
    }).join('');
    var rows = list.map(function(p){
      var bits = noteBits(p.player), has = bits.length > 0, open = has && NOPEN[nkey(p.player)];
      var tags = (p.start ? '<span class="role starter">Starter</span>' : '') + (p.q ? '<span class="role out">Q</span>' : '') + nbtn(p.player, has);
      var tds = PCOLS.map(function(c){
        var key = c[0];
        if (key === 'player') return '<td class="c-player"><span class="pj-name' + (has ? ' has' : '') + '" data-n="' + esc(p.player) + '">' + esc(p.player) + '</span>' + tags + '</td>';
        if (key === 'team') return '<td class="c-team">' + tm(p.team, true) + '</td>';
        if (key === 'opp') return '<td class="c-opp">' + (p.opp ? tm(p.opp, true) : '') + '</td>';
        if (key === 'pos') return '<td class="c-pos">' + esc(p.pos) + '</td>';
        var st = heatCss(key, p[key]);
        return '<td class="c-' + key + '"' + (st ? ' style="' + st + '"' : '') + '>' + fmt(p, key) + '</td>';
      }).join('');
      return '<tr' + (open ? ' class="nt-open"' : '') + '>' + tds + '</tr>' + (open ? '<tr class="pj-notes"><td colspan="' + PCOLS.length + '">' + noteHtml(bits) + '</td></tr>' : '');
    }).join('') || '<tr><td colspan="' + PCOLS.length + '">No players match.</td></tr>';
    var cards = list.map(function(p){
      var bits = noteBits(p.player), has = bits.length > 0, open = has && NOPEN[nkey(p.player)];
      var tags = (p.start ? '<span class="role starter">Starter</span>' : '') + (p.q ? '<span class="role out">Questionable</span>' : '') + nbtn(p.player, has);
      var box = function(key, lbl){ var st = heatCss(key, p[key]); return '<div class="pjc-n"' + (st ? ' style="' + st + '"' : '') + '><span>' + lbl + '</span>' + fmt(p, key) + '</div>'; };
      return '<div class="pjc"><div class="pjc-who"><span class="pj-name' + (has ? ' has' : '') + '" data-n="' + esc(p.player) + '">' + esc(p.player) + '</span> <span class="pk-pos">' + esc(p.pos) + '</span>' + tags + '</div>' +
        '<div class="pjc-game">' + tm(p.team, true) + ' vs ' + (p.opp ? tm(p.opp, true) : '') + ' \u00b7 O/U ' + fmt(p, 'ou') + ' \u00b7 Spread ' + fmt(p, 'spread') + '</div>' +
        '<div class="pjc-nums">' + box('salary', 'Sal') + box('dk', 'DK') + box('value', 'Val') + box('min', 'Min') + box('usg', 'Usg') + '</div>' +
        '<div class="pjc-line">' + [['pts','pts'],['reb','reb'],['ast','ast'],['stl','stl'],['blk','blk'],['to','to']].map(function(x){ return '<b>' + n1(p[x[0]]) + '</b> ' + x[1]; }).join(' \u00b7 ') + '</div>' +
        (open ? noteHtml(bits) : '') + '</div>';
    }).join('') || '<div class="pjc"><p class="pj-note">No players match.</p></div>';
    $('r4p-projlist').innerHTML = '<div class="pjt-wrap"><table class="pjt"><thead><tr>' + th + '</tr></thead><tbody>' + rows + '</tbody></table></div><div class="pjc-list">' + cards + '</div>';
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('#r4p-projlist .pjt th[data-k]') : null;
    if (t) setSort(t.getAttribute('data-k'));
    var r = e.target.closest ? e.target.closest('#r4p-statlist .pjt th[data-k]') : null;
    if (r) rSetSort(r.getAttribute('data-k'));
  });
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target.closest ? e.target.closest('#r4p-projlist .pjt th[data-k]') : null;
    if (t){ e.preventDefault(); setSort(t.getAttribute('data-k')); }
    var r = e.target.closest ? e.target.closest('#r4p-statlist .pjt th[data-k]') : null;
    if (r){ e.preventDefault(); rSetSort(r.getAttribute('data-k')); }
  });

  // Research tab: season stats from every box score, joined with tonight's game.
  var SEA = null, RHEAT = {};
  var RCOLS = [
    ['player','Player','t'], ['pos','Pos','p'], ['salary','Sal','n'], ['team','Team','t'], ['opp','Opp','t'],
    ['ou','O/U','n'], ['spread','Spread','s'], ['gp','GP','n'], ['min','Min','n'], ['dk','DK','n'], ['fppm','FP/Min','n'],
    ['l3_dk','L3 DK','n'], ['pts','Pts','n'], ['reb','Reb','n'], ['ast','Ast','n'], ['stl','Stl','n'], ['blk','Blk','n'], ['to','TO','n'], ['tpm','3PM','n']
  ];
  var RH = {min:1, dk:1, fppm:1, l3_dk:1, pts:1, reb:1, ast:1, stl:1, blk:1, to:-1, tpm:1};
  var RSORT = {key:'dk', dir:-1};
  function rRows(){
    if (!SEA) return [];
    var tonight = {};
    if (PJ && Object.keys(SLATE).length) PJ.players.forEach(function(p){ tonight[nkey(p.player)] = p; });
    return SEA.players.map(function(r){
      var t = tonight[nkey(r.player)], o = {};
      for (var x in r) o[x] = r[x];
      if (t){ o.salary = t.salary; o.opp = t.opp; o.ou = t.ou; o.spread = t.spread; o.pos = t.pos || r.pos; o.team = t.team || r.team; o.start = t.start; o.q = t.q; }
      return o;
    });
  }
  function rHeat(key, v){
    var vals = RHEAT[key];
    if (!RH[key] || v == null || !vals || vals.length < 3) return '';
    var lo = 0, eq = 0;
    for (var i = 0; i < vals.length; i++){ if (vals[i] < v) lo++; else if (vals[i] === v) eq++; }
    var t = (lo + eq / 2) / vals.length;
    if (RH[key] < 0) t = 1 - t;
    if (t >= 0.6) return 'background:rgba(31,122,77,' + ((t - 0.6) / 0.4 * 0.20).toFixed(3) + ')';
    if (t <= 0.4) return 'background:rgba(228,87,46,' + ((0.4 - t) / 0.4 * 0.14).toFixed(3) + ')';
    return '';
  }
  function rFmt(p, k){
    var v = p[k];
    if (k === 'salary') return money(v);
    if (k === 'spread') return v == null ? '\u2013' : (v > 0 ? '+' : v < 0 ? '\u2212' : '') + n1(Math.abs(v));
    if (k === 'fppm') return v == null ? '\u2013' : v.toFixed(2);
    if (k === 'gp') return v == null ? '\u2013' : String(v);
    return n1(v);
  }
  function rSetSort(k){
    if (RSORT.key === k) RSORT.dir = -RSORT.dir;
    else {
      var typ = '';
      RCOLS.forEach(function(c){ if (c[0] === k) typ = c[2]; });
      RSORT = {key:k, dir:(typ === 't' || typ === 'p' || typ === 's') ? 1 : -1};
    }
    research();
  }
  function research(){
    if (!SEA || !$('r4p-statlist')) return;
    var all = rRows();
    RHEAT = {};
    Object.keys(RH).forEach(function(key){ RHEAT[key] = all.filter(function(p){ return p.min >= 10; }).map(function(p){ return p[key]; }).filter(function(x){ return x != null; }); });
    var q = $('r4p-sq').value.trim().toLowerCase(), tf = $('r4p-steam').value, pos = $('r4p-spos').value;
    var k = RSORT.key, dir = RSORT.dir;
    var list = all.filter(function(p){
      if (tf && p.team !== tf) return false;
      if (!keep(p.team)) return false;
      if (pos && String(p.pos).indexOf(pos) < 0) return false;
      if (!q) return true;
      return (p.player + ' ' + p.team + ' ' + (NAMES[p.team] || '')).toLowerCase().indexOf(q) > -1;
    }).sort(function(a, b){
      var x = k === 'pos' ? (POSORD[String(a.pos).split('/')[0]] || 9) : a[k], y = k === 'pos' ? (POSORD[String(b.pos).split('/')[0]] || 9) : b[k];
      if (k === 'fppm' && (a.min >= 10) !== (b.min >= 10)) return a.min >= 10 ? -1 : 1;
      if (x == null && y == null) return b.dk - a.dk;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === 'string') return dir * x.localeCompare(y) || (b.dk - a.dk);
      return dir * (x - y) || (b.dk - a.dk);
    });
    $('r4p-scount').textContent = list.length + ' of ' + all.length + ' players';
    var arrow = function(c){ return c === k ? (dir > 0 ? ' \u25b2' : ' \u25bc') : ''; };
    var th = RCOLS.map(function(c){
      return '<th class="c-' + c[0] + (c[0] === k ? ' on' : '') + '" data-k="' + c[0] + '" scope="col" tabindex="0" aria-sort="' + (c[0] === k ? (dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + c[1] + arrow(c[0]) + '</th>';
    }).join('');
    var rows = list.map(function(p){
      var bits = noteBits(p.player), has = bits.length > 0, open = has && NOPEN[nkey(p.player)];
      var tags = (p.start ? '<span class="role starter">Starter</span>' : '') + (p.q ? '<span class="role out">Q</span>' : '') + nbtn(p.player, has);
      var tds = RCOLS.map(function(c){
        var key = c[0];
        if (key === 'player') return '<td class="c-player"><span class="pj-name' + (has ? ' has' : '') + '" data-n="' + esc(p.player) + '">' + esc(p.player) + '</span>' + tags + '</td>';
        if (key === 'team') return '<td class="c-team">' + tm(p.team, true) + '</td>';
        if (key === 'opp') return '<td class="c-opp">' + (p.opp ? tm(p.opp, true) : '') + '</td>';
        if (key === 'pos') return '<td class="c-pos">' + esc(p.pos) + '</td>';
        var st = rHeat(key, p[key]);
        return '<td class="c-' + key + '"' + (st ? ' style="' + st + '"' : '') + '>' + rFmt(p, key) + '</td>';
      }).join('');
      return '<tr' + (open ? ' class="nt-open"' : '') + '>' + tds + '</tr>' + (open ? '<tr class="pj-notes"><td colspan="' + RCOLS.length + '">' + noteHtml(bits) + '</td></tr>' : '');
    }).join('') || '<tr><td colspan="' + RCOLS.length + '">No players match.</td></tr>';
    var cards = list.map(function(p){
      var bits = noteBits(p.player), has = bits.length > 0, open = has && NOPEN[nkey(p.player)];
      var tags = (p.start ? '<span class="role starter">Starter</span>' : '') + (p.q ? '<span class="role out">Questionable</span>' : '') + nbtn(p.player, has);
      var box = function(key, lbl){ var st = rHeat(key, p[key]); return '<div class="pjc-n"' + (st ? ' style="' + st + '"' : '') + '><span>' + lbl + '</span>' + rFmt(p, key) + '</div>'; };
      var game = p.opp ? tm(p.team, true) + ' vs ' + tm(p.opp, true) + ' \u00b7 ' + money(p.salary) + ' \u00b7 O/U ' + rFmt(p, 'ou') + ' \u00b7 Spread ' + rFmt(p, 'spread') : tm(p.team, true) + ' \u00b7 No game tonight';
      return '<div class="pjc"><div class="pjc-who"><span class="pj-name' + (has ? ' has' : '') + '" data-n="' + esc(p.player) + '">' + esc(p.player) + '</span> <span class="pk-pos">' + esc(p.pos) + '</span>' + tags + '</div>' +
        '<div class="pjc-game">' + game + '</div>' +
        '<div class="pjc-nums">' + box('gp', 'GP') + box('min', 'Min') + box('dk', 'DK') + box('fppm', 'FP/Min') + box('l3_dk', 'L3 DK') + '</div>' +
        '<div class="pjc-line">' + [['pts','pts'],['reb','reb'],['ast','ast'],['stl','stl'],['blk','blk'],['to','to'],['tpm','3pm']].map(function(x){ return '<b>' + n1(p[x[0]]) + '</b> ' + x[1]; }).join(' \u00b7 ') + '</div>' +
        (open ? noteHtml(bits) : '') + '</div>';
    }).join('') || '<div class="pjc"><p class="pj-note">No players match.</p></div>';
    $('r4p-statlist').innerHTML = '<div class="pjt-wrap"><table class="pjt rst"><thead><tr>' + th + '</tr></thead><tbody>' + rows + '</tbody></table></div><div class="pjc-list">' + cards + '</div>';
  }

  // Optimizer: DraftKings Classic lineups from our projections.
  var OLOCK = {}, OEXCL = {}, OLINES = [], OBUSY = false, LPP = null;
  var OCORE = ['PG','SG','SF','PF','C','G','F'], OSLOTS = ['PG','SG','SF','PF','C','G','F','UTIL'];
  var OHALL = [];
  for (var hm = 1; hm < 128; hm++){ OHALL.push(OCORE.filter(function(x, i){ return hm & (1 << i); })); }
  function lpLoad(){
    if (LPP) return LPP;
    LPP = new Promise(function(res, rej){
      var i = 0;
      (function next(){
        if (window.solver) return res(window.solver);
        if (i >= LPSOURCES.length) return rej(new Error('solver'));
        var sc = document.createElement('script'); sc.src = LPSOURCES[i++];
        sc.onload = function(){ if (window.solver) res(window.solver); else next(); };
        sc.onerror = next; document.head.appendChild(sc);
      })();
    });
    LPP.catch(function(){ LPP = null; });
    return LPP;
  }
  function oElig(pos){
    var e = {};
    String(pos || '').split('/').forEach(function(x){ e[x] = 1; if (x === 'PG' || x === 'SG') e.G = 1; if (x === 'SF' || x === 'PF') e.F = 1; });
    e.UTIL = 1; return e;
  }
  function oStarted(){
    var st = {}, now = new Date().toISOString().slice(0, 16) + 'Z';
    if (PJ) (PJ.games || []).forEach(function(g){ if (g.time && g.time <= now){ st[g.away] = 1; st[g.home] = 1; } });
    return st;
  }
  function oMainOnly(){ return !!(PJ && PJ.players.some(function(p){ return p.dkid; })); }
  function oMain(p){ return !oMainOnly() || !!p.dkid; }
  function oGames(){
    if (!PJ) return [];
    var t = {};
    PJ.players.forEach(function(p){ if (p.salary && oMain(p)) t[p.team] = 1; });
    return (PJ.games || []).filter(function(g){ return t[g.home] || t[g.away]; });
  }
  function oToday(){ return PJ && PJ.date === new Date().toLocaleDateString('en-CA', {timeZone:'America/New_York'}); }
  function oAssign(pl){
    var order = ['C','PG','SG','SF','PF','G','F','UTIL'], used = {}, res = {}, E = pl.map(function(p){ return oElig(p.pos); });
    function go(k){
      if (k === order.length) return true;
      for (var i = 0; i < pl.length; i++) if (!used[i] && E[i][order[k]]){ used[i] = 1; res[order[k]] = pl[i]; if (go(k + 1)) return true; used[i] = 0; }
      return false;
    }
    return go(0) ? res : null;
  }
  function oSolve(lp, pool, prev, diff, floor){
    var m = {optimize:'dk', opType:'max', constraints:{sal:{max:50000, min:floor}, n:{equal:8}}, variables:{}, ints:{}}, games = {};
    OHALL.forEach(function(h, j){ m.constraints['h' + j] = {min:h.length}; });
    pool.forEach(function(p, i){
      var g = [p.team, p.opp].sort().join('_'), e = oElig(p.pos), v = {dk:p.dk, sal:p.salary, n:1};
      games[g] = 1; v['g_' + g] = 1; v['u' + i] = 1;
      m.constraints['u' + i] = OLOCK[nkey(p.player)] ? {equal:1} : {max:1};
      OHALL.forEach(function(h, j){ for (var q = 0; q < h.length; q++) if (e[h[q]]){ v['h' + j] = 1; break; } });
      prev.forEach(function(L, j){ if (L.keys[nkey(p.player)]) v['L' + j] = 1; });
      m.variables['y' + i] = v; m.ints['y' + i] = 1;
    });
    Object.keys(games).forEach(function(g){ m.constraints['g_' + g] = {max:7}; });
    prev.forEach(function(L, j){ m.constraints['L' + j] = {max:8 - diff}; });
    var r = lp.Solve(m);
    if (!r.feasible) return null;
    var pl = [];
    pool.forEach(function(p, i){ if (r['y' + i] > 0.5) pl.push(p); });
    if (pl.length !== 8) return null;
    var slots = oAssign(pl);
    if (!slots) return null;
    var keys = {}, sal = 0, dk = 0;
    pl.forEach(function(p){ keys[nkey(p.player)] = 1; sal += p.salary; dk += p.dk; });
    return {slots:slots, keys:keys, salary:sal, dk:dk};
  }
  function oPool(){
    if (!PJ) return [];
    return PJ.players.filter(function(p){
      var k = nkey(p.player);
      if (!p.salary || p.dk == null || OEXCL[k] || !oMain(p)) return false;
      if (OLOCK[k]) return true;
      return p.min >= 8;
    });
  }
  function oMsg(t){ $('r4p-omsg').textContent = t || ''; }
  function optBuild(pre){
    pre = typeof pre === 'string' ? pre + ' ' : '';
    if (OBUSY || !PJ) return;
    if (!oToday()){ oMsg('Tonight\u2019s projections are not posted yet.'); return; }
    var n = +$('r4p-on').value, diff = +$('r4p-odiff').value, floor = +$('r4p-ofloor').value;
    var pool = oPool(), locked = pool.filter(function(p){ return OLOCK[nkey(p.player)]; });

    var lsal = locked.reduce(function(a, p){ return a + p.salary; }, 0);
    if (locked.length > 8){ oMsg('You have ' + locked.length + ' players locked. A lineup only has 8 spots.'); return; }
    if (lsal > 50000){ oMsg('Your locked players cost ' + money(lsal) + ', which is over the $50,000 cap.'); return; }
    OBUSY = true; OLINES = []; oMsg('Building lineups\u2026'); optLines();
    lpLoad().then(function(lp){
      var i = 0;
      (function step(){
        var L = oSolve(lp, pool, OLINES, diff, floor);
        if (L){ OLINES.push(L); i++; }
        if (L && i < n){ oMsg('Built ' + i + ' of ' + n + ' lineups\u2026'); optLines(); setTimeout(step, 0); return; }
        OBUSY = false;
        if (!OLINES.length) oMsg('No lineup fits these settings. Try fewer locks or a lower salary minimum.');
        else if (OLINES.length < n) oMsg(pre + 'Only ' + OLINES.length + ' of ' + n + ' lineups fit these settings.');
        else oMsg(pre + 'Built ' + n + (n === 1 ? ' lineup.' : ' lineups.'));
        optLines();
      })();
    }).catch(function(){ OBUSY = false; oMsg('The optimizer could not load right now. Please refresh the page in a minute.'); });
  }
  function optLines(){
    $('r4p-olines').innerHTML = OLINES.length ? '<div class="ol-grid">' + OLINES.map(function(L, i){
      return '<div class="ol-card"><div class="ol-top"><span class="ol-n">Lineup ' + (i + 1) + '</span><span class="ol-dk">' + n1(L.dk) + ' DK</span><span class="ol-sal">$' + L.salary.toLocaleString('en-US') + '</span></div>' +
        OSLOTS.map(function(s){
          var p = L.slots[s];
          return '<div class="ol-row' + (OLOCK[nkey(p.player)] ? ' lk" title="Locked' : '') + '"><span class="ol-slot">' + s + '</span><span class="ol-who">' + esc(p.player) + '</span>' + tm(p.team, true) + '<span class="ol-s">' + money(p.salary) + '</span><span class="ol-d">' + n1(p.dk) + '</span></div>';
        }).join('') + '</div>';
    }).join('') + '</div>' : '';
  }
  function optPool(){
    if (!PJ || !$('r4p-opool')) return;
    if (!oToday()){ $('r4p-osub').textContent = 'Tonight\u2019s projections are not posted yet. Please check back closer to the first game.'; $('r4p-opool').innerHTML = ''; return; }
    var st = oStarted(), q = $('r4p-oq').value.trim().toLowerCase();
    var og = oGames();
    var split = oMainOnly() && og.length < (PJ.games || []).length;
    $('r4p-osub').textContent = 'We watch ball. We know ball. Build DraftKings main-slate lineups from our projections for ' + og.length + (og.length === 1 ? ' game' : ' games') + ' tonight' + (split ? ' (DraftKings left the other ' + (PJ.games.length - og.length) + ((PJ.games.length - og.length) === 1 ? ' game' : ' games') + ' off its main slate)' : '') + ' \u00b7 updated ' + PJ.updated + '.';
    var list = PJ.players.filter(function(p){
      if (!p.salary || !oMain(p)) return false;
      return !q || (p.player + ' ' + p.team + ' ' + (NAMES[p.team] || '')).toLowerCase().indexOf(q) > -1;
    });
    $('r4p-opool').innerHTML = '<div class="op-head"><span>Player</span><span>Sal</span><span>DK</span><span></span></div>' + list.map(function(p){
      var k = nkey(p.player), lk = !!OLOCK[k], ex = !!OEXCL[k];
      var bits = noteBits(p.player), has = bits.length > 0, open = has && NOPEN[k];
      var tags = (p.q ? '<span class="role out">Q</span>' : '') + (st[p.team] ? '<span class="role">Started</span>' : '') + nbtn(p.player, has);
      return '<div class="op-row' + (lk ? ' lk' : '') + (ex ? ' ex' : '') + '"><div class="op-who"><span class="pj-name' + (has ? ' has' : '') + '" data-n="' + esc(p.player) + '">' + esc(p.player) + '</span>' + tags +
        '<div class="op-sub"><span class="pk-pos">' + esc(p.pos) + '</span> ' + tm(p.team, true) + ' vs ' + (p.opp ? tm(p.opp, true) : '') + '</div></div>' +
        '<span class="op-s">' + money(p.salary) + '</span><span class="op-d">' + n1(p.dk) + '</span>' +
        '<span class="op-b"><button class="ob' + (lk ? ' on' : '') + '" data-lock="' + esc(p.player) + '" type="button" aria-pressed="' + lk + '">' + (lk ? 'Locked' : 'Lock') + '</button>' +
        '<button class="ob x' + (ex ? ' on' : '') + '" data-excl="' + esc(p.player) + '" type="button" aria-pressed="' + ex + '">' + (ex ? 'Out' : 'Take out') + '</button></span>' +
        (open ? '<div class="op-notes">' + noteHtml(bits) + '</div>' : '') + '</div>';
    }).join('');
  }
  function optStars(){
    if (!SS || !oToday() || SS.date !== PJ.date){ oMsg('Tonight\u2019s Stars & Scrubs are not posted yet.'); return; }
    var st = oStarted(), have = {};
    PJ.players.forEach(function(p){ if (p.salary && oMain(p)) have[nkey(p.player)] = p; });
    function pick(arr){ return (arr || []).filter(function(p){ var x = have[nkey(p.player)]; return x && !x.q && !OEXCL[nkey(p.player)]; }).slice(0, 2); }
    OLOCK = {};
    var chosen = pick(SS.stars).concat(pick(SS.scrubs));
    if (!chosen.length){ optBuild(); return; }
    chosen.forEach(function(p){ OLOCK[nkey(p.player)] = 1; });
    optPool();
    optBuild('Locked ' + chosen.map(function(p){ return p.player; }).join(', ') + ' from Stars & Scrubs.');
  }
  function optCsv(){
    if (!OLINES.length){ oMsg('Build lineups first, then download them.'); return; }
    var miss = false;
    var rows = OLINES.map(function(L){ return OSLOTS.map(function(s){ var id = L.slots[s].dkid; if (!id) miss = true; return id || ''; }).join(','); });
    if (miss){ oMsg('DraftKings player IDs are missing for tonight, so the download is not available yet.'); return; }
    var csv = OSLOTS.join(',') + '\n' + rows.join('\n') + '\n';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = 'nbadfs-lineups-' + PJ.date + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
    oMsg('Downloaded ' + OLINES.length + (OLINES.length === 1 ? ' lineup.' : ' lineups.') + ' On DraftKings, open your contest and use Upload Lineups.');
  }
  document.addEventListener('click', function(e){
    if (!e.target.closest) return;
    var b = e.target.closest('[data-lock]'), x = e.target.closest('[data-excl]');
    if (b){ var k = nkey(b.getAttribute('data-lock')); OLOCK[k] = !OLOCK[k]; if (OLOCK[k]) OEXCL[k] = false; optPool(); }
    else if (x){ var k2 = nkey(x.getAttribute('data-excl')); OEXCL[k2] = !OEXCL[k2]; if (OEXCL[k2]) OLOCK[k2] = false; optPool(); }
  });

  // Games tab: who was on the court, when, and what he did with it.
  var GIDX = null, GDAY = {}, GSEL = null;
  function gUrls(f){ return GBASE.map(function(b){ return b + f; }); }
  function gClock(t, end, isEnd){
    var q, left;
    if (isEnd && t > 0 && ((t <= 2880 && t % 720 === 0) || (t > 2880 && (t - 2880) % 300 === 0))) t = t - 0.001;
    if (t < 2880){ q = Math.min(4, Math.floor(t / 720) + 1); left = q * 720 - t; }
    else { var o = Math.min(Math.floor((t - 2880) / 300) + 1, Math.max(1, Math.round((end - 2880) / 300))); q = 4 + o; left = 2880 + o * 300 - t; }
    left = Math.max(0, Math.round(left));
    var m = Math.floor(left / 60), sx = left % 60;
    if (sx === 60){ m++; sx = 0; }
    return (q <= 4 ? 'Q' + q : (q === 5 ? 'OT' : 'OT' + (q - 4))) + ' ' + m + ':' + (sx < 10 ? '0' : '') + sx;
  }
  function gDate(d){ var x = new Date(d + 'T12:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-US', {weekday:'short', month:'numeric', day:'numeric'}); }
  function gMatches(){
    var dv = $('r4p-gdate').value, tv = $('r4p-gteam').value, out = [];
    (GIDX || []).forEach(function(d){
      if (dv && d.date !== dv) return;
      d.games.forEach(function(g){ if (!tv || g.away === tv || g.home === tv) out.push({date:d.date, g:g}); });
    });
    return out;
  }
  function gList(){
    if (!GIDX) return;
    var list = gMatches();
    if (!list.length){ $('r4p-glist').innerHTML = '<p class="sub">No games match.</p>'; $('r4p-gview').innerHTML = ''; return; }
    if (!GSEL || !list.some(function(x){ return x.g.id === GSEL.id; })) GSEL = {id:list[0].g.id, date:list[0].date};
    $('r4p-glist').innerHTML = list.length > 1 ? list.map(function(x){
      var g = x.g;
      return '<button class="gt-chip' + (g.id === GSEL.id ? ' on' : '') + '" type="button" data-gid="' + esc(g.id) + '" data-gd="' + esc(x.date) + '">' +
        ($('r4p-gdate').value ? '' : '<span class="gt-cd">' + esc(gDate(x.date)) + '</span>') + esc(g.away) + ' ' + g.final[0] + ' at ' + esc(g.home) + ' ' + g.final[1] + '</button>';
    }).join('') : '';
    gLoad(GSEL.date);
  }
  function gLoad(day){
    if (GDAY[day]){ gRender(); return; }
    $('r4p-gview').innerHTML = '<p class="sub">Loading the game\u2026</p>';
    fetchFirst(gUrls(day + '.json'), false).then(function(d){ GDAY[day] = d; gRender(); })
      .catch(function(){ $('r4p-gview').innerHTML = '<p class="sub">This game could not load right now. Please try again in a minute.</p>'; });
  }
  function gRender(){
    var G = (GDAY[GSEL.date] || []).filter(function(g){ return g.id === GSEL.id; })[0];
    if (!G){ $('r4p-gview').innerHTML = ''; return; }
    var END = G.end, per = Math.max(4, G.periods || 4);
    function pct(t){ return (t / END * 100).toFixed(3) + '%'; }
    var lines = [];
    for (var q = 1; q < per; q++){ lines.push(q <= 3 ? q * 720 : 2880 + (q - 4) * 300); }
    var labels = [];
    for (var q2 = 1; q2 <= per; q2++){ var a0 = q2 <= 4 ? (q2 - 1) * 720 : 2880 + (q2 - 5) * 300, a1 = q2 <= 4 ? q2 * 720 : a0 + 300; labels.push('<span style="left:' + pct(a0) + ';width:' + ((a1 - a0) / END * 100).toFixed(3) + '%">' + (q2 <= 4 ? 'Q' + q2 : (q2 === 5 ? 'OT' : 'OT' + (q2 - 4))) + '</span>'); }
    var grid = lines.map(function(t){ return '<i style="left:' + pct(t) + '"></i>'; }).join('');
    var W = 1000, H = 70, mx = Math.max(10, Math.max.apply(null, G.margin.map(function(x){ return Math.abs(x[1]); })));
    var pts = [], prev = 0;
    G.margin.forEach(function(x){ var X = (x[0] / END * W).toFixed(1); pts.push('L' + X + ',' + (H / 2 - prev / mx * (H / 2 - 4)).toFixed(1)); pts.push('L' + X + ',' + (H / 2 - x[1] / mx * (H / 2 - 4)).toFixed(1)); prev = x[1]; });
    var path = 'M0,' + H / 2 + ' ' + pts.join(' ') + ' L' + W + ',' + (H / 2 - prev / mx * (H / 2 - 4)).toFixed(1) + ' L' + W + ',' + H / 2 + ' Z';
    var hc = TEAMC[G.home] || '#5d6370', ac = TEAMC[G.away] || '#5d6370';
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="gu"><rect x="0" y="0" width="' + W + '" height="' + H / 2 + '"/></clipPath><clipPath id="gd"><rect x="0" y="' + H / 2 + '" width="' + W + '" height="' + H / 2 + '"/></clipPath></defs>' +
      '<path d="' + path + '" fill="' + hc + '" opacity=".6" clip-path="url(#gu)"/><path d="' + path + '" fill="' + ac + '" opacity=".6" clip-path="url(#gd)"/>' +
      '<line x1="0" x2="' + W + '" y1="' + H / 2 + '" y2="' + H / 2 + '" stroke="#9aa1ad" stroke-width="1"/>' +
      lines.map(function(t){ var X = (t / END * W).toFixed(1); return '<line x1="' + X + '" x2="' + X + '" y1="0" y2="' + H + '" stroke="#d6dae1"/>'; }).join('') + '</svg>';
    var gb = (G.garbage || []).map(function(x){ return '<div class="gt-gb" style="left:' + pct(x[0]) + ';width:' + ((x[1] - x[0]) / END * 100).toFixed(3) + '%"></div>'; }).join('');
    function teamBox(ab){
      var c = TEAMC[ab] || '#5d6370', fg = LIGHT[ab] ? '#15171c' : '#ffffff';
      var ps = G.players.filter(function(p){ return p.team === ab; }).sort(function(a, b){ return (b.start - a.start) || (b.min - a.min); });
      var rows = ps.map(function(p){
        var segs = p.stints.map(function(s){
          var mn = ((s[1] - s[0]) / 60).toFixed(1), dk = s[2].toFixed(1);
          return '<div class="gt-seg" style="left:' + pct(s[0]) + ';width:' + ((s[1] - s[0]) / END * 100).toFixed(3) + '%;background:' + c + ';color:' + fg + '" data-a="' + mn + ' min \u00b7 ' + dk + ' DK" data-b="' + mn + ' \u00b7 ' + dk + '" title="' + esc(gClock(s[0], END) + ' to ' + gClock(s[1], END, true) + ': ' + mn + ' min, ' + dk + ' DK') + '"></div>';
        }).join('');
        return '<div class="gt-row"><div class="gt-n">' + esc(p.player) + (p.start ? '<small>START</small>' : '') + '</div><div class="gt-v">' + n1(p.min) + '</div><div class="gt-v dk">' + n1(p.dk) + '</div><div class="gt-track">' + grid + gb + segs + '</div></div>';
      }).join('');
      var ph = ps.map(function(p){
        return '<div class="gp"><div class="gp-top"><span>' + esc(p.player) + (p.start ? ' <small>START</small>' : '') + '</span><span>' + n1(p.min) + ' min \u00b7 <b>' + n1(p.dk) + ' DK</b></span></div><div class="gp-s">' + p.stints.map(function(s){
          var c0 = gClock(s[0], END), c1 = gClock(s[1], END, true), same = c0.split(' ')[0] === c1.split(' ')[0];
          var gm = (G.garbage || []).some(function(x){ return s[1] > x[0] && s[0] < x[1]; });
          return '<span' + (gm ? ' class="g"' : '') + '>' + esc(c0 + ' to ' + (same ? c1.split(' ')[1] : c1)) + ' \u00b7 ' + ((s[1] - s[0]) / 60).toFixed(1) + ' min \u00b7 ' + s[2].toFixed(1) + ' DK</span>';
        }).join('') + '</div></div>';
      }).join('');
      return '<div class="gt"><h3>' + tm(ab, true) + ' ' + esc(NAMES[ab] || ab) + '</h3>' +
        '<div class="gt-row hd"><div>Player</div><div class="r">Min</div><div class="r">DK</div><div class="gt-q">' + labels.join('') + '</div></div>' + rows +
        '<div class="gt-ph">' + ph + '</div></div>';
    }
    $('r4p-gview').innerHTML = '<p class="gt-cap">' + esc(G.caption) + '</p>' +
      '<div class="gt gt-mwrap"><h3>Score margin \u00b7 ' + esc(gDate(GSEL.date)) + ' \u00b7 ' + tm(G.away, true) + ' ' + G.final[0] + ' at ' + tm(G.home, true) + ' ' + G.final[1] + '</h3><div class="gt-m" id="r4p-gm">' + svg + '<div class="gt-hl" hidden="hidden"></div><div class="gt-tip" hidden="hidden"></div></div>' +
      '</div><p class="gt-legend">Above the line: ' + esc(NAMES[G.home] || G.home) + ' ahead. Below the line: ' + esc(NAMES[G.away] || G.away) + ' ahead. The score chart stays at the top while you scroll. Move along it, or tap it, to see the time and score.</p>' +
      teamBox(G.away) + teamBox(G.home);
    gFit();
    gHover(G);
    gStick();
  }
  function gHover(G){
    var box = $('r4p-gm'); if (!box || !G.score) return;
    var hl = box.querySelector('.gt-hl'), tip = box.querySelector('.gt-tip'), END = G.end;
    function at(clientX){
      var r = box.getBoundingClientRect(), x = Math.max(0, Math.min(r.width, clientX - r.left)), t = x / r.width * END, sc = G.score[0];
      for (var i = 0; i < G.score.length && G.score[i][0] <= t; i++) sc = G.score[i];
      var a = sc[1], h = sc[2], d = h - a;
      var lead = d === 0 ? 'Tied' : (d > 0 ? G.home + ' by ' + d : G.away + ' by ' + (-d));
      tip.innerHTML = '<b>' + esc(gClock(t, END, true)) + '</b> \u00b7 ' + esc(G.away) + ' ' + a + ', ' + esc(G.home) + ' ' + h + ' \u00b7 ' + esc(lead);
      hl.hidden = false; tip.hidden = false;
      hl.style.left = x + 'px';
      var w = tip.offsetWidth, left = Math.max(0, Math.min(r.width - w, x - w / 2));
      tip.style.left = left + 'px';
    }
    box.addEventListener('mousemove', function(e){ at(e.clientX); });
    var touched = 0;
    box.addEventListener('mouseleave', function(){ if (Date.now() - touched > 1500){ hl.hidden = true; tip.hidden = true; } });
    box.addEventListener('click', function(e){ at(e.clientX); });
    box.addEventListener('touchstart', function(e){ touched = Date.now(); if (e.touches[0]) at(e.touches[0].clientX); }, {passive:true});
    box.addEventListener('touchmove', function(e){ touched = Date.now(); if (e.touches[0]) at(e.touches[0].clientX); }, {passive:true});
  }
  function gStick(){
    var t = document.querySelector('.tabs');
    var h = t ? t.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--gt-top', Math.round(h) + 'px');
  }
  window.addEventListener('resize', gStick);
  function gFit(){
    var sg = document.querySelectorAll('#r4p-gview .gt-seg');
    for (var k = 0; k < sg.length; k++){
      var e = sg[k];
      e.textContent = e.getAttribute('data-a');
      if (e.scrollWidth > e.clientWidth){ e.textContent = e.getAttribute('data-b'); if (e.scrollWidth > e.clientWidth) e.textContent = ''; }
    }
  }
  window.addEventListener('resize', function(){ if (!$('v-games').hidden) gFit(); });
  document.addEventListener('click', function(e){
    var c = e.target.closest ? e.target.closest('.gt-chip') : null;
    if (!c) return;
    GSEL = {id:c.getAttribute('data-gid'), date:c.getAttribute('data-gd')};
    gList();
  });

  // Teammate splits: with and without each teammate on the floor.
  var WY = null;
  function wyPlayers(){
    var t = $('r4p-wyteam').value, sel = $('r4p-wyplayer'), cur = sel.value;
    var ps = Object.keys((WY.teams || {})[t] || {}).sort(function(a, b){ return WY.teams[t][b].min - WY.teams[t][a].min; });
    sel.innerHTML = ps.map(function(n){ return '<option value="' + esc(n) + '">' + esc(n) + ' (' + n1(WY.teams[t][n].min) + ' min)</option>'; }).join('');
    if (cur && ps.indexOf(cur) > -1) sel.value = cur;
    wyRender();
  }
  function wyRender(){
    var t = $('r4p-wyteam').value, pl = $('r4p-wyplayer').value;
    var r = ((WY.teams || {})[t] || {})[pl];
    if (!r){ $('r4p-wybox').innerHTML = ''; return; }
    function pm(dk, mn){ return mn > 0 ? dk / mn : null; }
    var all = pm(r.dk, r.min);
    var rows = Object.keys(r.mates).map(function(m){ var v = r.mates[m]; return {m:m, w:v[0], dw:v[1], o:v[2], dout:v[3]}; })
      .filter(function(x){ return x.w > 0; })
      .sort(function(a, b){ return b.w - a.w; });
    var html = '<p class="wy-all"><b>' + esc(pl) + '</b> has played ' + n1(r.min) + ' minutes in ' + r.gp + (r.gp === 1 ? ' game' : ' games') + ' at ' + (all == null ? '\u2013' : all.toFixed(2)) + ' DK points per minute.</p>' +
      '<div class="wy-t"><div class="wy-r wy-h"><span>Teammate</span><span>With him on</span><span>With him off</span><span>Diff</span></div>' +
      rows.map(function(x){
        var a = pm(x.dw, x.w), b = pm(x.dout, x.o), small = x.w < 10 || x.o < 10;
        var d = (a != null && b != null) ? a - b : null;
        var dc = d == null || small ? '' : (d >= 0.15 ? ' up' : (d <= -0.15 ? ' down' : ''));
        return '<div class="wy-r' + (small ? ' small' : '') + '"><span class="wy-m">' + esc(x.m) + (small ? ' <small>small sample</small>' : '') + '</span>' +
          '<span><b>' + (a == null ? '\u2013' : a.toFixed(2)) + '</b> in ' + n1(x.w) + ' min</span>' +
          '<span><b>' + (b == null ? '\u2013' : b.toFixed(2)) + '</b> in ' + n1(x.o) + ' min</span>' +
          '<span class="wy-d' + dc + '">' + (d == null ? '\u2013' : (d > 0 ? '+' : d < 0 ? '\u2212' : '') + Math.abs(d).toFixed(2)) + '</span></div>';
      }).join('') + '</div>';
    $('r4p-wybox').innerHTML = html;
  }

  var SS = null;
  function starsRender(){
    if (!SS) return;
    var today = new Date().toLocaleDateString('en-CA', {timeZone:'America/New_York'});
    if (SS.date !== today){ $('r4p-ssub').textContent = 'Tonight\u2019s stars and scrubs are not posted yet. Please check back soon.'; $('r4p-starsbox').innerHTML = ''; return; }
    $('r4p-ssub').textContent = 'We watch ball. We know ball. Updated ' + (SS.updated || '') + '. ' + (SS.guide || '');
    function card(p){
      var tags = (p['new'] ? '<span class="tn">New today</span>' : '') + (p.start ? '<span class="role starter">Starter</span>' : '') + (p.q ? '<span class="role out">Questionable</span>' : '');
      var box = function(key, lbl){ var st = PJ ? heatCss(key, p[key]) : ''; return '<div class="ssc-n"' + (st ? ' style="' + st + '"' : '') + '><span>' + lbl + '</span>' + fmt(p, key) + '</div>'; };
      return '<div class="ssc"><div class="ssc-top"><div class="ssc-who"><span class="ssc-name">' + esc(p.player) + '</span> <span class="pk-pos">' + esc(p.pos) + '</span>' + tags + '</div><div class="ssc-sal">' + money(p.salary) + '</div></div>' +
        '<div class="ssc-game">' + tm(p.team, true) + ' vs ' + (p.opp ? tm(p.opp, true) : '') + ' \u00b7 O/U ' + fmt(p, 'ou') + ' \u00b7 Spread ' + fmt(p, 'spread') + '</div>' +
        '<div class="ssc-nums">' + box('min', 'Min') + box('dk', 'DK') + box('value', 'Val') + box('usg', 'Usg') + '</div>' +
        '<div class="ssc-line">' + [['pts','pts'],['reb','reb'],['ast','ast'],['stl','stl'],['blk','blk'],['to','to']].map(function(x){ return '<b>' + n1(p[x[0]]) + '</b> ' + x[1]; }).join(' \u00b7 ') + '</div>' +
        (p.why ? '<p class="ssc-why"><b>Why:</b> ' + esc(p.why) + '</p>' : '') + '</div>';
    }
    $('r4p-starsbox').innerHTML =
      '<div class="panel ss-panel stars"><h2>Stars</h2><p class="hint">The high-salary locks for tonight, $8,000 and up.</p><div class="ssc-grid">' + (SS.stars || []).map(card).join('') + '</div></div>' +
      '<div class="panel ss-panel scrubs"><h2>Scrubs</h2><p class="hint">Cheap value that popped up today, $4,500 and under. Every scrub has a reason.</p><div class="ssc-grid">' + ((SS.scrubs || []).map(card).join('') || '<p class="sub">No scrubs with a real reason yet today.</p>') + '</div></div>';
  }

  function show(v){
    var tabs = document.querySelectorAll('#r4p-tabs .tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-v') === v);
    var views = document.querySelectorAll('#r4p-app .view');
    for (var j = 0; j < views.length; j++) views[j].hidden = views[j].id !== 'v-' + v;
    if (v === 'games') gFit();
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  var tabs = document.querySelectorAll('#r4p-tabs .tab');
  for (var k = 0; k < tabs.length; k++) tabs[k].addEventListener('click', function(){ show(this.getAttribute('data-v')); });


  fetchFirst(gUrls('index.json'), false).then(function(d){
    GIDX = d;
    var teamsSeen = {};
    d.forEach(function(x){
      var o = document.createElement('option'); o.value = x.date; o.textContent = gDate(x.date) + ' (' + x.games.length + ')'; $('r4p-gdate').appendChild(o);
      x.games.forEach(function(g){ teamsSeen[g.away] = 1; teamsSeen[g.home] = 1; });
    });
    Object.keys(teamsSeen).sort().forEach(function(c){ var o = document.createElement('option'); o.value = c; o.textContent = c + ' \u2013 ' + (NAMES[c] || c); $('r4p-gteam').appendChild(o); });
    if (d.length) $('r4p-gdate').value = d[0].date;
    var n = d.reduce(function(a, x){ return a + x.games.length; }, 0);
    $('r4p-gsub').textContent = 'We watch ball. We know ball. Who was on the court, when, and what he did with it \u00b7 ' + n + ' games so far, newest first.';
    gList();
  }).catch(function(){ $('r4p-gsub').textContent = 'Game timelines are not posted yet. Please check back soon.'; });
  fetchFirst(WSOURCES, false).then(function(d){
    WY = d;
    var ts = Object.keys(d.teams || {}).filter(function(x){ return x; }).sort();
    $('r4p-wyteam').innerHTML = ts.map(function(c){ return '<option value="' + c + '">' + c + ' \u2013 ' + esc(NAMES[c] || c) + '</option>'; }).join('');
    $('r4p-wysub').textContent = 'How a player does with each teammate on the floor and with him off it, over ' + d.games + ' games this season. Numbers are DraftKings points per minute from the play-by-play, without double-double bonuses. Splits with fewer than 10 minutes on either side are marked small sample, so treat them as early signs only.';
    wyPlayers();
  }).catch(function(){ $('r4p-wysub').textContent = 'Teammate splits are not posted yet. Please check back soon.'; });
  $('r4p-wyteam').addEventListener('change', wyPlayers);
  $('r4p-wyplayer').addEventListener('change', wyRender);
  $('r4p-gdate').addEventListener('change', function(){ GSEL = null; gList(); });
  $('r4p-gteam').addEventListener('change', function(){ GSEL = null; gList(); });
  $('r4p-obuild').addEventListener('click', optBuild);
  $('r4p-oss').addEventListener('click', optStars);
  $('r4p-oclear').addEventListener('click', function(){ OLOCK = {}; OEXCL = {}; optPool(); oMsg('Cleared all locks and players taken out.'); });
  $('r4p-ocsv').addEventListener('click', optCsv);
  $('r4p-oq').addEventListener('input', optPool);
  ['r4p-sq','r4p-steam','r4p-spos'].forEach(function(id){ $(id).addEventListener(id === 'r4p-sq' ? 'input' : 'change', research); });
  fetchFirst(RSOURCES, false).then(function(d){
    SEA = d;
    var dd = d.through ? new Date(d.through + 'T12:00:00') : null;
    var thru = dd && !isNaN(dd) ? dd.toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '';
    $('r4p-rsub').textContent = 'We watch ball. We know ball. Season stats through ' + thru + ' \u00b7 ' + d.nights + (d.nights === 1 ? ' night' : ' nights') + ' of games \u00b7 ' + d.players.length + ' players.';
    research();
  }).catch(function(){ $('r4p-rsub').textContent = 'Season stats are not posted yet. Please check back soon.'; });
  ['r4p-pq','r4p-pgame','r4p-ppos'].forEach(function(id){ $(id).addEventListener(id === 'r4p-pq' ? 'input' : 'change', proj); });
  $('r4p-psort').addEventListener('change', function(){ var v = this.value; if (v){ PSORT = {key:v, dir:-1}; proj(); } });
  fetchFirst(SSOURCES, false).then(function(d){ SS = d; starsRender(); proj(); optPool(); }).catch(function(){
    $('r4p-ssub').textContent = 'Tonight\u2019s stars and scrubs are not posted yet. Please check back soon.';
  });
  fetchFirst(CSOURCES, false).then(function(d){
    var today = new Date().toLocaleDateString('en-CA', {timeZone:'America/New_York'});
    CTX = {};
    if (d.date === today) Object.keys(d.notes || {}).forEach(function(n){ CTX[nkey(n)] = d.notes[n]; });
    proj();
  }).catch(function(){});
  fetchFirst(PSOURCES, false).then(function(d){ projInit(d); starsRender(); research(); optPool(); }).catch(function(){
    $('r4p-psub').textContent = 'Tonight\u2019s projections are not posted yet. Please check back closer to the first game.';
  });

  fetchFirst(SOURCES, false).then(function(d){
    db = d;
    d.sources.forEach(function(s){ srcById[s.id] = s; });
    setSub();
    teamOptions($('r4p-team')); teamOptions($('r4p-pteam')); teamOptions($('r4p-steam'));
    badgeInit(); syncToggles(); quick(); ranks(); teams(); players(); injuries(); moves(); proj(); research(); optPool();
    $('r4p-rq').addEventListener('input', ranks);
    $('r4p-rpos').addEventListener('change', ranks);
    $('r4p-rflag').addEventListener('change', ranks);
    $('r4p-team').addEventListener('change', teams);
    $('r4p-pteam').addEventListener('change', players);
    $('r4p-q').addEventListener('input', players);
    $('r4p-mq').addEventListener('input', moves);
  }).catch(function(){
    $('v-quick').innerHTML = '<p class="sub">The data could not load right now. Please refresh the page in a minute.</p>';
    $('r4p-sub').textContent = 'Data unavailable';
  });
})();
