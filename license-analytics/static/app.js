/* 運転免許証データ分析アプリ フロントエンド */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('ja-JP'));
  const pct = (n, d = 1) => (n == null ? '—' : Number(n).toFixed(d) + '%');
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const SERIES = () => ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'].map(css);
  const COLOR_OF = () => ({ 'ゴールド': css('--gold'), 'ブルー': css('--blue'), 'グリーン': css('--green') });

  let META = null;
  const state = { view: 'dash', filters: {}, mapMetric: 'count', mapData: null, projMap: null, projGroup: 'age_band',
                  page: 1, perPage: 50, sort: 'id', desc: false, adminQ: '', adminStatus: '' };
  const charts = {};

  // ---------------------------------------------------------------- utils
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
  function qs(extra = {}) {
    const p = new URLSearchParams();
    const f = { ...state.filters, ...extra };
    for (const [k, v] of Object.entries(f)) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      if (Array.isArray(v)) v.forEach((x) => p.append(k, x)); else p.append(k, v);
    }
    return p.toString();
  }
  async function api(path, opts) {
    const r = await fetch(path, opts);
    if (!r.ok) { let m = r.statusText; try { m = (await r.json()).detail || m; } catch {} throw new Error(m); }
    return r.status === 204 ? null : r.json();
  }
  function chart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    const ctx = $('#' + id).getContext('2d');
    Chart.defaults.color = css('--text-2'); Chart.defaults.borderColor = css('--line'); Chart.defaults.font.family = css('--font');
    charts[id] = new Chart(ctx, cfg);
    return charts[id];
  }
  const baseOpts = (extra = {}) => ({ responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip: { mode: 'index', intersect: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { color: css('--line') }, border: { display: false }, ticks: { callback: (v) => fmt(v) } } }, ...extra });

  // ---------------------------------------------------------------- filters
  function readFilters() {
    const prefs = $$('#f-pref option:checked').map((o) => +o.value);
    state.filters = {
      region: $('#f-region').value || null,
      prefecture: prefs,
      age_min: $('#f-agemin').value || null, age_max: $('#f-agemax').value || null,
      license_type: $('#f-type').value ? [$('#f-type').value] : [],
      color: $('#f-color').value ? [$('#f-color').value] : [],
      sex: null,
    };
    renderChips();
  }
  function renderChips() {
    const f = state.filters; const chips = [];
    if (f.region) chips.push(['地方: ' + f.region, () => { $('#f-region').value = ''; }]);
    (f.prefecture || []).forEach((c) => chips.push([META.prefectures.find((p) => p.code === c).name, () => { $(`#f-pref option[value="${c}"]`).selected = false; }]));
    if (f.age_min || f.age_max) chips.push([`年齢 ${f.age_min || 16}〜${f.age_max || ''}`, () => { $('#f-agemin').value = ''; $('#f-agemax').value = ''; }]);
    if (f.license_type?.length) chips.push(['種類: ' + f.license_type[0], () => { $('#f-type').value = ''; }]);
    if (f.color?.length) chips.push(['色: ' + f.color[0], () => { $('#f-color').value = ''; }]);
    $('#f-chips').innerHTML = chips.length ? '' : '<span class="note">絞り込みなし（全国）</span>';
    chips.forEach(([label, undo]) => { const el = document.createElement('span'); el.className = 'chip'; el.textContent = label + ' ×'; el.onclick = () => { undo(); apply(); }; $('#f-chips').appendChild(el); });
    $('#ai-area').value = areaLabel();
  }
  function areaLabel() {
    const f = state.filters;
    if (f.prefecture?.length) return f.prefecture.map((c) => META.prefectures.find((p) => p.code === c).name).join('・');
    return f.region || '全国';
  }
  let applyTimer;
  function apply() { clearTimeout(applyTimer); readFilters(); refreshView(true); }
  function applySoon() { clearTimeout(applyTimer); applyTimer = setTimeout(apply, 350); }

  // ---------------------------------------------------------------- dashboard
  async function loadDash() {
    const [sum, age, type, exp, first, cross] = await Promise.all([
      api('/api/summary?' + qs()), api('/api/breakdown/age_band?' + qs()), api('/api/breakdown/license_type?' + qs()),
      api('/api/breakdown/expiry_year?' + qs()), api('/api/breakdown/first_issue_year?' + qs()), api('/api/crosstab?row=age_band&col=license_type&' + qs()),
    ]);
    const scale = META.scale;
    $('#kpis').innerHTML = [
      ['保有者数（サンプル）', fmt(sum.total), `拡大推計 約${fmt(Math.round(sum.total * scale / 10000))}万人`],
      ['平均年齢', sum.avg_age + '歳', `女性比率 ${pct(sum.female_share)}`],
      ['65歳以上比率', pct(sum.aged65_share), `${fmt(sum.aged65)}人`],
      ['75歳以上比率', pct(sum.aged75_share), `${fmt(sum.aged75)}人（返納・検査対象）`],
      ['ゴールド免許比率', pct(sum.gold_share), `${fmt(sum.gold)}人`],
      ['有効 / 失効・返納', fmt(sum.active), `失効・返納 ${fmt(sum.total - sum.active)}`],
    ].map(([l, v, s]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    $('#pill-count').textContent = `${fmt(sum.total)} 件 / ${areaLabel()}`;

    const S = SERIES();
    chart('c-age', { type: 'bar', data: { labels: age.rows.map((r) => r.key), datasets: [{ label: '保有者数', data: age.rows.map((r) => r.count), backgroundColor: S[0], borderRadius: 4, maxBarThickness: 28 }] },
      options: baseOpts({ plugins: { legend: { display: false } } }) });
    const tsorted = [...type.rows].sort((a, b) => b.count - a.count);
    chart('c-type', { type: 'bar', data: { labels: tsorted.map((r) => r.key), datasets: [{ label: '保有者数', data: tsorted.map((r) => r.count), backgroundColor: S[2], borderRadius: 4, maxBarThickness: 22 }] },
      options: baseOpts({ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: css('--line') }, ticks: { callback: (v) => fmt(v) } }, y: { grid: { display: false } } } }) });

    // color × age (stacked)
    const ca = await api('/api/crosstab?row=age_band&col=color&' + qs());
    const bands = META.age_bands; const CO = COLOR_OF();
    chart('c-color', { type: 'bar', data: { labels: bands, datasets: ['グリーン', 'ブルー', 'ゴールド'].map((c) => ({ label: c, backgroundColor: CO[c], borderRadius: 2, borderSkipped: false, borderWidth: { top: 1 }, borderColor: css('--surface'),
      data: bands.map((b) => (ca.rows.find((r) => r.r === b && r.c === c) || {}).n || 0) })) },
      options: baseOpts({ scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: css('--line') }, ticks: { callback: (v) => fmt(v) } } } }) });

    const expRows = exp.rows.filter((r) => r.key >= new Date().getFullYear() - 1 && r.key <= new Date().getFullYear() + 6);
    chart('c-expiry', { type: 'bar', data: { labels: expRows.map((r) => r.key + '年'), datasets: [{ label: '期限到来件数', data: expRows.map((r) => r.count), backgroundColor: S[1], borderRadius: 4, maxBarThickness: 36 }] }, options: baseOpts({ plugins: { legend: { display: false } } }) });
    const fr = first.rows.filter((r) => r.key >= 1955);
    chart('c-first', { type: 'line', data: { labels: fr.map((r) => r.key), datasets: [{ label: '初回取得者数', data: fr.map((r) => r.count), borderColor: S[6], backgroundColor: S[6] + '33', fill: true, pointRadius: 0, borderWidth: 2, tension: .3 }] },
      options: baseOpts({ plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { grid: { color: css('--line') }, ticks: { callback: (v) => fmt(v) } } } }) });

    // heatmap
    const types = META.license_types.filter((t) => cross.rows.some((r) => r.c === t));
    const max = Math.max(1, ...cross.rows.map((r) => r.n));
    const heat = $('#heat'); heat.style.gridTemplateColumns = `auto repeat(${types.length}, 1fr)`;
    let html = '<div></div>' + types.map((t) => `<div class="h">${t}</div>`).join('');
    bands.forEach((b) => { html += `<div class="rh">${b}</div>` + types.map((t) => { const n = (cross.rows.find((r) => r.r === b && r.c === t) || {}).n || 0; const a = Math.sqrt(n / max);
      return `<div class="cell" style="background:${hexA(S[0], 0.08 + a * 0.85)};color:${a > .55 ? '#fff' : 'inherit'}" title="${b} × ${t}: ${fmt(n)}">${n ? fmt(n) : ''}</div>`; }).join(''); });
    heat.innerHTML = html;
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  // ---------------------------------------------------------------- map
  let map, geoLayer, geoFeatures;
  let labelLayer;
  async function initMap() {
    // 外部タイルや API キーに依存しない内蔵地図: 海の背景 + 都道府県ポリゴン + 名称ラベル。
    // オンライン時のみ背景タイルを薄く重ね、取得できなければ自動で外す。
    map = L.map('map', { zoomSnap: .25, attributionControl: true, minZoom: 4, maxZoom: 9 }).setView([37.5, 137.2], 5);
    map.attributionControl.setPrefix('境界データ: dataofjapan/land');
    // 背景タイル: 国土地理院 淡色地図（API キー不要）。取得できない環境では自動で外し、内蔵描画のみで表示する。
    const tiles = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', { attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>', opacity: .6, minNativeZoom: 5, maxNativeZoom: 18 });
    let failed = 0; tiles.on('tileerror', () => { if (++failed >= 4 && map.hasLayer(tiles)) map.removeLayer(tiles); }); tiles.addTo(map);
    const topo = await (await fetch('/static/japan.topojson')).json();
    geoFeatures = topojson.feature(topo, topo.objects.japan);
    geoLayer = L.geoJSON(geoFeatures, { style: () => ({ color: css('--map-border'), weight: 1, fillColor: '#ccc', fillOpacity: .9 }),
      onEachFeature: (f, l) => {
        l.on('click', () => { const code = f.properties.id; const opt = $(`#f-pref option[value="${code}"]`); opt.selected = !opt.selected; apply(); });
        l.bindTooltip(() => tooltipHtml(f.properties.id), { className: 'pref-tip', sticky: true });
        l.on('mouseover', () => l.setStyle({ weight: 2, color: css('--text') })); l.on('mouseout', () => geoLayer.resetStyle(l));
      } }).addTo(map);
    // 都道府県名ラベル（ズーム 6 以上で表示、選択中は常に表示）
    labelLayer = L.layerGroup().addTo(map);
    geoLayer.eachLayer((l) => { const p = META.prefectures.find((x) => x.code === l.feature.properties.id); if (!p) return; const c = l.getBounds().getCenter();
      const m = L.marker(c, { interactive: false, icon: L.divIcon({ className: 'pref-label', html: `<span>${p.name.replace(/[都道府県]$/, '')}</span>`, iconSize: null }) }); m.prefCode = p.code; labelLayer.addLayer(m); });
    map.on('zoomend', updateLabels); updateLabels();
  }
  function updateLabels() {
    if (!labelLayer) return; const z = map.getZoom(); const sel = new Set(state.filters.prefecture || []);
    labelLayer.eachLayer((m) => { const el = m.getElement(); if (!el) return; el.style.display = z >= 6 || sel.has(m.prefCode) ? '' : 'none'; el.classList.toggle('sel', sel.has(m.prefCode)); });
  }
  function tooltipHtml(code) {
    const d = (state.mapData?.prefectures || []).find((p) => p.code === code); const pr = (state.projMap?.prefectures || []).find((p) => p.code === code);
    const p = META.prefectures.find((x) => x.code === code);
    if (!d) return `<b>${p.name}</b><br>データなし`;
    return `<b>${p.name}</b>（${p.region}）<br>保有者 ${fmt(d.count)} 件 ／ 平均 ${d.avg_age} 歳<br>70歳以上 ${pct(d.aged70_share)} ／ 75歳以上 ${pct(d.aged75_share)}<br>ゴールド ${pct(d.gold_share)} ／ 推定保有率 ${pct(d.holding_rate)}<br>人口推計 2035: ${d.pop_change_2035 > 0 ? '+' : ''}${d.pop_change_2035}%` +
      (pr ? `<br><b>10年後推計</b> 保有者 ${pr.change_pct > 0 ? '+' : ''}${pr.change_pct}%、75歳以上 ${pct(pr.aged75_share_future)}` : '');
  }
  const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
  const DIV = ['#b8322f', '#d9736c', '#f0b8b3', '#e8e8e6', '#a9c9ee', '#5f96dc', '#1f5faf'];
  async function loadMap() {
    // 地図は都道府県フィルタを無視して全国を塗る（比較のため）。その他の条件は反映。
    const f = { ...state.filters, prefecture: [], region: null };
    const q = new URLSearchParams(); for (const [k, v] of Object.entries(f)) { if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue; Array.isArray(v) ? v.forEach((x) => q.append(k, x)) : q.append(k, v); }
    const [md, pm] = await Promise.all([api('/api/map?' + q), api('/api/projection/map?horizon=10&' + q)]);
    state.mapData = md; state.projMap = pm; paintMap();
  }
  function metricValue(code) {
    const m = state.mapMetric; const d = state.mapData?.prefectures.find((p) => p.code === code); const pr = state.projMap?.prefectures.find((p) => p.code === code);
    if (m === 'proj_change') return pr?.change_pct; if (m === 'proj_aged75') return pr?.aged75_share_future; return d?.[m];
  }
  function paintMap() {
    if (!geoLayer || !state.mapData) return;
    const m = state.mapMetric; const diverging = m === 'pop_change_2035' || m === 'proj_change';
    const vals = geoFeatures.features.map((f) => metricValue(f.properties.id)).filter((v) => v != null);
    const min = Math.min(...vals), max = Math.max(...vals);
    const selected = new Set(state.filters.prefecture || []);
    const colorFor = (v) => { if (v == null) return '#ddd'; if (diverging) { const a = Math.max(Math.abs(min), Math.abs(max)) || 1; const t = (v / a + 1) / 2; return DIV[Math.min(6, Math.floor(t * 7))]; } const t = max > min ? (v - min) / (max - min) : .5; return RAMP[Math.min(6, Math.floor(t * 7))]; };
    geoLayer.setStyle((f) => { const code = f.properties.id; const sel = selected.has(code); return { fillColor: colorFor(metricValue(code)), fillOpacity: selected.size && !sel ? .4 : .92, color: sel ? css('--text') : css('--map-border'), weight: sel ? 2.2 : 1 }; });
    updateLabels();
    const label = $('#map-metric option:checked').textContent;
    const ramp = diverging ? DIV : RAMP; const lo = diverging ? -Math.max(Math.abs(min), Math.abs(max)) : min; const hi = diverging ? -lo : max;
    $('#map-legend').innerHTML = `<span>${label}</span><span>${isFinite(lo) ? lo.toFixed(1) : ''}</span><span class="ramp">${ramp.map((c) => `<span style="background:${c}"></span>`).join('')}</span><span>${isFinite(hi) ? hi.toFixed(1) : ''}</span>` + (selected.size ? `<span class="note">選択中: ${areaLabel()}</span>` : '');
  }

  // ---------------------------------------------------------------- projection
  function scenarioParams() {
    return { scenario: $('#p-scenario').value, horizon: $('#s-horizon').value, return_rate_mult: $('#s-ret').value, acquisition_mult: $('#s-acq').value, population_adjust: $('#s-pop').value, migration_to_urban: $('#s-mig').value };
  }
  function syncSliderLabels() {
    $('#v-horizon').textContent = $('#s-horizon').value + '年'; $('#v-ret').textContent = (+$('#s-ret').value).toFixed(1) + '×'; $('#v-acq').textContent = (+$('#s-acq').value).toFixed(2) + '×';
    $('#v-pop').textContent = Math.round($('#s-pop').value * 100) + '%'; $('#v-mig').textContent = (+$('#s-mig').value * 100).toFixed(1) + '%';
  }
  function applyPreset() {
    const sc = META.scenarios[$('#p-scenario').value]; if (!sc) return;
    $('#s-ret').value = sc.return_rate_mult; $('#s-acq').value = sc.acquisition_mult; $('#s-pop').value = sc.population_adjust; $('#s-mig').value = sc.migration_to_urban;
    $('#p-notes').textContent = sc.notes; syncSliderLabels();
  }
  let projTimer;
  function scheduleProj() { clearTimeout(projTimer); projTimer = setTimeout(loadProj, 250); }
  async function loadProj() {
    syncSliderLabels();
    const p = scenarioParams();
    const [res, cmp] = await Promise.all([api('/api/projection?group_by=' + state.projGroup + '&' + new URLSearchParams(p) + '&' + qs()), api('/api/projection/compare?horizon=' + p.horizon + '&' + qs())]);
    const years = res.years; const S = SERIES(); const CO = COLOR_OF();
    const keyName = res.group_by; const keys = keyName === 'total' ? ['合計'] : [...new Set(res.rows.map((r) => r[keyName]))];
    const order = keyName === 'age_band' ? META.age_bands : keyName === 'license_type' ? META.license_types : keyName === 'color' ? ['グリーン', 'ブルー', 'ゴールド'] : keys;
    const sorted = keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const series = sorted.map((k, i) => ({ label: k, data: years.map((y) => { const r = res.rows.find((x) => x.year === y && (keyName === 'total' || x[keyName] === k)); return r ? r.n : 0; }),
      backgroundColor: keyName === 'color' ? CO[k] : S[i % 8], borderColor: keyName === 'color' ? CO[k] : S[i % 8], fill: keyName !== 'total', pointRadius: 0, borderWidth: 1.5, tension: .25 }));
    $('#p-title').textContent = `${areaLabel()} / ${res.scenario.name} / ${years[0]}→${years[years.length - 1]}`;
    chart('c-proj', { type: 'line', data: { labels: years, datasets: series }, options: baseOpts({ scales: { x: { grid: { display: false } }, y: { stacked: keyName !== 'total', grid: { color: css('--line') }, ticks: { callback: (v) => fmt(v) } } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: { mode: 'index', intersect: false, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(Math.round(c.parsed.y))}` } } } }) });

    // age structure first vs last
    const ageRes = keyName === 'age_band' ? res : await api('/api/projection?group_by=age_band&' + new URLSearchParams(p) + '&' + qs());
    const y0 = years[0], y1 = years[years.length - 1];
    const bandVal = (y, b) => (ageRes.rows.find((r) => r.year === y && r.age_band === b) || {}).n || 0;
    chart('c-proj-age', { type: 'bar', data: { labels: META.age_bands, datasets: [{ label: `${y0}年`, data: META.age_bands.map((b) => bandVal(y0, b)), backgroundColor: hexA(S[0], .45), borderRadius: 3 }, { label: `${y1}年（推計）`, data: META.age_bands.map((b) => bandVal(y1, b)), backgroundColor: S[0], borderRadius: 3 }] }, options: baseOpts() });

    chart('c-cmp', { type: 'line', data: { labels: cmp.scenarios[0].series.map((s) => s.year), datasets: cmp.scenarios.map((s, i) => ({ label: s.name, data: s.series.map((x) => x.total), borderColor: S[i], backgroundColor: S[i], pointRadius: 0, borderWidth: 2, tension: .25 })) }, options: baseOpts() });
    chart('c-cmp75', { type: 'line', data: { labels: cmp.scenarios[0].series.map((s) => s.year), datasets: cmp.scenarios.map((s, i) => ({ label: s.name, data: s.series.map((x) => x.aged75_share), borderColor: S[i], backgroundColor: S[i], pointRadius: 0, borderWidth: 2, tension: .25 })) },
      options: baseOpts({ scales: { x: { grid: { display: false } }, y: { grid: { color: css('--line') }, ticks: { callback: (v) => v + '%' } } } }) });

    // table
    const tot = years.map((y) => series.reduce((a, s) => a + s.data[years.indexOf(y)], 0));
    let html = `<thead><tr><th>年</th>${sorted.map((k) => `<th class="num">${k}</th>`).join('')}<th class="num">合計</th><th class="num">基準年比</th></tr></thead><tbody>`;
    years.forEach((y, i) => { html += `<tr><td>${y}</td>${series.map((s) => `<td class="num">${fmt(Math.round(s.data[i]))}</td>`).join('')}<td class="num"><b>${fmt(Math.round(tot[i]))}</b></td><td class="num">${(100 * (tot[i] / tot[0] - 1)).toFixed(1)}%</td></tr>`; });
    $('#t-proj').innerHTML = html + '</tbody>';
  }

  // ---------------------------------------------------------------- AI
  const PRESET_Q = [
    'この地域では10年後、免許保有者の年齢構成がどう変化するか。その変化が自動車関連事業にどのような影響を与えるか？',
    '免許返納が進んだ場合、この地域で新たに生まれる移動ニーズと事業機会は何か？',
    '若年層の免許取得が減る中で、教習所・新車販売はどの顧客層に注力すべきか？',
    'ゴールド免許保有者の推移から、自動車保険商品の設計をどう変えるべきか？',
    '整備・車検需要は今後10年でどう推移し、拠点配置をどう見直すべきか？',
  ];
  async function runAI() {
    const btn = $('#ai-run'); btn.disabled = true; btn.innerHTML = '<span class="loading"></span> 分析中…';
    $('#ai-out').innerHTML = '<div class="card"><span class="loading"></span> 集計・推計を実行し、生成AIが分析しています（数十秒かかることがあります）</div>';
    try {
      const f = state.filters;
      const body = { question: $('#ai-question').value, prefecture: f.prefecture?.length ? f.prefecture : null, region: f.region || null, horizon: +$('#ai-horizon').value,
                     age_min: f.age_min ? +f.age_min : null, age_max: f.age_max ? +f.age_max : null, license_type: f.license_type?.length ? f.license_type : null, color: f.color?.length ? f.color : null };
      const r = await api('/api/ai/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      renderAI(r);
    } catch (e) { $('#ai-out').innerHTML = `<div class="card" style="color:var(--bad)">分析に失敗しました: ${e.message}</div>`; }
    btn.disabled = false; btn.textContent = '分析する';
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function renderAI(r) {
    const prio = { '高': 'bad', '中': 'warn', '低': 'ok' };
    $('#ai-out').innerHTML = `
      <div class="card ai-result">
        <div class="chips" style="margin-bottom:8px"><span class="pill ${r.engine === 'rule-based' ? '' : 'on'}">${r.engine === 'rule-based' ? '簡易分析（ルールベース）' : 'GPT: ' + esc(r.engine)}</span>
          <span class="pill">${esc(r.context_preview.area)} / ${r.context_preview.horizon}年先 / サンプル ${fmt(r.context_preview.current_total)} 件 × ${r.context_preview.scale_factor}</span>${r.notice ? `<span class="note">${esc(r.notice)}</span>` : ''}</div>
        <h2 class="headline">${esc(r.headline)}</h2><p>${esc(r.summary)}</p>
        <table class="data"><thead><tr><th>指標</th><th class="num">現在</th><th class="num">将来</th><th>コメント</th></tr></thead><tbody>
          ${(r.key_figures || []).map((k) => `<tr><td>${esc(k.label)}</td><td class="num">${esc(k.now)}</td><td class="num">${esc(k.future)}</td><td style="white-space:normal">${esc(k.comment)}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="grid three" style="margin-top:14px">
        <div class="card"><h3>保有者数の見通し <span class="sub">シナリオ別（拡大推計）</span></h3><div class="chart-box"><canvas id="ai-c-total"></canvas></div></div>
        <div class="card"><h3>75歳以上比率 <span class="sub">シナリオ別 %</span></h3><div class="chart-box"><canvas id="ai-c-75"></canvas></div></div>
        <div class="card"><h3>年齢構成の変化 <span class="sub">基準シナリオ</span></h3><div class="chart-box"><canvas id="ai-c-age"></canvas></div></div>
      </div>
      <div class="card" style="margin-top:14px"><h3>シナリオ</h3><div class="cards">
        ${(r.scenarios || []).map((s) => `<div class="scn"><h4>${esc(s.name)}<span class="badge blue">${esc(s.probability)}</span></h4><div class="k">前提</div>${esc(s.assumptions)}<div class="k">免許保有者の見通し</div>${esc(s.license_holder_outlook)}<div class="k">事業への影響</div>${esc(s.impact_on_business)}</div>`).join('')}</div></div>
      <div class="card" style="margin-top:14px"><h3>事業機会</h3><div class="table-wrap" style="max-height:none"><table class="data"><thead><tr><th>優先度</th><th>機会</th><th>ターゲット</th><th>根拠</th><th>規模感</th><th>時期</th></tr></thead><tbody>
        ${(r.business_opportunities || []).map((o) => `<tr><td><span class="badge ${prio[o.priority] || 'ok'}">${esc(o.priority)}</span></td><td style="white-space:normal"><b>${esc(o.title)}</b></td><td style="white-space:normal">${esc(o.target)}</td><td style="white-space:normal">${esc(o.rationale)}</td><td style="white-space:normal">${esc(o.market_size_hint)}</td><td style="white-space:normal">${esc(o.timing)}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="grid two" style="margin-top:14px">
        <div class="card"><h3>リスクと対応</h3><dl class="kv">${(r.risks || []).map((x) => `<dt>リスク</dt><dd><b>${esc(x.risk)}</b><br><span class="note">対応: ${esc(x.mitigation)}</span></dd>`).join('')}</dl></div>
        <div class="card"><h3>推奨アクション</h3><ol style="margin:0;padding-left:20px">${(r.recommended_actions || []).map((a) => `<li>${esc(a)}</li>`).join('')}</ol>
          <h3 style="margin-top:12px">データに関する注意</h3><ul class="note" style="margin:0;padding-left:18px">${(r.data_notes || []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>
      </div>`;
    renderAICharts(r.charts);
  }
  function renderAICharts(c) {
    if (!c) return; const S = SERIES();
    chart('ai-c-total', { type: 'line', data: { labels: c.years, datasets: c.scenarios.map((s, i) => ({ label: s.name, data: s.total, borderColor: S[i], backgroundColor: S[i], pointRadius: 0, borderWidth: 2, tension: .25 })) }, options: baseOpts() });
    chart('ai-c-75', { type: 'line', data: { labels: c.years, datasets: c.scenarios.map((s, i) => ({ label: s.name, data: s.aged75_share, borderColor: S[i], backgroundColor: S[i], pointRadius: 0, borderWidth: 2, tension: .25 })) },
      options: baseOpts({ scales: { x: { grid: { display: false } }, y: { grid: { color: css('--line') }, ticks: { callback: (v) => v + '%' } } } }) });
    chart('ai-c-age', { type: 'bar', data: { labels: META.age_bands, datasets: [{ label: `${c.years[0]}年`, data: META.age_bands.map((b) => c.age_now[b] || 0), backgroundColor: hexA(S[0], .45), borderRadius: 3 }, { label: `${c.years[c.years.length - 1]}年（推計）`, data: META.age_bands.map((b) => c.age_future[b] || 0), backgroundColor: S[0], borderRadius: 3 }] }, options: baseOpts() });
  }

  // ---------------------------------------------------------------- admin
  async function loadAdmin() {
    const [q, res] = await Promise.all([api('/api/quality'), api('/api/records?' + qs({ page: state.page, per_page: state.perPage, sort: state.sort, desc: state.desc, q: state.adminQ, status: state.adminStatus }))]);
    $('#q-kpis').innerHTML = [
      ['総レコード数', fmt(q.total), 'DuckDB 格納件数'], ['画像未登録', fmt(q.missing_image), '表示時はサンプル画像を自動生成'], ['OCR 信頼度 < 0.8', fmt(q.low_ocr), '目視確認の候補'],
      ['期限切れ（状態=有効）', fmt(q.expired_active), '状態更新が必要'], ['返納済み', fmt(q.returned), ''], ['番号の重複', fmt(q.duplicate_no), q.duplicate_no ? '要確認' : '重複なし'],
    ].map(([l, v, s]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    $('#a-count').textContent = `${fmt(res.total)} 件`;
    const cols = [['id', 'ID'], ['license_no', '免許証番号'], ['name', '氏名'], ['sex', '性別'], ['age', '年齢'], ['prefecture_code', '都道府県'], ['license_type', '種類'], ['color', '色'], ['expiry_date', '有効期限'], ['status', '状態'], ['image_path', '画像']];
    const badge = (c) => `<span class="badge ${{ 'ゴールド': 'gold', 'ブルー': 'blue', 'グリーン': 'green' }[c]}">${c}</span>`;
    let html = '<thead><tr>' + cols.map(([k, l]) => `<th data-sort="${k}">${l}${state.sort === k ? (state.desc ? ' ▼' : ' ▲') : ''}</th>`).join('') + '</tr></thead><tbody>';
    res.items.forEach((it) => { html += `<tr data-id="${it.id}"><td>${it.id}</td><td>${esc(it.license_no)}</td><td>${esc(it.name)}</td><td>${it.sex}</td><td class="num">${it.age}</td><td>${META.prefectures.find((p) => p.code === it.prefecture_code)?.name || it.prefecture_code}</td><td>${esc(it.license_type)}</td><td>${badge(it.color)}</td><td>${it.expiry_date}</td><td><span class="badge ${it.status === '有効' ? 'ok' : it.status === '返納' ? 'warn' : 'bad'}">${it.status}</span></td><td>${it.image_path ? '📎' : '<span class="note">自動生成</span>'}</td></tr>`; });
    $('#t-rec').innerHTML = html + '</tbody>';
    $$('#t-rec th').forEach((th) => th.onclick = () => { const k = th.dataset.sort; if (state.sort === k) state.desc = !state.desc; else { state.sort = k; state.desc = false; } loadAdmin(); });
    $$('#t-rec tbody tr').forEach((tr) => tr.onclick = () => openRecord(+tr.dataset.id));
    const pages = Math.max(1, Math.ceil(res.total / state.perPage));
    $('#a-page').textContent = `${state.page} / ${fmt(pages)} ページ`; $('#a-prev').disabled = state.page <= 1; $('#a-next').disabled = state.page >= pages;
  }
  function field(label, name, value, type = 'text', opts) {
    if (opts) return `<div class="field"><label>${label}</label><select name="${name}">${opts.map((o) => `<option ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
    return `<div class="field ${name === 'address' || name === 'license_types' ? 'wide' : ''}"><label>${label}</label><input type="${type}" name="${name}" value="${esc(value ?? '')}" ${type === 'number' ? 'step="any"' : ''}></div>`;
  }
  function recordForm(r) {
    const prefNames = META.prefectures.map((p) => p.name);
    return `<form class="form" id="rec-form">
      ${field('免許証番号', 'license_no', r.license_no)}${field('状態', 'status', r.status || '有効', 'text', ['有効', '失効', '返納'])}
      ${field('氏名', 'name', r.name)}${field('フリガナ', 'name_kana', r.name_kana)}
      ${field('性別', 'sex', r.sex || '男性', 'text', META.sexes)}${field('生年月日', 'birth_date', r.birth_date, 'date')}
      ${field('都道府県', 'prefecture_name', META.prefectures.find((p) => p.code === r.prefecture_code)?.name || '東京都', 'text', prefNames)}${field('市区町村', 'municipality', r.municipality)}
      ${field('住所', 'address', r.address)}
      ${field('免許種類（最上位）', 'license_type', r.license_type || '普通', 'text', META.license_types)}${field('色', 'color', r.color || 'ブルー', 'text', META.colors)}
      ${field('保有免許（カンマ区切り）', 'license_types', r.license_types)}
      ${field('条件等', 'conditions', r.conditions ?? '', 'text', META.conditions)}${field('初回取得年', 'first_issue_year', r.first_issue_year, 'number')}
      ${field('交付日', 'issue_date', r.issue_date, 'date')}${field('有効期限', 'expiry_date', r.expiry_date, 'date')}
      ${field('違反点数', 'violation_points', r.violation_points ?? 0, 'number')}${field('OCR信頼度', 'ocr_confidence', r.ocr_confidence, 'number')}
    </form>`;
  }
  function formData() {
    const d = {}; new FormData($('#rec-form')).forEach((v, k) => { d[k] = v === '' ? null : v; });
    d.prefecture_code = META.prefectures.find((p) => p.name === d.prefecture_name).code; delete d.prefecture_name;
    ['first_issue_year', 'violation_points'].forEach((k) => { if (d[k] != null) d[k] = parseInt(d[k], 10); });
    if (d.ocr_confidence != null) d.ocr_confidence = parseFloat(d.ocr_confidence);
    if (d.conditions == null) d.conditions = '';
    return d;
  }
  async function openRecord(id) {
    const r = await api('/api/records/' + id);
    $('#modal-body').innerHTML = `<h3>レコード #${r.id} <span class="note">更新 ${esc(String(r.updated_at).slice(0, 19))}</span><button class="btn sm close" id="m-close">閉じる</button></h3>
      <div class="rec"><div><img id="rec-img" src="/api/records/${r.id}/image?t=${Date.now()}" alt="免許証画像">
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center"><label class="btn sm">画像をアップロード<input type="file" id="m-upload" accept="image/*" hidden></label><span class="note">${r.image_path ? '保存済: ' + esc(r.image_path) : '画像未登録（サンプル画像を表示中）'}</span></div></div>
      <div>${recordForm(r)}<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end"><button class="btn danger" id="m-del">削除</button><button class="btn primary" id="m-save">保存</button></div></div></div>`;
    $('#modal').classList.add('open');
    $('#m-close').onclick = closeModal;
    $('#m-save').onclick = async () => { try { await api('/api/records/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(formData()) }); toast('保存しました'); closeModal(); loadAdmin(); } catch (e) { toast('保存に失敗: ' + e.message); } };
    $('#m-del').onclick = async () => { if (!confirm(`レコード #${id} を削除しますか？`)) return; await api('/api/records/' + id, { method: 'DELETE' }); toast('削除しました'); closeModal(); loadAdmin(); };
    $('#m-upload').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); try { await api(`/api/records/${id}/image`, { method: 'POST', body: fd }); $('#rec-img').src = `/api/records/${id}/image?t=${Date.now()}`; toast('画像を登録しました'); } catch (err) { toast('画像登録に失敗: ' + err.message); } };
  }
  function openNew() {
    const today = new Date().toISOString().slice(0, 10);
    $('#modal-body').innerHTML = `<h3>新規登録<button class="btn sm close" id="m-close">閉じる</button></h3>${recordForm({ status: '有効', issue_date: today, violation_points: 0 })}<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end"><button class="btn primary" id="m-save">登録</button></div>`;
    $('#modal').classList.add('open'); $('#m-close').onclick = closeModal;
    $('#m-save').onclick = async () => { try { const r = await api('/api/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(formData()) }); toast(`#${r.id} を登録しました`); closeModal(); loadAdmin(); } catch (e) { toast('登録に失敗: ' + e.message); } };
  }
  function closeModal() { $('#modal').classList.remove('open'); }

  // ---------------------------------------------------------------- views
  async function refreshView(all = false) {
    try {
      if (all || state.view === 'dash') { if (state.view === 'dash' || all) await loadDash(); if (map) await loadMap(); }
      if (state.view === 'proj') await loadProj();
      if (state.view === 'admin') { state.page = 1; await loadAdmin(); }
    } catch (e) { toast('読み込みエラー: ' + e.message); console.error(e); }
  }
  function showView(v) {
    state.view = v; $$('nav.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === v)); $$('section.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
    if (v === 'dash' && map) setTimeout(() => map.invalidateSize(), 50);
    refreshView();
  }

  // ---------------------------------------------------------------- init
  async function init() {
    META = await api('/api/meta');
    META.regions.forEach((r) => $('#f-region').append(new Option(r, r)));
    META.prefectures.forEach((p) => $('#f-pref').append(new Option(p.name, p.code)));
    META.license_types.forEach((t) => $('#f-type').append(new Option(t, t)));
    META.colors.forEach((c) => $('#f-color').append(new Option(c, c)));
    Object.entries(META.scenarios).forEach(([k, s]) => $('#p-scenario').append(new Option(s.name, k)));
    $('#pill-ai').textContent = META.ai_enabled ? `AI: ${META.ai_model}` : 'AI: 簡易モード（APIキー未設定）'; $('#pill-ai').classList.toggle('on', META.ai_enabled);
    $('#ai-engine').textContent = META.ai_enabled ? `生成AI: ${META.ai_model}` : 'ANTHROPIC_API_KEY 未設定のためルールベースの簡易分析で応答します';
    PRESET_Q.forEach((q) => { const c = document.createElement('span'); c.className = 'chip'; c.textContent = q.slice(0, 28) + '…'; c.title = q; c.onclick = () => { $('#ai-question').value = q; }; $('#ai-presets').appendChild(c); });
    $('#f-pref').size = 1; $('#f-pref').addEventListener('focus', () => { $('#f-pref').size = 8; $('#f-pref').style.position = 'absolute'; $('#f-pref').style.zIndex = 60; $('#f-pref').style.minWidth = '180px'; });
    $('#f-pref').addEventListener('blur', () => { $('#f-pref').size = 1; $('#f-pref').style.position = ''; });
    // 条件は変更と同時に反映（数値入力は少し待ってから）
    ['#f-region', '#f-type', '#f-color'].forEach((s) => $(s).onchange = apply);
    $('#f-pref').onchange = apply;
    ['#f-agemin', '#f-agemax'].forEach((s) => { $(s).oninput = applySoon; $(s).onchange = apply; });
    $('#f-clear').onclick = () => { $$('#filterbar select, #filterbar input').forEach((el) => { if (el.multiple) $$('option', el).forEach((o) => o.selected = false); else el.value = ''; }); apply(); };
    $$('nav.tabs button').forEach((b) => b.onclick = () => showView(b.dataset.view));
    $('#map-metric').onchange = (e) => { state.mapMetric = e.target.value; paintMap(); };
    $('#p-scenario').onchange = () => { applyPreset(); loadProj(); };
    $$('#p-group button').forEach((b) => b.onclick = () => { $$('#p-group button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); state.projGroup = b.dataset.g; loadProj(); });
    ['#s-horizon', '#s-ret', '#s-acq', '#s-pop', '#s-mig'].forEach((s) => $(s).oninput = () => { syncSliderLabels(); scheduleProj(); });
    $('#ai-run').onclick = runAI;
    $('#a-search').onclick = () => { state.adminQ = $('#a-q').value; state.adminStatus = $('#a-status').value; state.page = 1; loadAdmin(); };
    $('#a-q').onkeydown = (e) => { if (e.key === 'Enter') $('#a-search').click(); };
    $('#a-prev').onclick = () => { state.page--; loadAdmin(); }; $('#a-next').onclick = () => { state.page++; loadAdmin(); };
    $('#a-new').onclick = openNew;
    $('#a-export').onclick = () => { window.location = '/api/export.csv?' + qs({ q: state.adminQ, status: state.adminStatus, limit: 100000 }); };
    $('#a-import').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); try { const r = await api('/api/import', { method: 'POST', body: fd }); toast(`${r.imported} 件を取り込みました（エラー ${r.error_count} 件）`); loadAdmin(); } catch (err) { toast('取込に失敗: ' + err.message); } e.target.value = ''; };
    $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
    $('#theme-toggle').onclick = () => { const cur = document.documentElement.dataset.theme; const next = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; try { localStorage.setItem('theme', next); } catch {} refreshView(true); };
    try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
    applyPreset(); readFilters();
    await initMap();
    await refreshView(true);
  }
  init().catch((e) => { console.error(e); toast('初期化に失敗しました: ' + e.message); });
})();
