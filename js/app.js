/* JAX OPR Voidsun campaign tracker – vanilla JS, data from data/*.json */
(function () {
  const page = document.body.dataset.page;
  const app = document.getElementById('app');
  document.querySelectorAll('nav a').forEach(a => { if (a.dataset.page === page) a.classList.add('active'); });
  const get = p => fetch(p, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.headers.get('content-type')?.includes('json') || p.endsWith('.json') ? r.json() : r.text(); });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (Math.round(n * 100) / 100).toString();
  const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  Promise.all([get('data/players.json'), get('data/results.json'), get('data/missions.json'), get('data/logs/index.json')])
    .then(([players, results, missions, logs]) => {
      const P = Object.fromEntries(players.map(p => [p.id, p]));
      const R = Object.fromEntries(results.missions.map(m => [m.mission, m]));
      document.getElementById('updated').textContent = results.generated ? fmtDate(results.generated) : '—';
      const ctx = { players, P, results, R, missions, logs };
      ({ standings, missions: missionsPage, factions, log: logPage })[page](ctx);
      if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) { if (el.tagName === 'DETAILS') el.open = true; el.scrollIntoView(); } }
    })
    .catch(e => { app.innerHTML = `<div class="card note">Could not load campaign data (${esc(e.message)}). If you opened the file directly, serve the folder instead: <code>python3 -m http.server</code>.</div>`; });

  function computeStandings({ players, results }) {
    const s = Object.fromEntries(players.map(p => [p.id, { p, vp: 0, games: 0, per: {} }]));
    results.missions.forEach(m => m.results.forEach(r => { const x = s[r.player]; if (!x) return; x.vp += r.vp; x.games += 1; x.per[m.mission] = r.vp; }));
    return Object.values(s).filter(x => x.games > 0).map(x => ({ ...x, ratio: x.vp / x.games }))
      .sort((a, b) => b.ratio - a.ratio || b.vp - a.vp || b.games - a.games);
  }

  function standings(ctx) {
    const rows = computeStandings(ctx);
    let rank = 0, prev = null;
    const body = rows.map((x, i) => { if (x.ratio !== prev) { rank = i + 1; prev = x.ratio; }
      return `<tr class="${rank === 1 ? 'top1' : ''}"><td><span class="rank">${rank}</span></td><td><a href="factions.html#${x.p.id}">${esc(x.p.loreName)}</a><span class="sub">${esc(x.p.commander)} · ${esc(x.p.army)}</span></td><td class="num">${fmt(x.vp)}</td><td class="num">${x.games}</td><td class="num"><strong>${fmt(x.ratio)}</strong></td></tr>`; }).join('');
    const ms = ctx.results.missions;
    const matrix = rows.map(x => `<tr><td>${esc(x.p.loreName)}</td>${ms.map(m => `<td class="num">${m.mission in x.per ? fmt(x.per[m.mission]) : '<span class="dash">–</span>'}</td>`).join('')}<td class="num"><strong>${fmt(x.vp)}</strong></td></tr>`).join('');
    const mname = n => ctx.missions.find(m => m.mission === n);
    app.innerHTML = `<h1>Standings</h1><p class="muted">Ranked by victory points per game played (total VP ÷ games).</p>
      <div class="card table-scroll"><table><thead><tr><th>#</th><th>Faction</th><th class="num">Total VP</th><th class="num">Games</th><th class="num">VP / Game</th></tr></thead><tbody>${body}</tbody></table></div>
      <p class="note">Early-campaign caution: several factions have only played one game, so a single result swings their VP/game a lot. Rankings will settle as more missions are played.</p>
      <h2>VP by mission</h2>
      <div class="card table-scroll"><table><thead><tr><th>Faction</th>${ms.map(m => `<th class="num"><a href="missions.html#mission-${m.mission}">M${m.mission}</a><span class="sub">${esc(mname(m.mission)?.voidsunName || '')}</span></th>`).join('')}<th class="num">Total</th></tr></thead><tbody>${matrix}</tbody></table></div>
      <p class="muted small">VP are scored per each mission's own rules, so VP totals are not directly comparable between missions. “–” = did not play.</p>`;
  }

  function list(arr) { return `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; }

  function missionsPage(ctx) {
    const cards = ctx.missions.slice().sort((a, b) => a.mission - b.mission).map(m => {
      const r = ctx.R[m.mission];
      const res = r ? `<table><thead><tr><th>Faction</th><th class="num">VP</th></tr></thead><tbody>${r.results.map(x => `<tr><td>${esc(ctx.P[x.player]?.loreName || x.player)}</td><td class="num">${fmt(x.vp)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No result recorded yet.</p>';
      const rules = m.rules ? `
        <details><summary>Objectives & set-up</summary><div><p><em>${esc(m.rules.background)}</em></p>${list(m.rules.setup)}${list(m.rules.objectives)}</div></details>
        <details><summary>VP scoring</summary><div>${list(m.rules.scoring)}</div></details>
        <details><summary>Special rules</summary><div><dl class="rules">${m.rules.special.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></div></details>`
        : `<p class="note">${esc(m.rulesNote || 'Rules not yet added.')}</p>`;
      const nlogs = ctx.logs.logs.filter(l => l.mission === m.mission).length;
      return `<section class="card" id="mission-${m.mission}">
        <span class="tag hot">JAX OPR Mission ${m.mission}</span><span class="tag">Voidsun Mission ${m.voidsunMission}</span><span class="tag">${fmtDate(m.date)}</span>
        <h2>${m.voidsunName ? esc(m.voidsunName)+' — ' : ''}${esc(m.title)}</h2>
        <p class="muted small">${r ? r.results.length : 0} factions fought</p>
        ${m.gameNote ? `<p class="note">${esc(m.gameNote)}</p>` : ''}<div class="table-scroll">${res}</div>
        <details open><summary>Mission briefing</summary><div class="story">${m.briefing.map(p => `<p>${esc(p)}</p>`).join('')}</div></details>
        ${rules}
        <div class="btns">${m.files.packet ? `<a class="primary" href="${esc(m.files.packet)}" download>Download rules + briefing (1 PDF)</a>` : ''}${m.files.briefing ? `<a href="${esc(m.files.briefing)}">Briefing PDF</a>` : ''}${m.files.rules ? `<a href="${esc(m.files.rules)}">Rules PDF</a>` : ''}<a href="log.html#log-mission-${m.mission}">Campaign log (${nlogs})</a></div>
      </section>`; }).join('');
    app.innerHTML = `<h1>Missions</h1><p class="muted">Campaign orders and briefings. Mission numbers are JAX OPR campaign order; the Voidsun number is the source mission.</p>
      <p class="toc">${ctx.missions.map(m => `<a href="#mission-${m.mission}">M${m.mission}: ${esc(m.voidsunName)}</a>`).join('')}</p>${cards}`;
  }

  function factions(ctx) {
    const st = Object.fromEntries(computeStandings(ctx).map(x => [x.p.id, x]));
    app.innerHTML = `<h1>Factions</h1><p class="muted">The warbands contesting the Voidcrown.</p><div class="grid">${ctx.players.map(p => { const s = st[p.id];
      const nl = ctx.logs.logs.filter(l => l.faction === p.id).length;
      return `<section class="card" id="${p.id}"><h3>${esc(p.loreName)}</h3>
        <p><span class="muted small">Commander</span><br>${esc(p.commander || '—')}</p>${p.otherCharacters && p.otherCharacters.length ? `<p><span class="muted small">Also commanding</span><br>${p.otherCharacters.map(esc).join(', ')}</p>` : ''}
        <p><span class="muted small">Army</span><br>${esc(p.army)}</p>
        <p class="small muted">${s ? `${fmt(s.vp)} VP · ${s.games} game${s.games === 1 ? '' : 's'} · ${fmt(s.ratio)} VP/game` : 'No games yet'}${nl ? ` · <a href="log.html#log-faction-${p.id}">${nl} log${nl === 1 ? '' : 's'}</a>` : ''}</p></section>`; }).join('')}</div>`;
  }

  function logPage(ctx) {
    const { logs, pending } = ctx.logs;
    const secs = ctx.missions.slice().sort((a, b) => a.mission - b.mission).map(m => {
      const ls = logs.filter(l => l.mission === m.mission), pd = (pending || []).filter(l => l.mission === m.mission);
      if (!ls.length && !pd.length) return '';
      return `<section id="log-mission-${m.mission}"><h2>Mission ${m.mission}: ${esc(m.voidsunName)} <span class="muted small">· ${fmtDate(m.date)}</span></h2>
        ${ls.map(l => `<article class="card" id="${l.id}"><span class="tag">${esc(ctx.P[l.faction]?.loreName || '')}</span><h3>${esc(l.title)}</h3><p class="muted small">${esc(l.subtitle || '')} · by ${esc(l.author)}</p>
          <div class="log-body" data-src="${esc(l.body)}"><p class="muted">Loading…</p></div><p class="small"><a href="${esc(l.original)}">Original file</a></p></article>`).join('')}
        ${pd.map(l => `<article class="card pending"><span class="tag">${esc(ctx.P[l.faction]?.loreName || '')}</span><h3>Pending — ${esc(l.author)}</h3><p class="muted">${esc(l.note)}</p></article>`).join('')}</section>`; }).join('');
    const fl = ctx.players.filter(p => logs.some(l => l.faction === p.id)).map(p => `<a id="log-faction-${p.id}" href="#${logs.find(l => l.faction === p.id).id}">${esc(p.commander)}</a>`).join(' ');
    app.innerHTML = `<h1>Campaign Log</h1><p class="muted">After-action reports written by the commanders, in mission order.</p><p class="toc small">Jump to: ${ctx.missions.map(m => `<a href="#log-mission-${m.mission}">M${m.mission}</a>`).join('')} · Authors: ${fl}</p>${secs}`;
    document.querySelectorAll('.log-body').forEach(el => get(el.dataset.src).then(h => { el.innerHTML = h; }).catch(() => { el.innerHTML = '<p class="muted">Could not load this log.</p>'; }));
  }
})();
