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
  var GLSOURCES = [
    'https://nascardataguy2.github.io/nba-2026-27/data/gamelogs.json',
    'https://cdn.jsdelivr.net/gh/nascardataguy2/nba-2026-27@main/data/gamelogs.json'
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
    var q = db.quickhits || {}, B = db.brief || {};
    function nm(name, team){ return '<span class="who">' + esc(name) + '</span>' + tm(team) + bdg(name); }
    function sec(cls, title, hint, body){ return body ? '<div class="panel ' + cls + '"><h2>' + title + '</h2>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + body + '</div>' : ''; }
    function d1(v){ return (Math.round(v * 10) / 10).toFixed(1); }
    function day(s){ var d = new Date(s + 'T12:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'}); }
    var html = '';
    var today = PJ && PJ.date ? PJ.date : '';
    var live = B.date && B.date === today && Object.keys(SLATE).length > 0;
    if (live){
      // Game cards in lock-time order, heat-mapped by game total (site orange = highest, site blue = lowest).
      var cardsL = (B.cards || []).slice();  // keep lock-time order
      var ous = cardsL.map(function(c){ return c.ou || 0; }), omax = Math.max.apply(null, ous), omin = Math.min.apply(null, ous);
      function heat(ou){
        // Above the middle of the slate fades to orange, below it fades to blue (no muddy mix).
        var t = omax > omin ? (ou - omin) / (omax - omin) : 1, hot = t >= 0.5, k = Math.abs(t - 0.5) * 2;
        var c = hot ? '228,87,46' : '29,53,87';
        return {edge: 'rgba(' + c + ',' + (0.25 + 0.75 * k).toFixed(2) + ')', bg: 'rgba(' + c + ',' + (0.03 + 0.11 * k).toFixed(3) + ')'};
      }
      var ncol = cardsL.length ? Math.ceil(cardsL.length / Math.ceil(cardsL.length / 5)) : 1;  // up to 5 across, rows as even as possible
      html += '<div class="bg-grid" style="--cols:' + ncol + '">' + cardsL.map(function(c){
        var fav = c.fav ? c.fav + ' \u2212' + c.line : 'Pick\u2019em', h = heat(c.ou || 0);
        var blow = (c.line || 0) >= 9 ? '<span class="bg-blow">Blowout risk</span>' : '';
        return '<div class="bg-card" style="border-left:6px solid ' + h.edge + ';background:' + h.bg + '"><div class="bg-head"><span class="bg-match">' + esc(c.away) + ' at ' + esc(c.home) + '</span><span class="bg-time">' + esc(gameTime(c.time)) + (c.slate === 'late' ? ' \u00b7 late' : '') + '</span></div>' +
          '<div class="bg-nums">Total <b>' + n1(c.ou) + '</b> \u00b7 ' + esc(fav) + blow + '</div></div>';
      }).join('') + '</div>';
      // What changed (a line in the top panel when nothing has changed)
      var ch = B.changed || [];
      if (ch.length){
        // Who benefits: the same teammates the Injuries table shows for this player.
        var injRows = (B.injuries || {}).rows || [];
        var chBen = function(c, phone){
          if (/Probable|Available/.test(c.status)) return phone ? '' : '<span class="bs-n">Expected to play</span>';
          var r = injRows.filter(function(x){ return nkey(x.player) === nkey(c.player); })[0];
          var b = r && r.benefits && r.benefits.length ? r.benefits : null;
          if (!b) return phone ? 'No fantasy impact' : '<span class="bs-n">No fantasy impact</span>';
          var names = b.map(function(x){ return esc(x.player) + ' <span class="bs-n">' + (x.recent != null ? n1(x.min) + ' min, up from ' + n1(x.recent) : '+' + n1(x.plus) + ' min') + '</span>'; }).join(', ');
          return (phone ? 'Benefits: ' : '') + names + (r.estimate ? ' <span class="bs-n">(estimate)</span>' : '');
        };
        var cls2 = function(st){ return /Out/.test(st) ? 'out' : /Doubtful/.test(st) ? 'dbt' : /Questionable/.test(st) ? 'q' : 'ok'; };
        html += sec('brief-ch', 'What Changed Today', 'Status changes since the first report' + (B.first_report ? ' at ' + esc(B.first_report) : '') + '. Check here right before lock.',
          '<div class="tbl-wrap ch-wrap"><table class="inj-tbl ch-tbl"><thead><tr><th>Player</th><th>Now</th><th>Was</th><th>Who benefits</th><th>Time</th></tr></thead><tbody>' +
          ch.map(function(c){
            return '<tr><td><span class="who">' + esc(c.player) + '</span> ' + tm(c.team) + '</td>' +
              '<td data-l="Now"><span class="bc-st ' + cls2(c.status) + '">' + esc(c.status) + '</span></td>' +
              '<td data-l="Was">' + (c.was ? '<span class="bc-st ' + cls2(c.was) + '">' + esc(c.was) + '</span>' : '<span class="bs-n">Not listed</span>') + '</td>' +
              '<td data-l="Who benefits">' + chBen(c) + '</td>' +
              '<td data-l="Time" class="bs-n">' + esc(c.time) + '</td>' +
              '<td class="ch-m"><span class="bc-st ' + cls2(c.status) + '">' + esc(c.status) + '</span> <span class="bs-n">' + (c.was ? 'was ' + esc(c.was.toLowerCase()) : 'newly listed') + '</span>' + (chBen(c, true) ? '<div class="bs-n">' + chBen(c, true) + '</div>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>');
      }
      // If he sits
      var sitsH = sec('sits', 'If He Sits, Who Benefits', 'Tonight\u2019s games only. Biggest impact first, and new news is flagged.', (B.sits || []).map(function(s){
        var outs = s.outs.map(function(o){ return '<span class="who">' + esc(o.player) + '</span>' + (o.new ? ' <span class="bc-new">New</span>' : ''); }).join(', ');
        var ben = s.benefits.map(function(b){ return '<span class="who">' + esc(b.player) + '</span>' + bdg(b.player) + ' <span class="bs-n">' + d1(b.min) + ' min (up from ' + d1(b.recent) + '), ' + d1(b.dk) + ' DK, ' + money(b.salary) + '</span>'; }).join('<br>');
        return '<div class="hit">' + tm(s.team) + ' ' + outs + ' <span class="arrow">\u2192</span><p>' + ben + '</p></div>';
      }).join(''));
      // Storylines: tonight's players first, then the rest
      var st = q.storylines || {}, items = (st.items || []).slice().sort(function(a, b){ return (SLATE[b.team] ? 1 : 0) - (SLATE[a.team] ? 1 : 0); });
      var storyH = sec('story', 'Storylines', 'Tonight\u2019s players first, then the rest of the league.', items.slice(0, 5).map(function(it){
        return '<div class="hit">' + nm(it.player, it.team) + '<p>' + esc(it.text) + '</p></div>';
      }).join(''));
      // Trending
      var tr = (B.hot || []).map(function(h){
        return '<div class="hit">' + nm(h.player, h.team) + ' <span class="tag ' + (h.kind === 'hot' ? 'up' : 'down') + '">' + (h.kind === 'hot' ? 'Hot' : 'Cold') + '</span><p>' + d1(h.last) + ' DK points a game over his last 3, ' + (h.kind === 'hot' ? 'up' : 'down') + ' from ' + d1(h.before) + ' in his ' + h.n + ' games before that.</p></div>';
      }).concat((B.minutes || []).map(function(h){
        return '<div class="hit">' + nm(h.player, h.team) + ' <span class="tag ' + (h.kind === 'up' ? 'up' : 'down') + '">Minutes ' + h.kind + '</span><p>' + d1(h.last) + ' minutes a game over his last 3, ' + (h.kind === 'up' ? 'up' : 'down') + ' from ' + d1(h.before) + ' in his ' + h.n + ' games before that.</p></div>';
      })).join('');
      // Field
      var fl = (B.chalk || []).map(function(p){ return '<div class="hit">' + nm(p.player, p.team) + ' <span class="bs-n">' + d1(p.own) + '% \u00b7 ' + d1(p.dk) + ' DK \u00b7 ' + money(p.salary) + '</span></div>'; }).join('');
      var lv = (B.leverage || []).map(function(p){ return '<div class="hit">' + nm(p.player, p.team) + ' <span class="bs-n">' + d1(p.own) + '% \u00b7 ' + d1(p.dk) + ' DK \u00b7 ' + money(p.salary) + '</span></div>'; }).join('');
      var trendH = sec('up', 'Trending', 'Tonight\u2019s players whose recent games stand out, from the box scores.', tr);
      var fieldH = sec('field', 'Where the Field Is Going', 'Our Own% estimate.', (fl ? '<h3 class="bf-h">Chalk</h3>' + fl : '') + (lv ? '<h3 class="bf-h">Low owned, strong projection</h3>' + lv : ''));
      // Two columns on wide screens, so If He Sits and Storylines sit side by side with no gaps.
      var IJ = B.injuries || {};
      var injL = '<button class="inj-link" type="button" data-go="injuries">Injury report' + (IJ.report ? ' \u00b7 ' + esc(IJ.report.replace(/^0/, '')) + ' ET' : '') + ((IJ.rows || []).filter(function(r){ return r.new; }).length ? ' \u00b7 <b>' + IJ.rows.filter(function(r){ return r.new; }).length + ' new</b>' : '') + ' \u2192</button>';
      html += '<div class="bg-cols"><div class="bg-col">' + injL + sitsH + fieldH + '</div><div class="bg-col">' + storyH + trendH + '</div></div>';
    } else {
      var st2 = q.storylines || {};
      html += sec('story', 'Storylines', 'The biggest news around the league.', (st2.items || []).slice(0, 8).map(function(it){
        return '<div class="hit">' + nm(it.player, it.team) + '<p>' + esc(it.text) + '</p></div>';
      }).join(''));
    }
    // Last night
    var L = B.last || {};
    if (L.date){
      var lt = (L.top || []).slice(0, 3).map(function(x){ return '<div class="hit">' + nm(x.player, x.team) + ' <span class="bs-n">' + d1(x.dk) + ' DK in ' + Math.round(x.min) + ' min (' + x.pts + ' pts, ' + x.reb + ' reb, ' + x.ast + ' ast)</span></div>'; }).join('');
      var ls = (L.surprise || []).slice(0, 3).map(function(x){ return '<div class="hit">' + nm(x.player, x.team) + '<p>He played ' + Math.round(x.min) + ' minutes; we projected ' + d1(x.proj) + '.</p></div>'; }).join('');
      var li = (L.injuries || []).slice(0, 3).map(function(x){ return '<div class="hit">' + nm(x.player, x.team) + '<p>' + esc(x.text) + '</p></div>'; }).join('');
      html += sec('last', 'Last Night', esc(day(L.date)) + '. More on each player in his notes.',
        (lt ? '<h3 class="bf-h">Top DK games</h3>' + lt : '') + (li ? '<h3 class="bf-h">Injuries</h3>' + li : '') + (ls ? '<h3 class="bf-h">Minutes surprises</h3>' + ls : ''));
    }
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

  // Tonight's slate first: teams by lock time, then the higher game total; players by projected DK points.
  function slateRank(team){
    if (!SLATE[team] || !PJ) return 'z';
    var g = (PJ.games || []).filter(function(x){ return x.away === team || x.home === team; })[0];
    return g ? 'a' + (g.time || '') + String(1000 - (g.ou || 0)) : 'z';
  }
  function projDK(p){
    if (!SLATE[p.team] || !PJ) return 0;
    var k = nkey(p.player), r = (PJ.players || []).filter(function(x){ return nkey(x.player) === k; })[0];
    return r && r.dk ? r.dk : 0.001;
  }
  function teams(){
    var t = $('r4p-team').value;
    var list = db.teams.slice().sort(function(a,b){ var ra = slateRank(a.team), rb = slateRank(b.team); if (ra !== rb) return ra < rb ? -1 : 1; return a.team < b.team ? -1 : 1; }).filter(function(x){ return (!t || x.team === t) && keep(x.team); });
    $('r4p-teamcards').innerHTML = list.map(function(x){
      return '<div class="card"><h3>' + esc(NAMES[x.team] || x.team) + tm(x.team) + tn(x.team) + '</h3>' +
        '<span class="lbl">Projected starters</span><div class="row">' + esc(x.starters) + '</div>' +
        (x.bench ? '<span class="lbl">Bench order</span><div class="row">' + esc(x.bench) + '</div>' : '') +
        (x.backup_c ? '<span class="lbl">Backup center</span><div class="row">' + esc(x.backup_c) + '</div>' : '') +
        (x.coach ? '<span class="lbl">Coach</span><div class="row">' + esc(x.coach) + '</div>' : '') +
        (x.depth_through ? '<div class="row sub">Depth chart from games through ' + esc(new Date(x.depth_through + 'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'})) + '.</div>' : '') +
        '<span class="lbl">Preseason notes</span><div class="row">' + esc(x.notes) + '</div>' + srcLink(x.source) + '</div>';
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
      logRows(p.player, 3) +
      (p.note ? '<span class="lbl">Note</span><div class="row">' + esc(p.note) + '</div>' : '') + srcLink(p.source) + updLine(p) + '</div>';
  }
  function updDate(p){ var s = srcById[p.source], d = (s && s.date) || '', L = logFor(p.player); return L.length && L[0].d > d ? L[0].d : d; }
  function updLine(p){
    var d = updDate(p); if (!d) return '';
    var dd = new Date(d + 'T12:00:00');
    return isNaN(dd) ? '' : '<div class="upd">Updated ' + dd.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + '</div>';
  }

  function players(){
    var q = $('r4p-q').value.trim().toLowerCase(), t = $('r4p-pteam').value;
    var list = db.players.filter(function(p){
      if (t && p.team !== t) return false;
      if (!keep(p.team)) return false;
      if (!q) return true;
      return (p.player + ' ' + p.team + ' ' + (NAMES[p.team] || '') + ' ' + p.role + ' ' + p.minutes + ' ' + p.usage + ' ' + p.status + ' ' + p.note).toLowerCase().indexOf(q) > -1;
    }).sort(function(a,b){
      var pa = projDK(a), pb = projDK(b);
      if ((pa > 0) !== (pb > 0)) return pa > 0 ? -1 : 1;
      if (pa > 0 && pb > 0 && pa !== pb) return pb - pa;
      var da = updDate(a), dbb = updDate(b);
      if (da !== dbb) return da > dbb ? -1 : 1;
      return (a.team + a.player) < (b.team + b.player) ? -1 : 1;
    });
    $('r4p-count').textContent = list.length + ' of ' + db.players.length + ' players';
    $('r4p-playercards').innerHTML = list.map(playerCard).join('');
  }

  function injuries(){
    var B = db.brief || {}, IJ = B.injuries || {}, el = $('r4p-injcards');
    var live = B.date && PJ && B.date === PJ.date && Object.keys(SLATE).length > 0 && IJ.rows;
    if (!live){
      el.className = 'cards';
      var tb0 = el.parentNode.querySelector('.toolbar'); if (tb0) tb0.style.display = '';
      el.innerHTML = db.injuries.slice().filter(function(p){ return keep(p.team); }).sort(function(a,b){ return a.team < b.team ? -1 : 1; }).map(function(p){
        return '<div class="card"><h3>' + esc(p.player) + ' ' + tm(p.team) + tn(p.team, p.player) + bdg(p.player) + '</h3><div class="row">' + esc(p.status) + '</div>' + (p.note ? '<div class="row">' + esc(p.note) + '</div>' : '') + logRows(p.player, 2) + srcLink(p.source) + '</div>';
      }).join('') || '<p class="sub">No injury notes for tonight\u2019s teams.</p>';
      return;
    }
    el.className = 'inj-wrap';
    var tb = el.parentNode.querySelector('.toolbar'); if (tb) tb.style.display = 'none';
    function cls(st){ return /Out/.test(st) ? 'out' : /Doubtful/.test(st) ? 'dbt' : /Questionable/.test(st) ? 'q' : 'ok'; }
    var head = '<div class="panel inj-head"><h2>Injury Report</h2><p class="hint">Official NBA report' + (IJ.report ? ' from ' + esc(IJ.report.replace(/^0/, '')) + ' ET' : '') + ' for tonight\u2019s games. New statuses are listed first.' +
      ((IJ.pending || []).length ? ' Not filed yet: ' + IJ.pending.map(function(t){ return tm(t); }).join(' ') + '.' : ' Every team on the slate has filed.') +
      (IJ.url ? ' <a href="' + esc(IJ.url) + '" target="_blank" rel="noopener">Open the NBA\u2019s PDF</a>.' : '') + '</p></div>';
    var rows = (IJ.rows || []).map(function(r){
      var ben = (r.benefits || []).map(function(b){
        return '<div><span class="who">' + esc(b.player) + '</span> <span class="bs-n">' + (b.recent != null ? n1(b.min) + ' min, up from ' + n1(b.recent) : '+' + n1(b.plus) + ' min') + '</span></div>';
      }).join('');
      if (ben && r.estimate) ben = '<div class="bs-n">If he sits (estimate):</div>' + ben;
      var nw = r.new ? '<span class="bc-new">New</span>' + (r.was ? ' <span class="bs-n">was ' + esc(r.was.toLowerCase()) + '</span>' : ' <span class="bs-n">newly listed</span>') + (r.changed_at ? ' <span class="bs-n">' + esc(r.changed_at) + '</span>' : '') : (r.known ? '<span class="bs-n">Same as last report</span>' : '<span class="bs-n">\u2013</span>');
      return '<tr' + (r.new ? ' class="is-new"' : '') + '><td><span class="who">' + esc(r.player) + '</span> ' + tm(r.team) + bdg(r.player) + '<div class="bs-n">' + esc(r.game) + ' \u00b7 ' + esc(gameTime(r.time)) + ' \u00b7 ' + n1(r.min) + ' min a game</div></td>' +
        '<td data-l="Status"><span class="bc-st ' + cls(r.status) + '">' + esc(r.status) + '</span>' + (r.reason ? '<div class="bs-n">' + esc(r.reason) + '</div>' : '') + '</td>' +
        '<td data-l="New?">' + nw + '</td><td data-l="Who benefits">' + (ben || '<span class="bs-n">No fantasy impact</span>') + '</td></tr>';
    }).join('');
    var tbl = '<div class="tbl-wrap"><table class="inj-tbl"><thead><tr><th>Player</th><th>Status</th><th>New?</th><th>Who benefits</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4" class="sub">No rotation players on tonight\u2019s report.</td></tr>') + '</tbody></table></div>';
    var minor = (IJ.minor || []).length ? '<details class="inj-minor"><summary>Also on the report (' + IJ.minor.length + ' players under 10 minutes a game)</summary><p>' +
      IJ.minor.map(function(m){ return esc(m.player) + ' ' + tm(m.team) + ' ' + esc(m.status); }).join(' \u00b7 ') + '</p></details>' : '';
    el.innerHTML = head + tbl + minor;
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
  // Tonight's slate in the header: game count, main-slate lock and late games.
  function hdSlate(){
    var el = $('r4p-hslate');
    if (!el || !PJ) return;
    var today = new Date().toLocaleDateString('en-CA', {timeZone:'America/New_York'});
    var gs = PJ.date === today ? (PJ.games || []) : [];
    if (!gs.length){ el.hidden = true; return; }
    var main = gs.filter(function(g){ return g.slate === 'main'; });
    var late = gs.filter(function(g){ return g.slate === 'late'; });
    var lock = main.map(function(g){ return g.time; }).filter(Boolean).sort()[0];
    var bits = ['<b>Tonight:</b> ' + gs.length + (gs.length === 1 ? ' game' : ' games')];
    if (main.length) bits.push('Main slate (' + main.length + ') locks <b>' + esc(gameTime(lock)) + '</b>');
    var llock = late.map(function(g){ return g.time; }).filter(Boolean).sort()[0];
    if (late.length) bits.push((lock && llock && llock < lock ? 'Early' : 'Late') + ' slate (' + late.length + ') locks <b>' + esc(gameTime(llock)) + '</b>');
    el.innerHTML = bits.join(' \u00b7 ');
    el.hidden = false;
  }
  var PLATE = false;
  function pSplit(){ return !!(PJ && PJ.players.some(function(p){ return p.slate && p.slate !== 'main'; })); }
  // Games on no DraftKings classic slate (an afternoon game, say) have no prices, so they stay hidden.
  function pShow(slate){ return !pSplit() || !slate || slate === 'main' || (PLATE && slate === 'late'); }
  function slateTag(p){ return p.slate === 'late' ? '<span class="role late">Late</span>' : (p.slate === 'off' ? '<span class="role late">No DK slate</span>' : ''); }
  function projGames(){
    var d = PJ;
    $('r4p-games').innerHTML = (d.games || []).filter(function(g){ return pShow(g.slate); }).map(function(g){
      var fav = g.fav ? esc(g.fav) + ' \u2212' + n1(g.line) : 'Even';
      var lbl = pSplit() && g.slate !== 'main' ? '<span class="gm-sl">' + (g.slate === 'late' ? 'Late slate' : 'No DK slate') + '</span>' : '';
      return '<div class="gm' + (lbl ? ' gm-late' : '') + '"><div class="gm-t">' + tm(g.away, true) + ' <span class="gm-at">at</span> ' + tm(g.home, true) + '<span class="gm-time">' + esc(gameTime(g.time)) + '</span></div>' + lbl +
        '<div class="gm-l">Total ' + n1(g.ou) + ' \u00b7 ' + fav + '</div>' +
        '<div class="gm-l">' + esc(g.away) + ' ' + n1(g.away_pts) + ' \u00b7 ' + esc(g.home) + ' ' + n1(g.home_pts) + '</div></div>';
    }).join('');
    var sel = $('r4p-pgame'), cur = sel.value;
    sel.innerHTML = '<option value="">All games</option>' + (d.games || []).filter(function(g){ return pShow(g.slate); }).map(function(g){
      return '<option value="' + g.away + '|' + g.home + '">' + g.away + ' at ' + g.home + (pSplit() && g.slate !== 'main' ? ' (' + (g.slate === 'late' ? 'late' : 'no DK slate') + ')' : '') + '</option>';
    }).join('');
    if (cur && [].some.call(sel.options, function(o){ return o.value === cur; })) sel.value = cur;
    var b = $('r4p-plate');
    if (b){
      var nl = (d.games || []).filter(function(g){ return g.slate === 'late'; }).length;
      b.hidden = !nl;
      b.textContent = PLATE ? 'Hide late games' : 'Show late games (' + nl + ')';
      b.classList.toggle('on', PLATE);
    }
  }
  function projInit(d){
    PJ = d;
    setSub();
    hdSlate();
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
    var nMain = d.players.filter(function(p){ return !p.slate || p.slate === 'main'; }).length;
    $('r4p-psub').textContent = day + ' \u00b7 ' + (pSplit() ? nMain + ' players on the DraftKings main slate' : d.players.length + ' players') + ' \u00b7 updated ' + d.updated + '.' + acc;
    projGames();
    var outs = d.out || [];
    $('r4p-pout').innerHTML = outs.length ? '<div class="panel out-list"><h2>Ruled Out Tonight</h2>' + outs.map(function(o){
      return '<div class="hit"><span class="who">' + esc(o.player) + '</span>' + tm(o.team) + '<p>' + esc(o.note) + '</p></div>';
    }).join('') + '</div>' : '';
    proj();
  }
  // Player notes: everything we know about a player, opened by the notes icon.
  var CTX = {}, NOPEN = {};
  var NICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.5 1.8h6.2l2.8 2.8v9.6h-9zM5.6 7h4.8M5.6 9.6h4.8M5.6 12.2h3"/></svg>';
  var LOG = {};
  function logInit(){
    LOG = {};
    (db.log || []).forEach(function(e){ var k = nkey(e[0]); (LOG[k] = LOG[k] || []).push({d: e[1], k: e[2], t: e[3]}); });
    Object.keys(LOG).forEach(function(k){ LOG[k].sort(function(a, b){ return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; }); });
  }
  function samey(a, b){
    var w = function(x){ return String(x).toLowerCase().match(/[a-z0-9]+/g) || []; }, A = w(a), B = w(b), set = {}, hit = 0;
    A.forEach(function(x){ set[x] = 1; }); B.forEach(function(x){ if (set[x]) hit++; });
    return B.length && hit / B.length > 0.55;
  }
  function logFor(name){ return LOG[nkey(name)] || []; }
  function logDay(d){ var dd = new Date(d + 'T12:00:00'); return isNaN(dd) ? d : dd.toLocaleDateString('en-US', {month:'short', day:'numeric'}); }
  function logRows(name, n){
    var L = logFor(name); if (!L.length) return '';
    var row = function(e){ return '<div class="row lg"><b>' + esc(logDay(e.d)) + ':</b> ' + esc(e.t) + '</div>'; };
    return '<span class="lbl">Latest news</span>' + L.slice(0, n).map(row).join('') +
      (L.length > n ? '<details class="nt-more"><summary>More news (' + (L.length - n) + ')</summary>' + L.slice(n).map(row).join('') + '</details>' : '');
  }
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
    logFor(name).forEach(function(e){ add(logDay(e.d), e.t); });
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
  var GL = {};
  function glRows(name){ return GL[nkey(name)] || []; }
  function noteHtml(bits, name){
    var lead = null, info = [], rest = [];
    bits.forEach(function(b){
      if (!lead && (b[0] === 'Tonight' || b[0] === 'Why')) lead = b;
      else if (b[0] === 'Role' || b[0] === 'Minutes' || b[0] === 'Usage' || b[0] === 'Health') info.push(b);
      else rest.push(b);
    });
    var left = (lead ? '<p class="nt-lead">' + esc(lead[1]) + '</p>' : '') +
      (info.length ? '<p class="nt-info">' + info.map(function(b){ return '<span class="nt-tag"><b>' + esc(b[0]) + '</b> ' + esc(b[1]) + '</span>'; }).join('') + '</p>' : '') +
      rest.slice(0, 3).map(function(b){ return '<p class="nt"><b>' + esc(b[0]) + ':</b> ' + esc(b[1]) + '</p>'; }).join('') +
      (rest.length > 3 ? '<details class="nt-more"><summary>More notes (' + (rest.length - 3) + ')</summary>' + rest.slice(3).map(function(b){ return '<p class="nt"><b>' + esc(b[0]) + ':</b> ' + esc(b[1]) + '</p>'; }).join('') + '</details>' : '');
    var g = name ? glRows(name) : [];
    var right = '';
    if (g.length){
      var head = '<tr><th>Date</th><th>Opp</th><th>Min</th><th>Proj</th><th>DK</th><th>Proj</th><th>Pts</th><th>Reb</th><th>Ast</th><th>3PM</th><th>Stl</th><th>Blk</th><th>TO</th></tr>';
      var row = function(r){
        var d = r[0].slice(5).replace('-', '/').replace(/^0/, ''), op = r[2] ? (r[3] ? 'vs\u00a0' : '@') + r[2] : '';
        var hit = r[15] != null ? (r[13] >= r[15] ? ' up' : ' down') : '';
        return '<tr><td>' + esc(d) + (r[4] ? ' <i>S</i>' : '') + '</td><td>' + esc(op) + '</td><td>' + n1(r[5]) + '</td><td class="gl-p">' + (r[14] == null ? '\u2013' : n1(r[14])) + '</td>' +
          '<td class="gl-dk' + hit + '">' + n1(r[13]) + '</td><td class="gl-p">' + (r[15] == null ? '\u2013' : n1(r[15])) + '</td>' +
          [6, 7, 8, 12, 9, 10, 11].map(function(i){ return '<td>' + Math.round(r[i]) + '</td>'; }).join('') + '</tr>';
      };
      right = '<div class="gl"><p class="gl-h">Game log <span>' + g.length + (g.length === 1 ? ' game' : ' games') + ' \u00b7 S = started \u00b7 Proj = our projection that night</span></p>' +
        '<div class="gl-w"><table class="gl-t"><thead>' + head + '</thead><tbody>' + g.slice(0, 5).map(row).join('') + '</tbody></table></div>' +
        (g.length > 5 ? '<details class="nt-more"><summary>Show all ' + g.length + ' games</summary><div class="gl-w"><table class="gl-t"><tbody>' + g.slice(5).map(row).join('') + '</tbody></table></div></details>' : '') + '</div>';
    }
    return '<div class="nt-box' + (right && left ? ' two' : '') + '">' + (left ? '<div class="nt-l">' + left + '</div>' : '') + right + '</div>';
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
    ['ou','O/U','n'], ['spread','Spread','s'], ['dk','DK','n'], ['value','Val','n'], ['own','Own%','n'], ['min','Min','n'], ['usg','Usg','n'],
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
    if (k === 'usg' || k === 'own') return v == null ? '\u2013' : n1(v) + '%';
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
    var shown = PJ.players.filter(function(p){ return pShow(p.slate); });
    var list = shown.filter(function(p){
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
    $('r4p-pcount').textContent = list.length + ' of ' + shown.length + ' players';
    var arrow = function(c){ return c === k ? (dir > 0 ? ' \u25b2' : ' \u25bc') : ''; };
    var th = PCOLS.map(function(c){
      return '<th class="c-' + c[0] + (c[0] === k ? ' on' : '') + '" data-k="' + c[0] + '" scope="col" tabindex="0" aria-sort="' + (c[0] === k ? (dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + c[1] + arrow(c[0]) + '</th>';
    }).join('');
    var rows = list.map(function(p){
      var bits = noteBits(p.player), has = bits.length > 0 || glRows(p.player).length > 0, open = has && NOPEN[nkey(p.player)];
      var tags = (p.start ? '<span class="role starter">Starter</span>' : '') + (p.q ? '<span class="role out">Q</span>' : '') + slateTag(p) + nbtn(p.player, has);
      var tds = PCOLS.map(function(c){
        var key = c[0];
        if (key === 'player') return '<td class="c-player"><span class="pj-name' + (has ? ' has' : '') + '" data-n="' + esc(p.player) + '">' + esc(p.player) + '</span>' + tags + '</td>';
        if (key === 'team') return '<td class="c-team">' + tm(p.team, true) + '</td>';
        if (key === 'opp') return '<td class="c-opp">' + (p.opp ? tm(p.opp, true) : '') + '</td>';
        if (key === 'pos') return '<td class="c-pos">' + esc(p.pos) + '</td>';
        var st = heatCss(key, p[key]);
        return '<td class="c-' + key + '"' + (st ? ' style="' + st + '"' : '') + '>' + fmt(p, key) + '</td>';
      }).join('');
      return '<tr' + (open ? ' class="nt-open"' : '') + '>' + tds + '</tr>' + (open ? '<tr class="pj-notes"><td colspan="' + PCOLS.length + '">' + noteHtml(bits, p.player) + '</td></tr>' : '');
    }).join('') || '<tr><td colspan="' + PCOLS.length + '">No players match.</td></tr>';
    var cards = list.map(function(p){
      var bits = noteBits(p.player), has = bits.length > 0 || glRows(p.player).length > 0, open = has && NOPEN[nkey(p.player)];
      var tags = (p.start ? '<span class="role starter">Starter</span>' : '') + (p.q ? '<span class="role out">Questionable</span>' : '') + slateTag(p) + nbtn(p.player, has);
      var box = function(key, lbl){ var st = heatCss(key, p[key]); return '<div class="pjc-n"' + (st ? ' style="' + st + '"' : '') + '><span>' + lbl + '</span>' + fmt(p, key) + '</div>'; };
      return '<div class="pjc"><div class="pjc-who"><span class="pj-name' + (has ? ' has' : '') + '" data-n="' + esc(p.player) + '">' + esc(p.player) + '</span> <span class="pk-pos">' + esc(p.pos) + '</span>' + tags + '</div>' +
        '<div class="pjc-game">' + tm(p.team, true) + ' vs ' + (p.opp ? tm(p.opp, true) : '') + ' \u00b7 O/U ' + fmt(p, 'ou') + ' \u00b7 Spread ' + fmt(p, 'spread') + '</div>' +
        '<div class="pjc-nums">' + box('salary', 'Sal') + box('dk', 'DK') + box('value', 'Val') + box('own', 'Own%') + box('min', 'Min') + box('usg', 'Usg') + '</div>' +
        '<div class="pjc-line">' + [['pts','pts'],['reb','reb'],['ast','ast'],['stl','stl'],['blk','blk'],['to','to']].map(function(x){ return '<b>' + n1(p[x[0]]) + '</b> ' + x[1]; }).join(' \u00b7 ') + '</div>' +
        (open ? noteHtml(bits, p.player) : '') + '</div>';
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
      var bits = noteBits(p.player), has = bits.length > 0 || glRows(p.player).length > 0, open = has && NOPEN[nkey(p.player)];
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
      return '<tr' + (open ? ' class="nt-open"' : '') + '>' + tds + '</tr>' + (open ? '<tr class="pj-notes"><td colspan="' + RCOLS.length + '">' + noteHtml(bits, p.player) + '</td></tr>' : '');
    }).join('') || '<tr><td colspan="' + RCOLS.length + '">No players match.</td></tr>';
    var cards = list.map(function(p){
      var bits = noteBits(p.player), has = bits.length > 0 || glRows(p.player).length > 0, open = has && NOPEN[nkey(p.player)];
      var tags = (p.start ? '<span class="role starter">Starter</span>' : '') + (p.q ? '<span class="role out">Questionable</span>' : '') + nbtn(p.player, has);
      var box = function(key, lbl){ var st = rHeat(key, p[key]); return '<div class="pjc-n"' + (st ? ' style="' + st + '"' : '') + '><span>' + lbl + '</span>' + rFmt(p, key) + '</div>'; };
      var game = p.opp ? tm(p.team, true) + ' vs ' + tm(p.opp, true) + ' \u00b7 ' + money(p.salary) + ' \u00b7 O/U ' + rFmt(p, 'ou') + ' \u00b7 Spread ' + rFmt(p, 'spread') : tm(p.team, true) + ' \u00b7 No game tonight';
      return '<div class="pjc"><div class="pjc-who"><span class="pj-name' + (has ? ' has' : '') + '" data-n="' + esc(p.player) + '">' + esc(p.player) + '</span> <span class="pk-pos">' + esc(p.pos) + '</span>' + tags + '</div>' +
        '<div class="pjc-game">' + game + '</div>' +
        '<div class="pjc-nums">' + box('gp', 'GP') + box('min', 'Min') + box('dk', 'DK') + box('fppm', 'FP/Min') + box('l3_dk', 'L3 DK') + '</div>' +
        '<div class="pjc-line">' + [['pts','pts'],['reb','reb'],['ast','ast'],['stl','stl'],['blk','blk'],['to','to'],['tpm','3pm']].map(function(x){ return '<b>' + n1(p[x[0]]) + '</b> ' + x[1]; }).join(' \u00b7 ') + '</div>' +
        (open ? noteHtml(bits, p.player) : '') + '</div>';
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
  var OSLATE = 'main';
  function oMainOnly(){ return !!(PJ && PJ.players.some(function(p){ return p.dkid; })); }
  function oMain(p){ return !oMainOnly() || (!!p.dkid && (p.slate || 'main') === OSLATE); }
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
  var OHEAT = {};
  // One short line of context for the optimizer row: our projection note first, else his newest news.
  function oCtx(p){
    var t = p.note ? String(p.note) : '';
    if (!t){
      var L = logFor(p.player);
      if (L.length){
        var x = L[0].t;  // the name is already on the row, so open with "He" instead
        if (x.indexOf(p.player + ' ') === 0) x = 'He ' + x.slice(p.player.length + 1);
        t = logDay(L[0].d) + ': ' + x;
      }
    }
    if (t.length > 140) t = t.slice(0, 137).replace(/\s+\S*$/, '') + '\u2026';
    return t ? '<div class="op-ctx">' + esc(t) + '</div>' : '';
  }
  function heat(k, v){
    return '';  // shading removed: plain table reads better
    var r = OHEAT[k];
    if (v == null || isNaN(v) || !r || !(r[1] > r[0])) return '';
    var t = (v - r[0]) / (r[1] - r[0]), hot = t >= 0.5, a = Math.abs(t - 0.5) * 2;
    return ' style="background:rgba(' + (hot ? '228,87,46' : '29,53,87') + ',' + (0.04 + 0.2 * a).toFixed(3) + ')"';
  }
  function optPool(){
    if (!PJ || !$('r4p-opool')) return;
    if (!oToday()){ $('r4p-osub').textContent = 'Tonight\u2019s projections are not posted yet. Please check back closer to the first game.'; $('r4p-opool').innerHTML = ''; return; }
    var st = oStarted(), q = $('r4p-oq').value.trim().toLowerCase();
    var og = oGames();
    var hasLate = PJ.players.some(function(p){ return p.slate === 'late' && p.dkid; });
    var ss = $('r4p-oslate');
    if (ss){
      ss.hidden = !hasLate;
      if (hasLate){
        var nm = (PJ.games || []).filter(function(g){ return g.slate === 'main'; }).length, nl = (PJ.games || []).filter(function(g){ return g.slate === 'late'; }).length;
        ss.innerHTML = '<option value="main">Main slate (' + nm + ' games)</option><option value="late">Late slate (' + nl + ' games)</option>';
        ss.value = OSLATE;
      } else OSLATE = 'main';
    }
    $('r4p-osub').textContent = 'We watch ball. We know ball. Build DraftKings ' + (OSLATE === 'late' ? 'late-slate' : 'main-slate') + ' lineups from our projections for ' + og.length + (og.length === 1 ? ' game' : ' games') + ' tonight \u00b7 updated ' + PJ.updated + '.';
    var list = PJ.players.filter(function(p){
      if (!p.salary || !oMain(p)) return false;
      return !q || (p.player + ' ' + p.team + ' ' + (NAMES[p.team] || '')).toLowerCase().indexOf(q) > -1;
    });
    $('r4p-opool').innerHTML = (
    (function(){
      // Heat map for DK, value and Own%: the slate's high end in site orange, low end in site blue.
      function rng(f){ var v = list.map(f).filter(function(x){ return x != null && !isNaN(x); }); return [Math.min.apply(null, v), Math.max.apply(null, v)]; }
      OHEAT = {dk: rng(function(p){ return p.dk; }), val: rng(function(p){ return p.salary ? p.dk / p.salary * 1000 : null; }), own: rng(function(p){ return p.own; })};
    })(),
    '<div class="op-head"><span>Player</span><span class="op-x">Min</span><span class="op-x">O/U</span><span>Sal</span><span>DK</span><span class="op-xp">Val</span><span>Own%</span><span></span></div>' + list.map(function(p){
      var k = nkey(p.player), lk = !!OLOCK[k], ex = !!OEXCL[k];
      var bits = noteBits(p.player), has = bits.length > 0 || glRows(p.player).length > 0, open = has && NOPEN[k];
      var tags = (p.q ? '<span class="role out">Q</span>' : '') + (st[p.team] ? '<span class="role">Started</span>' : '') + nbtn(p.player, has);
      return '<div class="op-row' + (lk ? ' lk' : '') + (ex ? ' ex' : '') + '"><div class="op-who"><div class="op-id"><span class="pj-name' + (has ? ' has' : '') + '" data-n="' + esc(p.player) + '">' + esc(p.player) + '</span>' + tags +
        '<div class="op-sub"><span class="pk-pos">' + esc(p.pos) + '</span> ' + tm(p.team, true) + ' vs ' + (p.opp ? tm(p.opp, true) : '') + '</div></div>' + oCtx(p) + '</div>' +
        '<span class="op-m op-x">' + n1(p.min) + '</span><span class="op-m op-x">' + (p.ou ? n1(p.ou) : '\u2013') + '</span>' +
        '<span class="op-s">' + money(p.salary) + '</span><span class="op-d"' + heat('dk', p.dk) + '>' + n1(p.dk) + '</span>' +
        '<span class="op-v op-xp"' + heat('val', p.salary ? p.dk / p.salary * 1000 : null) + '>' + (p.salary ? (p.dk / p.salary * 1000).toFixed(2) : '\u2013') + '</span>' +
        '<span class="op-o"' + heat('own', p.own) + '>' + (p.own == null ? '\u2013' : n1(p.own) + '%') + '</span>' +
        '<span class="op-b"><button class="ob' + (lk ? ' on' : '') + '" data-lock="' + esc(p.player) + '" type="button" aria-pressed="' + lk + '">' + (lk ? 'Locked' : 'Lock') + '</button>' +
        '<button class="ob x' + (ex ? ' on' : '') + '" data-excl="' + esc(p.player) + '" type="button" aria-pressed="' + ex + '">' + (ex ? 'Out' : 'Take out') + '</button></span>' +
        (open ? '<div class="op-notes">' + noteHtml(bits, p.player) + '</div>' : '') + '</div>';
    }).join(''));
  }
  function optStars(){
    if (OSLATE === 'late'){ oMsg('Stars & Scrubs covers the main slate only. Switch to the main slate to start from it.'); return; }
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
    a.download = 'nbadfs-lineups-' + PJ.date + (OSLATE === 'late' ? '-late' : '') + '.csv';
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

  // Who benefits when he sits: take players off the court, see every teammate's DK per minute.
  var WYI = null, WYT = {}, WOFF = {};
  function wyUrls(f){ return GBASE.map(function(b){ return b.replace('/games/', '/wowy/') + f; }); }
  function wyTeam(){
    var t = $('r4p-wyteam').value;
    WOFF = {};
    if (WYT[t]){ wyChips(); return; }
    $('r4p-wychips').innerHTML = ''; $('r4p-wybox').innerHTML = '<p class="sub">Loading\u2026</p>';
    fetchFirst(wyUrls(t + '.json'), false).then(function(d){ WYT[t] = d; if ($('r4p-wyteam').value === t) wyChips(); })
      .catch(function(){ $('r4p-wybox').innerHTML = '<p class="sub">These splits could not load right now. Please try again in a minute.</p>'; });
  }
  function wyTotals(d){
    var tot = {};
    d.games.forEach(function(g){ Object.keys(g.players).forEach(function(n){ var p = g.players[n]; tot[n] = (tot[n] || 0) + p.st.reduce(function(a, s){ return a + s[1] - s[0]; }, 0) / 60; }); });
    return tot;
  }
  function wyChips(){
    var d = WYT[$('r4p-wyteam').value]; if (!d) return;
    var tot = wyTotals(d), names = Object.keys(tot).sort(function(a, b){ return tot[b] - tot[a]; });
    $('r4p-wychips').innerHTML = names.map(function(n){
      var on = !!WOFF[n];
      return '<button class="wy-chip' + (on ? ' on' : '') + '" type="button" data-off="' + esc(n) + '" aria-pressed="' + on + '">' + esc(n) + '</button>';
    }).join('');
    wyRender();
  }
  function wyRender(){
    var d = WYT[$('r4p-wyteam').value]; if (!d) return;
    var off = Object.keys(WOFF).filter(function(n){ return WOFF[n]; });
    if (!off.length){ $('r4p-wybox').innerHTML = '<p class="sub">Click one or more players above to take them off the court.</p>'; return; }
    function anyOn(g, t){ for (var k = 0; k < off.length; k++){ var p = g.players[off[k]]; if (p && p.st.some(function(s){ return s[0] <= t && t <= s[1]; })) return true; } return false; }
    function offIntervals(g){
      // stretches of the game where at least one chosen player is on the court
      var iv = []; off.forEach(function(n){ var p = g.players[n]; if (p) iv = iv.concat(p.st.map(function(s){ return [s[0], s[1]]; })); });
      iv.sort(function(a, b){ return a[0] - b[0]; });
      var m = []; iv.forEach(function(x){ if (m.length && x[0] <= m[m.length - 1][1]) m[m.length - 1][1] = Math.max(m[m.length - 1][1], x[1]); else m.push(x); });
      return m;
    }
    var acc = {};
    d.games.forEach(function(g){
      var onIv = offIntervals(g);
      Object.keys(g.players).forEach(function(n){
        if (WOFF[n]) return;
        var p = g.players[n], a = acc[n] || (acc[n] = {mOn:0, dOn:0, mOff:0, dOff:0});
        p.st.forEach(function(s){
          var len = s[1] - s[0], ov = 0;
          onIv.forEach(function(x){ ov += Math.max(0, Math.min(s[1], x[1]) - Math.max(s[0], x[0])); });
          a.mOn += ov / 60; a.mOff += (len - ov) / 60;
        });
        p.ev.forEach(function(e){ if (anyOn(g, e[0])) a.dOn += e[1]; else a.dOff += e[1]; });
      });
    });
    var who = off.length === 1 ? off[0] : (off.length === 2 ? off.join(' and ') : off.slice(0, -1).join(', ') + ' and ' + off[off.length - 1]);
    var onLbl = off.length === 1 ? 'With him on' : 'With any of them on', offLbl = off.length === 1 ? 'With him off' : 'With all of them off';
    var rows = Object.keys(acc).map(function(n){ var a = acc[n]; return {n:n, a:a, on:a.mOn > 0 ? a.dOn / a.mOn : null, of:a.mOff > 0 ? a.dOff / a.mOff : null}; })
      .filter(function(x){ return x.a.mOff > 0; })
      .map(function(x){ x.small = x.a.mOn < 10 || x.a.mOff < 10; x.d = (x.on != null && x.of != null) ? x.of - x.on : null; return x; })
      .sort(function(x, y){ return (x.small - y.small) || ((y.d == null ? -99 : y.d) - (x.d == null ? -99 : x.d)); });
    $('r4p-wybox').innerHTML = '<p class="wy-all">How each teammate scores with <b>' + esc(who) + '</b> off the court, in DraftKings points per minute. Green means he scores more without ' + (off.length === 1 ? 'him' : 'them') + '.</p>' +
      '<div class="wy-t"><div class="wy-r wy-h"><span>Teammate</span><span>' + onLbl + '</span><span>' + offLbl + '</span><span>Diff</span></div>' +
      (rows.map(function(x){
        var dc = x.d == null || x.small ? '' : (x.d >= 0.15 ? ' up' : (x.d <= -0.15 ? ' down' : ''));
        return '<div class="wy-r' + (x.small ? ' small' : '') + '"><span class="wy-m">' + esc(x.n) + (x.small ? ' <small>small sample</small>' : '') + '</span>' +
          '<span><b>' + (x.on == null ? '\u2013' : x.on.toFixed(2)) + '</b> in ' + n1(x.a.mOn) + ' min</span>' +
          '<span><b>' + (x.of == null ? '\u2013' : x.of.toFixed(2)) + '</b> in ' + n1(x.a.mOff) + ' min</span>' +
          '<span class="wy-d' + dc + '">' + (x.d == null ? '\u2013' : (x.d > 0 ? '+' : x.d < 0 ? '\u2212' : '') + Math.abs(x.d).toFixed(2)) + '</span></div>';
      }).join('') || '<div class="wy-r"><span>No teammate has played without ' + esc(who) + ' yet.</span></div>') + '</div>';
  }
  document.addEventListener('click', function(e){
    var c = e.target.closest ? e.target.closest('.wy-chip') : null;
    if (!c) return;
    var n = c.getAttribute('data-off'); WOFF[n] = !WOFF[n];
    c.classList.toggle('on', !!WOFF[n]); c.setAttribute('aria-pressed', !!WOFF[n]);
    wyRender();
  });

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
        (p.why ? '<p class="ssc-why"><b>Why:</b> ' + esc(p.why) + '</p>' : '') +
        logFor(p.player).filter(function(e){ return !p.why || !samey(p.why, e.t); }).slice(0, 2).map(function(e){ return '<p class="ssc-why"><b>' + esc(logDay(e.d)) + ':</b> ' + esc(e.t) + '</p>'; }).join('') + '</div>';
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

  document.addEventListener('click', function(e){ var g = e.target.closest ? e.target.closest('[data-go]') : null; if (g) show(g.getAttribute('data-go')); });
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
  fetchFirst(wyUrls('index.json'), false).then(function(d){
    WYI = d;
    var ts = Object.keys(d.teams || {}).sort();
    $('r4p-wyteam').innerHTML = ts.map(function(c){ return '<option value="' + c + '">' + c + ' \u2013 ' + esc(NAMES[c] || c) + '</option>'; }).join('');
    $('r4p-wysub').textContent = 'Pick a team, then take one or more players off the court to see how every teammate scores without them, over every game this season. Games a player missed count as off the court. Numbers are DraftKings points per minute from the play-by-play, without double-double bonuses. Rows with fewer than 10 minutes on either side are marked small sample.';
    wyTeam();
  }).catch(function(){ $('r4p-wysub').textContent = 'These splits are not posted yet. Please check back soon.'; });
  $('r4p-wyteam').addEventListener('change', wyTeam);
  $('r4p-gdate').addEventListener('change', function(){ GSEL = null; gList(); });
  $('r4p-gteam').addEventListener('change', function(){ GSEL = null; gList(); });
  $('r4p-obuild').addEventListener('click', optBuild);
  $('r4p-oslate').addEventListener('change', function(){ OSLATE = this.value; OLOCK = {}; OEXCL = {}; OLINES = []; optLines(); optPool(); oMsg(''); });
  $('r4p-plate').addEventListener('click', function(){ PLATE = !PLATE; projGames(); proj(); });
  $('r4p-oss').addEventListener('click', optStars);
  $('r4p-oclear').addEventListener('click', function(){ OLOCK = {}; OEXCL = {}; optPool(); oMsg('Cleared all locks and players taken out.'); });
  $('r4p-ocsv').addEventListener('click', optCsv);
  $('r4p-oq').addEventListener('input', optPool);
  ['r4p-sq','r4p-steam','r4p-spos'].forEach(function(id){ $(id).addEventListener(id === 'r4p-sq' ? 'input' : 'change', research); });
  fetchFirst(GLSOURCES, false).then(function(d){ GL = d || {}; proj(); research(); optPool(); }).catch(function(){});
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
    logInit();
    try { starsRender(); } catch (e) {}
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
