(function(){
  var SOURCES = [
    'http://localhost:8770/data/db.json',
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/db.json'
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
      if (!items || !items.length) return '';
      return '<div class="panel ' + cls + '"><h2>' + title + '</h2><p class="hint">' + hint + '</p>' + items.map(fn).join('') + '</div>';
    }
    function simple(it){ return '<div class="hit"><span class="who">' + esc(it.player) + '</span>' + tm(it.team) + bdg(it.player) + '<p>' + esc(it.text) + '</p>' + srcLink(it.source) + '</div>'; }
    var html = '<div class="grid">' +
      panel('sits', 'If He Sits, Who Benefits', 'Check this when late injury news drops before lock.', q.if_sits, function(it){
        return '<div class="hit"><span class="who">' + esc(it.out) + '</span>' + tm(it.team) + ' <span class="arrow">\u2192</span> <span class="who">' + esc(it.benefits) + '</span>' + bdg(it.benefits) + '<p>' + esc(it.text) + '</p>' + srcLink(it.source) + '</div>';
      }) +
      panel('up', 'Role Up', 'New team or bigger job. Early-season prices often lag behind these changes.', q.role_up, simple) +
      panel('down', 'Role Down', 'Last season\u2019s numbers probably will not repeat.', q.role_down, simple) +
      panel('rest', 'Rest Watch', 'Players likely to sit back-to-backs or get rest days early.', q.rest_watch, simple) +
      panel('out', 'Out to Start the Season', 'Known injuries as of the latest episodes.', q.out_to_start, simple) +
      '</div>';
    $('v-quick').innerHTML = html;
  }

  var BADGES = [['minutes','Minutes'],['usage','Usage'],['threes','Threes'],['rebounds','Rebounds'],['assists','Assists'],['stocks','Stocks']];
  var bOn = {}, BMAP = {};
  function nkey(s){
    s = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.']/g, '').replace(/\u2019/g, '').trim();
    return s.replace(/ (iii|ii|jr)$/, '');
  }
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
      var bb = badgesOf(r.player);
      for (var k in bOn) if (bOn[k] && !bb[k]) return false;
      if (!q) return true;
      return (r.player + ' ' + r.team + ' ' + (NAMES[r.team] || '')).toLowerCase().indexOf(q) > -1;
    });
    $('r4p-rcount').textContent = list.length + ' of ' + all.length + ' players';
    $('r4p-ranklist').innerHTML = list.map(function(r){
      return '<div class="rk-row"><div class="rk-n">' + r.rank + '</div><div><span class="rk-name">' + esc(r.player) + '</span>' + tm(r.team) + '<span class="rk-pos">' + esc(r.pos) + '</span>' + bdg(r.player) +
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
    var list = db.teams.slice().sort(function(a,b){ return a.team < b.team ? -1 : 1; }).filter(function(x){ return !t || x.team === t; });
    $('r4p-teamcards').innerHTML = list.map(function(x){
      return '<div class="card"><h3>' + esc(NAMES[x.team] || x.team) + tm(x.team) + '</h3>' +
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
    return '<div class="card"><h3>' + esc(p.player) + ' ' + tm(p.team) + bdg(p.player) + '</h3>' + pills +
      (p.minutes ? '<span class="lbl">Minutes</span><div class="row">' + esc(p.minutes) + '</div>' : '') +
      (p.usage ? '<span class="lbl">Usage</span><div class="row">' + esc(p.usage) + '</div>' : '') +
      (p.status ? '<span class="lbl">Health</span><div class="row">' + esc(p.status) + '</div>' : '') +
      (p.note ? '<span class="lbl">Note</span><div class="row">' + esc(p.note) + '</div>' : '') + srcLink(p.source) + '</div>';
  }

  function players(){
    var q = $('r4p-q').value.trim().toLowerCase(), t = $('r4p-pteam').value;
    var list = db.players.filter(function(p){
      if (t && p.team !== t) return false;
      if (!q) return true;
      return (p.player + ' ' + p.team + ' ' + (NAMES[p.team] || '') + ' ' + p.role + ' ' + p.minutes + ' ' + p.usage + ' ' + p.status + ' ' + p.note).toLowerCase().indexOf(q) > -1;
    }).sort(function(a,b){ return (a.team + a.player) < (b.team + b.player) ? -1 : 1; });
    $('r4p-count').textContent = list.length + ' of ' + db.players.length + ' players';
    $('r4p-playercards').innerHTML = list.map(playerCard).join('');
  }

  function injuries(){
    $('r4p-injcards').innerHTML = db.injuries.slice().sort(function(a,b){ return a.team < b.team ? -1 : 1; }).map(function(p){
      return '<div class="card"><h3>' + esc(p.player) + ' ' + tm(p.team) + bdg(p.player) + '</h3><div class="row">' + esc(p.status) + '</div>' + (p.note ? '<div class="row">' + esc(p.note) + '</div>' : '') + srcLink(p.source) + '</div>';
    }).join('');
  }

  function moves(){
    var q = $('r4p-mq').value.trim().toLowerCase();
    $('r4p-movecards').innerHTML = db.moves.filter(function(m){
      return !q || (m.player + ' ' + m.from + ' ' + m.to + ' ' + (NAMES[m.from]||'') + ' ' + (NAMES[m.to]||'')).toLowerCase().indexOf(q) > -1;
    }).map(function(m){
      return '<div class="card"><h3>' + esc(m.player) + bdg(m.player) + '</h3><div class="row">' + (m.from ? tm(m.from, true) : 'Unknown') + ' <span class="arrow">\u2192</span> ' + tm(m.to, true) + (m.type ? ' \u00b7 ' + esc(m.type) : '') + '</div>' + (m.note ? '<div class="row">' + esc(m.note) + '</div>' : '') + srcLink(m.source) + '</div>';
    }).join('');
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


  fetchFirst(SOURCES, false).then(function(d){
    db = d;
    d.sources.forEach(function(s){ srcById[s.id] = s; });
    $('r4p-sub').textContent = 'Updated ' + d.updated + ' \u00b7 ' + d.players.length + ' players \u00b7 ' + d.teams.length + ' teams';
    teamOptions($('r4p-team')); teamOptions($('r4p-pteam'));
    badgeInit(); quick(); ranks(); teams(); players(); injuries(); moves();
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
