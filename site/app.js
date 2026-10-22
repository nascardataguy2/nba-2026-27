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
    proj(); research();
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
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  var tabs = document.querySelectorAll('#r4p-tabs .tab');
  for (var k = 0; k < tabs.length; k++) tabs[k].addEventListener('click', function(){ show(this.getAttribute('data-v')); });


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
  fetchFirst(SSOURCES, false).then(function(d){ SS = d; starsRender(); proj(); }).catch(function(){
    $('r4p-ssub').textContent = 'Tonight\u2019s stars and scrubs are not posted yet. Please check back soon.';
  });
  fetchFirst(CSOURCES, false).then(function(d){
    var today = new Date().toLocaleDateString('en-CA', {timeZone:'America/New_York'});
    CTX = {};
    if (d.date === today) Object.keys(d.notes || {}).forEach(function(n){ CTX[nkey(n)] = d.notes[n]; });
    proj();
  }).catch(function(){});
  fetchFirst(PSOURCES, false).then(function(d){ projInit(d); starsRender(); research(); }).catch(function(){
    $('r4p-psub').textContent = 'Tonight\u2019s projections are not posted yet. Please check back closer to the first game.';
  });

  fetchFirst(SOURCES, false).then(function(d){
    db = d;
    d.sources.forEach(function(s){ srcById[s.id] = s; });
    setSub();
    teamOptions($('r4p-team')); teamOptions($('r4p-pteam')); teamOptions($('r4p-steam'));
    badgeInit(); syncToggles(); quick(); ranks(); teams(); players(); injuries(); moves(); proj(); research();
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
