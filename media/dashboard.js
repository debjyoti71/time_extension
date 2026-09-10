(function () {
  const vscode = acquireVsCodeApi();
  let data = __data || {};

  const feedbackBtn = document.getElementById('feedbackBtn');
  const feedbackBadge = document.getElementById('feedbackBadge');

  function updateFeedbackBadge() {
    if (feedbackBadge) {
      if (data.showFeedbackBadge) {
        feedbackBadge.classList.remove('hidden');
      } else {
        feedbackBadge.classList.add('hidden');
      }
    }
  }

  const GRID = '#1e1e22';
  const TICK = '#888888';
  const C = ['#61afef','#98c379','#e5c07b','#e06c75','#c678dd','#56b6c2','#d19a66','#abb2bf'];
  const STACK = ['#e06c75','#98c379','#c678dd','#e5c07b','#56b6c2','#61afef','#d19a66','#abb2bf'];
  const LANG_COLORS = {
    'Python':'#3572A5','TypeScript':'#2b7489','JavaScript':'#f1e05a',
    'HTML':'#e34c26','CSS':'#563d7c','JSON':'#40bf77','Java':'#b07219',
    'C++':'#f34b7d','C':'#555555','C#':'#178600','Go':'#00ADD8',
    'Rust':'#dea584','Ruby':'#701516','PHP':'#4F5D95','Shell':'#89e051',
    'SQL':'#e38c00','Markdown':'#083fa1'
  };

  function fmt(secs) {
    if (secs === null || secs === undefined || isNaN(secs) || secs <= 0) { return '--'; }
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
    return h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
  }
  function fmtDiff(secs) { return secs > 0 ? fmt(secs) : '0m'; }
  function hrs(secs) { if (!secs || isNaN(secs)) { return 0; } return +(secs / 3600).toFixed(1); }
  function fmtHours(hVal) {
    if (hVal === null || hVal === undefined || isNaN(hVal) || hVal <= 0) { return '0m'; }
    const totalSecs = Math.round(hVal * 3600);
    const h = Math.floor(totalSecs / 3600), m = Math.floor((totalSecs % 3600) / 60);
    return h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
  }

  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string' || hex[0] !== '#') {
      return 'rgba(97, 175, 239, ' + alpha + ')';
    }
    var r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length >= 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  const scaleOpts = function(unit) {
    return {
      x: { ticks: { color: TICK, maxRotation: 30 }, grid: { color: GRID } },
      y: { ticks: { color: TICK, callback: function(v) { return v + unit; } }, grid: { color: GRID } }
    };
  };

  const charts = {};
  function makeChart(id, config, plugins) {
    if (charts[id]) { charts[id].destroy(); }
    const el = document.getElementById(id);
    if (!el) { return; }
    if (plugins && plugins.length) {
      config.plugins = (config.plugins || []).concat(plugins);
    }
    charts[id] = new Chart(el, config);
  }

  // Bklit Ghost Column Track Canvas Plugin
  const bklitBarGhostPlugin = {
    id: 'bklitBarGhost',
    beforeDatasetsDraw: function(chart) {
      let barMeta = null;
      for (let i = 0; i < chart.data.datasets.length; i++) {
        const m = chart.getDatasetMeta(i);
        if (m && m.type === 'bar' && m.data && m.data.length) {
          barMeta = m;
          break;
        }
      }
      if (!barMeta || !barMeta.data || !barMeta.data.length) { return; }
      const ctx = chart.ctx;
      const top = chart.chartArea.top;
      const bottom = chart.chartArea.bottom;
      const height = bottom - top;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      barMeta.data.forEach(function(bar) {
        if (!bar || bar.x === undefined) { return; }
        const x = bar.x;
        const width = Math.min(bar.width || 24, 38);
        const r = 5;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(x - width / 2, top, width, height, r);
          ctx.fill();
        } else {
          ctx.fillRect(x - width / 2, top, width, height);
        }
      });
      ctx.restore();
    }
  };

  // Bklit Horizontal Ghost Track Canvas Plugin
  const bklitHorizontalBarGhostPlugin = {
    id: 'bklitHorizontalBarGhost',
    beforeDatasetsDraw: function(chart) {
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) { return; }
      const ctx = chart.ctx;
      const xLeft = chart.chartArea.left;
      const xRight = chart.chartArea.right;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      meta.data.forEach(function(bar) {
        const y = bar.y;
        const height = Math.min(bar.height || 26, 32);
        const r = 5;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(xLeft, y - height / 2, xRight - xLeft, height, r);
          ctx.fill();
        } else {
          ctx.fillRect(xLeft, y - height / 2, xRight - xLeft, height);
        }
      });
      ctx.restore();
    }
  };

  function setDelta(pillId, current, prev, label, subId) {
    const pillEl = document.getElementById(pillId);
    const subEl = document.getElementById(subId);
    if (!pillEl) { return; }
    if (!prev && !current) {
      pillEl.textContent = '0.0%';
      pillEl.className = 'kpi-badge kpi-delta-pill delta-neutral';
      if (subEl) { subEl.textContent = 'no previous data'; }
      return;
    }
    if (!prev) {
      pillEl.textContent = '▲ 100%';
      pillEl.className = 'kpi-badge kpi-delta-pill delta-up';
      if (subEl) { subEl.textContent = `vs ${label} (0m · +${fmt(current)})`; }
      return;
    }
    const diff = current - prev;
    const pct = (diff / prev) * 100;
    const arrow = diff >= 0 ? '▲' : '▼';
    const sign = diff >= 0 ? '+' : '-';
    const pctStr = Math.abs(pct).toFixed(1);
    const diffStr = fmtDiff(Math.abs(diff));

    // Compact pill badge in header
    pillEl.textContent = `${arrow} ${pctStr}%`;
    pillEl.className = 'kpi-badge kpi-delta-pill ' + (diff >= 0 ? 'delta-up' : 'delta-down');

    // Clean detailed comparative context in the subline
    if (subEl) {
      subEl.textContent = `vs ${label} (${fmt(prev)} · ${sign}${diffStr})`;
    }
  }

  function updateDevBar() {
    var repo = document.getElementById('devRepo');
    var file = document.getElementById('devFile');
    var session = document.getElementById('devSession');
    if (repo) { repo.textContent = data.currentProject || '(none — no workspace folder)'; }
    if (file) { file.textContent = data.currentFile || '(no active file)'; }
    if (session) { session.textContent = fmt(data.todayTotal); }
  }

  function updateCards() {
    if (!data) { return; }
    const todayEl = document.getElementById('todayTotal');
    const weekEl = document.getElementById('weekTotal');
    const monthEl = document.getElementById('monthTotal');
    const lifetimeEl = document.getElementById('lifetimeTotal');
    const avgEl = document.getElementById('avgPerDay');
    const streakEl = document.getElementById('streakDays');
    const streakSubEl = document.getElementById('streakSub');
    const streakBadgeEl = document.getElementById('streakBadge');
    const updatedEl = document.getElementById('lastUpdated');

    if (todayEl) { todayEl.textContent = fmt(data.todayTotal); }
    if (weekEl) { weekEl.textContent = fmt(data.weekTotal); }
    if (monthEl) { monthEl.textContent = fmt(data.monthTotal); }
    if (lifetimeEl) { lifetimeEl.textContent = fmt(data.lifetimeSecs); }
    if (avgEl) { avgEl.textContent = fmt(data.avgPerDay); }

    const streak = data.streak || { current: 0, best: 0, totalActive: data.activeDays || 0 };
    if (streakEl) {
      streakEl.textContent = streak.current + (streak.current === 1 ? ' day' : ' days');
    }
    if (streakSubEl) {
      streakSubEl.textContent = 'Best: ' + (streak.best || 0) + 'd · ' + (data.activeDays || 0) + ' active days';
    }
    if (streakBadgeEl) {
      streakBadgeEl.textContent = streak.current > 0 ? (streak.current + 'd streak') : 'Inactive';
      streakBadgeEl.className = 'kpi-badge ' + (streak.current > 0 ? 'accent-orange-badge' : 'accent-muted-badge');
    }
    if (updatedEl) {
      updatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
    }

    setDelta('todayDelta', data.todayTotal, data.yesterdayTotal, 'yesterday', 'todaySub');
    setDelta('weekDelta', data.weekTotal, data.prevWeekTotal, 'last week', 'weekSub');
    setDelta('monthDelta', data.monthTotal, data.prevMonthTotal, 'last month', 'monthSub');

    // Update pacing bars
    const todayBar = document.getElementById('todayBar');
    const weekBar = document.getElementById('weekBar');
    const monthBar = document.getElementById('monthBar');
    const avgBar = document.getElementById('avgBar');
    const streakBar = document.getElementById('streakBar');

    if (todayBar) {
      const todayGoal = 8 * 3600;
      todayBar.style.width = Math.min(100, Math.round(((data.todayTotal || 0) / todayGoal) * 100)) + '%';
    }
    if (weekBar) {
      const weekGoal = 40 * 3600;
      weekBar.style.width = Math.min(100, Math.round(((data.weekTotal || 0) / weekGoal) * 100)) + '%';
    }
    if (monthBar) {
      const monthGoal = 160 * 3600;
      monthBar.style.width = Math.min(100, Math.round(((data.monthTotal || 0) / monthGoal) * 100)) + '%';
    }
    if (avgBar) {
      const avgGoal = 8 * 3600;
      avgBar.style.width = Math.min(100, Math.round(((data.avgPerDay || 0) / avgGoal) * 100)) + '%';
    }
    if (streakBar) {
      const best = Math.max(streak.best || 1, streak.current || 1, 1);
      streakBar.style.width = Math.min(100, Math.round(((streak.current || 0) / best) * 100)) + '%';
    }

    updateDevBar();
  }

  function drawBubbles() {
    const container = document.getElementById('bubbleContainer');
    if (!container) { return; }
    const langMap = data.langMap || {};

    // aggregate language totals across all projects
    const langTotals = {};
    for (const proj in langMap) {
      for (const lang in langMap[proj]) {
        langTotals[lang] = (langTotals[lang] || 0) + langMap[proj][lang];
      }
    }
    const entries = Object.entries(langTotals).sort(function(a,b){return b[1]-a[1];}).slice(0,30);
    if (!entries.length) {
      container.innerHTML = '<div class="empty-bubbles-msg" style="color:var(--text-muted);text-align:center;padding:40px 0;">No language data collected yet</div>';
      return;
    }
    const maxVal = entries[0][1];

    const W = container.offsetWidth || 860;
    const H = 560;
    const cx = W / 2, cy = H / 2;

    // assign radius
    const nodes = entries.map(function(e) {
      return {
        lang: e[0],
        val: e[1],
        r: Math.max(28, Math.min(80, 22 + Math.sqrt(e[1] / maxVal) * 65)),
        x: cx + (Math.random() - 0.5) * 200,
        y: cy + (Math.random() - 0.5) * 200,
        vx: 0, vy: 0
      };
    });

    // force simulation — attract to center, repel overlapping circles
    for (var iter = 0; iter < 300; iter++) {
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        // attract to center
        n.vx += (cx - n.x) * 0.012;
        n.vy += (cy - n.y) * 0.012;
        // repel from other nodes
        for (var j = i + 1; j < nodes.length; j++) {
          var m = nodes[j];
          var dx = m.x - n.x, dy = m.y - n.y;
          var dist = Math.sqrt(dx*dx + dy*dy) || 0.01;
          var minDist = n.r + m.r + 4;
          if (dist < minDist) {
            var force = (minDist - dist) / dist * 0.5;
            n.vx -= dx * force; n.vy -= dy * force;
            m.vx += dx * force; m.vy += dy * force;
          }
        }
        // damping
        n.vx *= 0.8; n.vy *= 0.8;
        n.x += n.vx; n.y += n.vy;
        // boundary
        n.x = Math.max(n.r+4, Math.min(W-n.r-4, n.x));
        n.y = Math.max(n.r+4, Math.min(H-n.r-4, n.y));
      }
    }

    var svgParts = [];
    nodes.forEach(function(n) {
      var color = LANG_COLORS[n.lang] || '#555';
      var textColor = '#e6f1ff';
      var label = n.lang.length > 10 ? n.lang.slice(0,9)+'...' : n.lang;
      svgParts.push(
        '<circle cx="'+n.x+'" cy="'+n.y+'" r="'+n.r+'" fill="#2a2a32" stroke="'+color+'" stroke-width="2"/>',
        '<text x="'+n.x+'" y="'+(n.y - 4)+'" text-anchor="middle" fill="'+textColor+'" font-size="'+Math.max(9, Math.min(13, n.r/3.5))+'" font-weight="600">'+label+'</text>',
        '<text x="'+n.x+'" y="'+(n.y + 11)+'" text-anchor="middle" fill="'+textColor+'" font-size="'+Math.max(8, Math.min(11, n.r/4))+'">'+n.val+' files</text>'
      );
    });

    container.innerHTML = '<svg width="100%" height="'+H+'" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">'+svgParts.join('')+'</svg>';
  }

  let groupMode = true;

  function drawLeaderboard(top5, lifetimeSecs, allRows) {
    const el = document.getElementById('topProjectsLeaderboard');
    if (!el) { return; }
    if (!top5 || !top5.length) {
      el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:30px 0;font-size:12px;">No projects recorded yet</div>';
      return;
    }
    const totalSecs = lifetimeSecs || (allRows || top5).reduce(function(s, r) { return s + (r.totalSecs || 0); }, 0) || 1;

    let html = '';
    let top5TotalSecs = 0;
    const distSegments = [];

    top5.forEach(function(r, idx) {
      const rank = idx + 1;
      const secs = r.totalSecs || 0;
      top5TotalSecs += secs;
      const sharePctVal = totalSecs > 0 ? ((secs / totalSecs) * 100) : 0;
      const sharePctStr = sharePctVal.toFixed(1);
      // Bar width directly matches its actual percentage of lifetime time
      const barPct = Math.max(2, Math.min(100, sharePctVal));
      const color = r.color || C[idx % C.length];

      distSegments.push({ width: sharePctVal, color: color, name: r.name });

      html += '<div class="leaderboard-row">'
        + '<div class="leaderboard-rank">#' + rank + '</div>'
        + '<div class="leaderboard-name-wrap">'
        + '<span class="leaderboard-dot" style="background:' + color + ';"></span>'
        + '<span class="leaderboard-name" title="' + r.name + '">' + r.name + '</span>'
        + '</div>'
        + '<div class="leaderboard-bar-track">'
        + '<div class="leaderboard-bar-fill" style="width:' + barPct.toFixed(1) + '%; background:' + color + ';"></div>'
        + '</div>'
        + '<div class="leaderboard-stats">'
        + '<span class="leaderboard-hours">' + fmt(secs) + '</span>'
        + '<span class="leaderboard-pct">' + sharePctStr + '%</span>'
        + '</div>'
        + '</div>';
    });

    const top5PctVal = Math.min(100, totalSecs > 0 ? ((top5TotalSecs / totalSecs) * 100) : 0);
    const top5PctStr = top5PctVal.toFixed(1);
    const othersSecs = Math.max(0, totalSecs - top5TotalSecs);
    const othersPctVal = Math.max(0, 100 - top5PctVal);
    const othersPctStr = othersPctVal.toFixed(1);
    const totalProjectsCount = (allRows && allRows.length) ? allRows.length : top5.length;
    const othersCount = Math.max(0, totalProjectsCount - top5.length);

    if (othersPctVal > 0.05) {
      distSegments.push({ width: othersPctVal, color: '#5c6370', name: 'Others' });
    }

    // Bottom aggregate distribution track & summary
    html += '<div class="leaderboard-footer">'
      + '<div class="lead-dist-track" title="Top 5: ' + top5PctStr + '% · Others: ' + othersPctStr + '%">'
      + distSegments.map(function(seg) {
          return '<div class="lead-dist-seg" style="width:' + seg.width.toFixed(1) + '%; background:' + seg.color + ';" title="' + seg.name + ': ' + seg.width.toFixed(1) + '%"></div>';
        }).join('')
      + '</div>'
      + '<div class="lead-footer-meta">'
      + '<span class="lead-footer-label">Top 5 account for <strong>' + top5PctStr + '%</strong> (' + fmt(top5TotalSecs) + ')</span>'
      + (othersCount > 0 ? '<span class="lead-footer-others">' + othersCount + ' other project' + (othersCount > 1 ? 's' : '') + ': ' + fmt(othersSecs) + ' (' + othersPctStr + '%)</span>' : '')
      + '</div>'
      + '</div>';

    el.innerHTML = html;
  }

  function drawPieChart(effectiveDirTotals, effectiveFolderRows, lifetimeSecs) {
    const allSortedEntries = Object.entries(effectiveDirTotals || {}).sort(function(a, b) { return b[1] - a[1]; });
    const top5Entries = allSortedEntries.slice(0, 5);
    const otherEntries = allSortedEntries.slice(5);
    const othersTotalSecs = otherEntries.reduce(function(sum, x) { return sum + x[1]; }, 0);

    let pieItems = top5Entries.map(function(x, i) {
      var matchRow = (effectiveFolderRows || []).find(function(fr) { return fr.name === x[0]; });
      var color = (matchRow && matchRow.color) || C[i % C.length];
      return { name: x[0], secs: x[1], color: color };
    });
    if (othersTotalSecs > 0) {
      pieItems.push({ name: 'Others (' + otherEntries.length + ')', secs: othersTotalSecs, color: '#5c6370' });
    }

    var pieColors = pieItems.map(function(x) { return x.color; });

    if (charts['pieChart']) {
      charts['pieChart'].pieItems = pieItems;
      charts['pieChart'].data.labels = pieItems.map(function(x) { return x.name; });
      charts['pieChart'].data.datasets[0].data = pieItems.map(function(x) { return hrs(x.secs); });
      charts['pieChart'].data.datasets[0].backgroundColor = pieColors;
      charts['pieChart'].data.datasets[0].hoverBackgroundColor = pieColors;
      charts['pieChart'].update('none');
    } else {
      makeChart('pieChart', {
        type: 'doughnut',
        data: {
          labels: pieItems.map(function(x) { return x.name; }),
          datasets: [{
            data: pieItems.map(function(x) { return hrs(x.secs); }),
            backgroundColor: pieColors,
            hoverBackgroundColor: pieColors,
            borderWidth: 2,
            borderColor: '#0e0e10',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          cutout: '62%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          onHover: function(evt, elements) {
            var canvas = document.getElementById('pieChart');
            if (canvas) { canvas.style.cursor = elements.length ? 'pointer' : 'default'; }
            var legendItems = document.querySelectorAll('.pie-legend-item');
            legendItems.forEach(function(el, i) {
              el.style.opacity = (!elements.length || elements[0].index === i) ? '1' : '0.35';
            });
            var centerLabel = document.getElementById('pieCenterLabel');
            var centerValue = document.getElementById('pieCenterValue');
            var activeItems = (charts['pieChart'] && charts['pieChart'].pieItems) || pieItems;
            if (elements.length && activeItems[elements[0].index]) {
              var idx = elements[0].index;
              if (centerLabel) { centerLabel.textContent = activeItems[idx].name; }
              if (centerValue) { centerValue.textContent = fmt(activeItems[idx].secs); }
            } else {
              if (centerLabel) { centerLabel.textContent = 'Projects'; }
              if (centerValue) { centerValue.textContent = fmt(lifetimeSecs || (data && data.lifetimeSecs)); }
            }
          }
        },
        plugins: []
      });
      if (charts['pieChart']) {
        charts['pieChart'].pieItems = pieItems;
      }
    }

    // Build custom legend
    var pieLegend = document.getElementById('pieLegend');
    if (pieLegend) {
      pieLegend.innerHTML = pieItems.map(function(x, i) {
        return '<div class="pie-legend-item" data-idx="' + i + '" style="display:flex;align-items:center;gap:10px;padding:6px 6px;border-radius:6px;cursor:pointer;transition:all 0.15s;">'
          + '<span style="width:10px;height:10px;border-radius:50%;background:' + x.color + ';flex-shrink:0;"></span>'
          + '<span style="font-size:12px;font-weight:500;color:var(--text-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;" title="' + x.name + '">' + x.name + '</span>'
          + '<span style="font-size:12px;font-weight:600;color:' + x.color + ';margin-left:auto;padding-left:8px;font-variant-numeric:tabular-nums;">' + fmt(x.secs) + '</span>'
          + '</div>';
      }).join('');

      pieLegend.querySelectorAll('.pie-legend-item').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
          var idx = +el.dataset.idx;
          var chart = charts['pieChart'];
          if (!chart) { return; }
          var activeItems = chart.pieItems || pieItems;
          chart.setDatasetVisibility(0, true);
          var meta = chart.getDatasetMeta(0);
          meta.data.forEach(function(arc, i) {
            arc.options.backgroundColor = i === idx ? (activeItems[i] ? activeItems[i].color : C[i]) : (activeItems[i] ? activeItems[i].color + '44' : C[i] + '44');
          });
          chart.update('none');
          pieLegend.querySelectorAll('.pie-legend-item').forEach(function(l, i) {
            l.style.opacity = i === idx ? '1' : '0.35';
          });
          var centerLabel = document.getElementById('pieCenterLabel');
          var centerValue = document.getElementById('pieCenterValue');
          if (centerLabel && activeItems[idx]) { centerLabel.textContent = activeItems[idx].name; }
          if (centerValue && activeItems[idx]) { centerValue.textContent = fmt(activeItems[idx].secs); }
        });
        el.addEventListener('mouseleave', function() {
          var chart = charts['pieChart'];
          if (!chart) { return; }
          var activeItems = chart.pieItems || pieItems;
          var meta = chart.getDatasetMeta(0);
          meta.data.forEach(function(arc, i) {
            arc.options.backgroundColor = activeItems[i] ? activeItems[i].color : C[i];
          });
          chart.update('none');
          pieLegend.querySelectorAll('.pie-legend-item').forEach(function(l) { l.style.opacity = '1'; });
          var centerLabel = document.getElementById('pieCenterLabel');
          var centerValue = document.getElementById('pieCenterValue');
          if (centerLabel) { centerLabel.textContent = 'Projects'; }
          if (centerValue) { centerValue.textContent = fmt(lifetimeSecs || (data && data.lifetimeSecs)); }
        });
      });
    }

    var centerLabel = document.getElementById('pieCenterLabel');
    var centerValue = document.getElementById('pieCenterValue');
    if (centerLabel) { centerLabel.textContent = 'Projects'; }
    if (centerValue) { centerValue.textContent = fmt(lifetimeSecs || (data && data.lifetimeSecs)); }
  }

  function draw30DayHeatmap(l30dates) {
    const grid = document.getElementById('bklitHeatmapGrid');
    const statsEl = document.getElementById('heatmapStats');
    if (!grid) { return; }
    if (!l30dates || !l30dates.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);">No 30-day data recorded yet</div>';
      return;
    }

    const last30 = data.last30 || {};
    let totalSecs = 0;
    let activeDays = 0;

    let html = '';
    l30dates.forEach(function(dateStr) {
      const secs = last30[dateStr] || 0;
      totalSecs += secs;
      if (secs > 0) { activeDays++; }
      const h = hrs(secs);

      let lvl = 0;
      if (secs > 0 && secs < 2 * 3600) { lvl = 1; }
      else if (secs >= 2 * 3600 && secs < 5 * 3600) { lvl = 2; }
      else if (secs >= 5 * 3600 && secs < 8 * 3600) { lvl = 3; }
      else if (secs >= 8 * 3600) { lvl = 4; }

      const dateLabel = dateStr.slice(5); // "MM-DD"
      const timeStr = secs > 0 ? fmt(secs) : '0m';

      html += '<div class="bklit-heat-tile lvl-' + lvl + '" title="' + dateStr + ': ' + timeStr + '">'
        + '<span class="heat-date">' + dateLabel + '</span>'
        + '<div class="heat-intensity-pill"></div>'
        + '<span class="heat-hours">' + (secs > 0 ? fmt(secs) : '·') + '</span>'
        + '</div>';
    });

    grid.innerHTML = html;
    if (statsEl) {
      statsEl.textContent = activeDays + ' of 30 days active (' + fmt(totalSecs) + ' total)';
    }
  }

  // 6. Last 6 Months Momentum - Vertical Bar Chart
  function drawMonthChart() {
    const months = Object.keys(data.last6months || {});
    const monthCanvas = document.getElementById('monthChart');
    if (!monthCanvas || !months.length) { return; }

    const monthSecs = months.map(function(m) { return (data.last6months && data.last6months[m]) || 0; });
    const monthHours = monthSecs.map(function(s) { return hrs(s); });

    const monthLabels = months.map(function(m) {
      const parts = m.split('-');
      return new Date(+parts[0], +parts[1] - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    let barBg = '#61afef';
    const ctx = monthCanvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 220);
      grad.addColorStop(0, '#61afef');
      grad.addColorStop(1, 'rgba(97, 175, 239, 0.22)');
      barBg = grad;
    }

    makeChart('monthChart', {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Monthly Volume',
          data: monthHours,
          backgroundColor: barBg,
          hoverBackgroundColor: '#82c2f5',
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 2, bottomRight: 2 },
          borderSkipped: false,
          maxBarThickness: 38,
          barPercentage: 0.68,
          categoryPercentage: 0.8
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181c',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: function(ctx) {
                if (!ctx || !ctx.length) { return ''; }
                const mKey = months[ctx[0].dataIndex];
                const parts = mKey.split('-');
                return new Date(+parts[0], +parts[1] - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
              },
              label: function(ctx) {
                const idx = ctx.dataIndex;
                const secs = monthSecs[idx];
                return ' Volume: ' + fmt(secs);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: TICK, font: { size: 11, weight: '500' } },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            grace: '10%',
            ticks: {
              color: TICK,
              callback: function(v) { return v + 'h'; }
            },
            grid: { color: GRID, drawTicks: false },
            border: { display: false, dash: [4, 4] }
          }
        }
      }
    });
  }

  let selectedL7Project = 'all';

  function drawL7Section(effectiveFolderRows, effectiveL7stacked, effectiveL7projects) {
    const l7dates = data.last7dates || [];
    const filterContainer = document.getElementById('l7ProjectFilters');

    // Calculate totals for each project across the last 7 days
    const activeProjects = (effectiveL7projects || []).map(function(proj) {
      const matchRow = (effectiveFolderRows || []).find(function(fr) { return fr.name === proj; });
      const color = (matchRow && matchRow.color) || '#61afef';
      const totalSecs = l7dates.reduce(function(sum, d) {
        return sum + (((effectiveL7stacked[proj] || {})[d]) || 0);
      }, 0);
      return { name: proj, color: color, totalSecs: totalSecs };
    }).filter(function(p) { return p.totalSecs > 0; });

    // Sort by focus time in last 7 days descending
    activeProjects.sort(function(a, b) { return b.totalSecs - a.totalSecs; });

    // Take top 4 projects for pill buttons
    const topPills = activeProjects.slice(0, 4);

    // If currently selected project is no longer active, reset to 'all'
    if (selectedL7Project !== 'all' && !activeProjects.some(function(p) { return p.name === selectedL7Project; })) {
      selectedL7Project = 'all';
    }

    if (filterContainer) {
      let pillsHtml = '<button class="bklit-pill' + (selectedL7Project === 'all' ? ' active' : '') + '" data-proj="all">'
        + '<span class="bklit-pill-dot" style="background:#61afef;"></span>'
        + '<span>All</span>'
        + '</button>';

      topPills.forEach(function(p) {
        const isActive = selectedL7Project === p.name;
        pillsHtml += '<button class="bklit-pill' + (isActive ? ' active' : '') + '" data-proj="' + p.name + '" title="' + p.name + ' (' + fmt(p.totalSecs) + ')">'
          + '<span class="bklit-pill-dot" style="background:' + p.color + ';"></span>'
          + '<span>' + p.name + '</span>'
          + '</button>';
      });

      filterContainer.innerHTML = pillsHtml;

      filterContainer.querySelectorAll('.bklit-pill').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const targetProj = btn.getAttribute('data-proj');
          if (selectedL7Project === targetProj) { return; }
          selectedL7Project = targetProj;
          filterContainer.querySelectorAll('.bklit-pill').forEach(function(b) {
            b.classList.toggle('active', b.getAttribute('data-proj') === targetProj);
          });
          renderL7Chart(effectiveFolderRows, effectiveL7stacked, effectiveL7projects);
        });
      });
    }

    renderL7Chart(effectiveFolderRows, effectiveL7stacked, effectiveL7projects);
  }

  function renderL7Chart(effectiveFolderRows, effectiveL7stacked, effectiveL7projects) {
    const l7dates = data.last7dates || [];
    const l7labels = l7dates.map(function(d) {
      const parts = d.split('-');
      const dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      return dt.toLocaleDateString('default', { weekday: 'short' }) + ' ' + (+parts[1]) + '/' + (+parts[2]);
    });

    const canvas = document.getElementById('lineChart');
    if (!canvas) { return; }

    let lineColor = '#61afef';
    let chartValues = [];
    let datasetLabel = 'All Projects';

    if (selectedL7Project === 'all') {
      lineColor = '#61afef';
      datasetLabel = 'All Projects';
      chartValues = l7dates.map(function(d) {
        let daySecs = 0;
        (effectiveL7projects || []).forEach(function(proj) {
          daySecs += ((effectiveL7stacked[proj] || {})[d]) || 0;
        });
        return hrs(daySecs);
      });
    } else {
      const matchRow = (effectiveFolderRows || []).find(function(fr) { return fr.name === selectedL7Project; });
      lineColor = (matchRow && matchRow.color) || '#61afef';
      datasetLabel = selectedL7Project;
      chartValues = l7dates.map(function(d) {
        return hrs(((effectiveL7stacked[selectedL7Project] || {})[d]) || 0);
      });
    }

    const ctx = canvas.getContext('2d');
    let areaGrad = hexToRgba(lineColor, 0.16);
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 220);
      grad.addColorStop(0, hexToRgba(lineColor, 0.4));
      grad.addColorStop(0.65, hexToRgba(lineColor, 0.08));
      grad.addColorStop(1, hexToRgba(lineColor, 0.0));
      areaGrad = grad;
    }

    makeChart('lineChart', {
      type: 'line',
      data: {
        labels: l7labels,
        datasets: [{
          label: datasetLabel,
          data: chartValues,
          borderColor: lineColor,
          borderWidth: 2.5,
          backgroundColor: areaGrad,
          fill: true,
          tension: 0.38,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: lineColor,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: lineColor,
          pointHoverBorderWidth: 2.5
        }]
      },
      plugins: [],
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 8, bottom: 2, left: 2, right: 6 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181c',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: function(ctx) {
                if (!ctx || !ctx.length) { return ''; }
                const rawDate = l7dates[ctx[0].dataIndex];
                if (!rawDate) { return ctx[0].label; }
                const parts = rawDate.split('-');
                const dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
                return dt.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' });
              },
              label: function(ctx) {
                const dateKey = l7dates[ctx.dataIndex];
                if (selectedL7Project === 'all') {
                  let totalSecs = 0;
                  (effectiveL7projects || []).forEach(function(proj) {
                    totalSecs += ((effectiveL7stacked[proj] || {})[dateKey]) || 0;
                  });
                  return ' Total Coding: ' + fmt(totalSecs);
                } else {
                  const secs = ((effectiveL7stacked[selectedL7Project] || {})[dateKey]) || 0;
                  return ' ' + selectedL7Project + ': ' + fmt(secs);
                }
              },
              afterBody: function(ctx) {
                if (!ctx || !ctx.length) { return []; }
                const dateKey = l7dates[ctx[0].dataIndex];
                if (selectedL7Project === 'all') {
                  const dayBreakdown = (effectiveL7projects || [])
                    .map(function(proj) {
                      const secs = ((effectiveL7stacked[proj] || {})[dateKey]) || 0;
                      return { name: proj, secs: secs };
                    })
                    .filter(function(p) { return p.secs > 0; })
                    .sort(function(a, b) { return b.secs - a.secs; });

                  if (dayBreakdown.length > 1) {
                    return dayBreakdown.slice(0, 4).map(function(p) {
                      return '  • ' + p.name + ': ' + fmt(p.secs);
                    });
                  }
                } else {
                  let dayTotalSecs = 0;
                  (effectiveL7projects || []).forEach(function(proj) {
                    dayTotalSecs += ((effectiveL7stacked[proj] || {})[dateKey]) || 0;
                  });
                  const pSecs = ((effectiveL7stacked[selectedL7Project] || {})[dateKey]) || 0;
                  if (dayTotalSecs > 0 && pSecs > 0) {
                    const pct = Math.round((pSecs / dayTotalSecs) * 100);
                    return ['  Day Total: ' + fmt(dayTotalSecs) + ' (' + pct + '% of day)'];
                  }
                }
                return [];
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: TICK, font: { size: 10, weight: '500' }, maxRotation: 0 },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            grace: '14%',
            ticks: {
              color: TICK,
              callback: function(v) { return v + 'h'; }
            },
            grid: { color: GRID, drawTicks: false },
            border: { display: false, dash: [4, 4] }
          }
        }
      }
    });
  }

  function drawCharts() {
    if (!data) { return; }
    const effectiveFolderRows = (groupMode && data.groupedFolderRows) ? data.groupedFolderRows : (data.folderRows || []);
    const effectiveDirTotals = (groupMode && data.groupedDirTotals) ? data.groupedDirTotals : (data.dirTotals || {});
    const effectiveL7stacked = (groupMode && data.groupedLast7stacked) ? data.groupedLast7stacked : (data.last7stacked || {});
    const effectiveL7projects = (groupMode && data.groupedLast7projects) ? data.groupedLast7projects : (data.last7projects || []);
    const effectiveW5 = (groupMode && data.groupedWeekTop5) ? data.groupedWeekTop5 : (data.weekTop5 || []);
    const effectiveTop6projects = (groupMode && data.groupedTop6projects) ? data.groupedTop6projects : (data.top6projects || []);
    const effectiveL30stacked = (groupMode && data.groupedLast30stacked) ? data.groupedLast30stacked : (data.last30stacked || {});

    // 1. Top 5 lifetime horizontal ranked leaderboard
    const top5 = [...effectiveFolderRows].slice(0, 5);
    drawLeaderboard(top5, data.lifetimeSecs, effectiveFolderRows);

    // 2. Donut share (top 5 + others)
    drawPieChart(effectiveDirTotals, effectiveFolderRows, data.lifetimeSecs);

    // 3. Last 7 Days - Bklit Interactive Glowing Area Chart with Project Filter Pills
    drawL7Section(effectiveFolderRows, effectiveL7stacked, effectiveL7projects);

    // 4. Top Projects This Week - Bklit Horizontal Bar Chart
    const activeW5 = (effectiveW5 || []).filter(function(r) { return (r.weekSecs || 0) > 0; }).slice(0, 5);
    const weekItems = activeW5.length ? activeW5 : (effectiveFolderRows || []).slice(0, 5);
    const weekLabels = weekItems.map(function(r) { return r.name; });
    const weekVals = weekItems.map(function(r) { return hrs(r.weekSecs || 0); });
    const weekColors = weekItems.map(function(r, idx) { return r.color || C[idx % C.length]; });
    const totalWeekSecs = data.weekTotal || 1;

    makeChart('weekdayChart', {
      type: 'bar',
      data: {
        labels: weekLabels,
        datasets: [{
          data: weekVals,
          backgroundColor: weekColors,
          hoverBackgroundColor: weekColors,
          borderRadius: { topRight: 6, bottomRight: 6, topLeft: 2, bottomLeft: 2 },
          borderSkipped: false,
          maxBarThickness: 26,
          barPercentage: 0.78,
          categoryPercentage: 0.88
        }]
      },
      plugins: [bklitHorizontalBarGhostPlugin],
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181c',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(ctx) {
                const idx = ctx.dataIndex;
                const r = weekItems[idx];
                const secs = r ? (r.weekSecs || 0) : Math.round(ctx.parsed.x * 3600);
                const pct = totalWeekSecs > 0 ? Math.round((secs / totalWeekSecs) * 100) : 0;
                return ' ' + ctx.label + ': ' + fmt(secs) + ' (' + pct + '% of this week)';
              }
            }
          }
        },
        scales: {
          y: {
            ticks: {
              color: '#e6f1ff',
              font: { size: 11, weight: '500' }
            },
            grid: { display: false },
            border: { display: false }
          },
          x: {
            beginAtZero: true,
            ticks: {
              color: TICK,
              callback: function(v) { return v + 'h'; }
            },
            grid: { color: GRID, drawTicks: false },
            border: { display: false, dash: [4, 4] }
          }
        }
      }
    });

    // 5. Last 30 Days - Daily Activity Volume & 7-Day Momentum Trendline
    const l30dates = Object.keys(data.last30 || {});
    const dailyHours = l30dates.map(function(d) { return hrs(data.last30[d]); });

    // 7-day rolling moving average for momentum
    const movingAvg7d = dailyHours.map(function(_, idx) {
      const window = dailyHours.slice(Math.max(0, idx - 6), idx + 1);
      const sum = window.reduce(function(a, b) { return a + b; }, 0);
      return +(sum / window.length).toFixed(1);
    });

    const l30Canvas = document.getElementById('heatmapChart');
    let l30BarBg = '#56b6c2';
    if (l30Canvas) {
      const ctx = l30Canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 220);
      grad.addColorStop(0, '#56b6c2');
      grad.addColorStop(1, 'rgba(86, 182, 194, 0.16)');
      l30BarBg = grad;
    }

    makeChart('heatmapChart', {
      type: 'bar',
      data: {
        labels: l30dates.map(function(d) { return d.slice(5); }),
        datasets: [
          {
            type: 'line',
            label: '7-Day Momentum Trend',
            data: movingAvg7d,
            borderColor: '#e5c07b',
            borderWidth: 2.2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#e5c07b',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            tension: 0.38,
            fill: false,
            order: 1
          },
          {
            type: 'bar',
            label: 'Daily Active',
            data: dailyHours,
            backgroundColor: l30BarBg,
            hoverBackgroundColor: '#6fe1ed',
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 12,
            order: 2
          }
        ]
      },
      plugins: [],
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 6, bottom: 2, left: 2, right: 6 } },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: '#9ba1b0',
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 6,
              boxHeight: 6,
              padding: 12,
              font: { size: 10, weight: '500' }
            }
          },
          tooltip: {
            backgroundColor: '#18181c',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            callbacks: {
              title: function(ctx) { return l30dates[ctx[0].dataIndex]; },
              beforeBody: function(ctx) {
                const date = l30dates[ctx[0].dataIndex];
                const total = (data.last30 && data.last30[date]) || 0;
                return 'Total: ' + fmt(total);
              },
              label: function(ctx) {
                if (ctx.dataset.type === 'line') {
                  return ' 7-Day Pace: ' + fmtHours(ctx.parsed.y) + '/day';
                }
                return ' Active: ' + fmtHours(ctx.parsed.y);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: TICK,
              maxRotation: 0,
              maxTicksLimit: 10,
              autoSkip: true,
              font: { size: 10 }
            },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            grace: '15%',
            ticks: { color: TICK, callback: function(v) { return v + 'h'; } },
            grid: { color: GRID, drawTicks: false },
            border: { display: false, dash: [4, 4] }
          }
        }
      }
    });

    // 6. Last 6 Months Momentum - Bklit Column Bar / Area Chart
    drawMonthChart();

    // Render Bklit 30-Day Activity Heatmap Matrix
    draw30DayHeatmap(l30dates);

    // 7. Hour of day - percentage of hour used (last 30 days)
    const hourLabels = Array.from({ length: 24 }, function(_, i) {
      if (i === 0)  { return '12am'; }
      if (i === 12) { return '12pm'; }
      return i < 12 ? (i + 'am') : ((i - 12) + 'pm');
    });
    const hourVals = data.hourBuckets || [];
    const maxHour = Math.max.apply(null, hourVals.concat([0]));
    makeChart('hourChart', {
      type: 'line',
      data: {
        labels: hourLabels,
        datasets: [{
          data: hourVals,
          borderColor: '#e5c07b',
          backgroundColor: 'rgba(229,192,123,0.12)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: hourVals.map(function(v) {
            if (!v) { return 'rgba(97,175,239,0.25)'; }
            if (v >= maxHour * 0.7) { return '#e5c07b'; }
            return '#61afef';
          }),
          pointBorderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) { return ' ' + ctx.parsed.y + '% of that hour'; }
            }
          }
        },
        scales: {
          x: { ticks: { color: TICK }, grid: { display: false } },
          y: {
            min: 0,
            max: 100,
            ticks: { color: TICK, callback: function(v) { return v + '%'; } },
            grid: { color: GRID }
          }
        }
      }
    });

    // 8. Language bubbles
    drawBubbles();
  }

  // --- Lucide Vector Icons System ---
  const L_ICONS = {
    folder: '<svg class="icon-lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
    folderPlus: '<svg class="icon-lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" x2="12" y1="11" y2="17"/><line x1="9" x2="15" y1="14" y2="14"/></svg>',
    plus: '<svg class="icon-lucide" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>',
    pencil: '<svg class="icon-lucide" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
    trash: '<svg class="icon-lucide" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
    x: '<svg class="icon-lucide" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    check: '<svg class="icon-lucide" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    sparkles: '<svg class="icon-lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
    emptyKanban: '<svg class="icon-lucide" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" x2="12" y1="11" y2="17"/><line x1="9" x2="15" y1="14" y2="14"/></svg>',
    chevronRight: '<svg class="icon-lucide chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    chevronDown: '<svg class="icon-lucide chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    cornerDownRight: '<svg class="icon-lucide" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>'
  };

  // Table & Grouping State
  let sortCol = 'totalSecs', sortAsc = false, filterText = '', showAll = false;
  let expandedGroups = new Set();
  let selectedFolders = new Set();
  // --- Trends Toggle: 30-Day Volume Bars vs Heatmap Grid ---
  const l30BarsBtn = document.getElementById('l30BarsBtn');
  const l30HeatmapBtn = document.getElementById('l30HeatmapBtn');
  const l30ChartWrap = document.getElementById('l30ChartWrap');
  const l30HeatmapWrap = document.getElementById('l30HeatmapWrap');

  if (l30BarsBtn && l30HeatmapBtn) {
    l30BarsBtn.addEventListener('click', function() {
      l30BarsBtn.classList.add('active');
      l30HeatmapBtn.classList.remove('active');
      if (l30ChartWrap) { l30ChartWrap.classList.remove('hidden'); }
      if (l30HeatmapWrap) { l30HeatmapWrap.classList.add('hidden'); }
    });
    l30HeatmapBtn.addEventListener('click', function() {
      l30HeatmapBtn.classList.add('active');
      l30BarsBtn.classList.remove('active');
      if (l30HeatmapWrap) { l30HeatmapWrap.classList.remove('hidden'); }
      if (l30ChartWrap) { l30ChartWrap.classList.add('hidden'); }
    });
  }

  // --- View Mode & Explorer (Cards vs Table) ---
  let displayMode = 'cards';
  const displayCardsBtn = document.getElementById('displayCardsBtn');
  const displayTableBtn = document.getElementById('displayTableBtn');
  const projectCardsGrid = document.getElementById('projectCardsGrid');
  const projectDataTable = document.getElementById('projectDataTable');

  function setDisplayMode(mode) {
    displayMode = mode;
    if (mode === 'cards') {
      if (displayCardsBtn) displayCardsBtn.classList.add('active');
      if (displayTableBtn) displayTableBtn.classList.remove('active');
      if (projectCardsGrid) projectCardsGrid.classList.remove('hidden');
      if (projectDataTable) projectDataTable.classList.add('hidden');
    } else {
      if (displayTableBtn) displayTableBtn.classList.add('active');
      if (displayCardsBtn) displayCardsBtn.classList.remove('active');
      if (projectDataTable) projectDataTable.classList.remove('hidden');
      if (projectCardsGrid) projectCardsGrid.classList.add('hidden');
    }
  }

  if (displayCardsBtn) {
    displayCardsBtn.addEventListener('click', function() {
      setDisplayMode('cards');
    });
  }
  if (displayTableBtn) {
    displayTableBtn.addEventListener('click', function() {
      setDisplayMode('table');
    });
  }

  function renderProjectCards(rows, limited) {
    const grid = document.getElementById('projectCardsGrid');
    if (!grid) { return; }
    if (!rows.length) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 48px 16px; color: var(--text-muted); font-size: 13px;">No projects found' + (filterText ? ' matching "' + filterText + '"' : '') + '</div>';
      return;
    }

    const totalLifetime = data.lifetimeSecs || rows.reduce(function(s, r) { return s + (r.totalSecs || 0); }, 0) || 1;

    let html = '';
    limited.forEach(function(r) {
      const isGroup = groupMode && r.isGroup;
      const subCount = r.subProjects ? r.subProjects.length : 0;
      const isExpanded = isGroup && expandedGroups.has(r.id);
      const color = r.color || '#61afef';
      const sharePctVal = totalLifetime > 0 ? (((r.totalSecs || 0) / totalLifetime) * 100) : 0;
      const sharePct = sharePctVal.toFixed(1);
      const pct = Math.max(2, Math.min(100, sharePctVal));
      const lastActiveStr = r.lastActive ? new Date(r.lastActive).toLocaleDateString() : '--';

      html += '<div class="project-card' + (isGroup ? ' is-group' : '') + '" style="--group-card-color:' + color + ';">'
        + '<div class="project-card-top">'
        + '  <div class="project-card-title-wrap">'
        + '    <span class="project-card-dot" style="background:' + color + ';"></span>'
        + '    <span class="project-card-title" title="' + r.name + '">' + r.name + '</span>'
        + '  </div>'
        + '  <div class="project-card-meta">'
        + (isGroup ? ('    <span class="project-card-badge">' + subCount + ' folder' + (subCount === 1 ? '' : 's') + '</span>') : '')
        + '    <span class="project-card-time">' + lastActiveStr + '</span>'
        + '  </div>'
        + '</div>'
        + '<div class="project-card-metrics">'
        + '  <div class="project-metric-col"><span class="m-label">Today</span><span class="m-val">' + fmt(r.todaySecs) + '</span></div>'
        + '  <div class="project-metric-col"><span class="m-label">7 Days</span><span class="m-val">' + fmt(r.last7Secs) + '</span></div>'
        + '  <div class="project-metric-col"><span class="m-label">30 Days</span><span class="m-val">' + fmt(r.rolling30Secs) + '</span></div>'
        + '  <div class="project-metric-col"><span class="m-label">Lifetime</span><span class="m-val" style="color:' + color + ';">' + fmt(r.totalSecs) + '</span></div>'
        + '</div>'
        + '<div class="project-card-progress">'
        + '  <div class="project-card-track">'
        + '    <div class="project-card-bar" style="width:' + pct.toFixed(1) + '%; background:' + color + ';"></div>'
        + '  </div>'
        + '  <span class="project-card-pct">' + sharePct + '%</span>'
        + '</div>';

      if (isGroup && r.subProjects && r.subProjects.length > 0) {
        html += '<button class="project-card-expand-btn" data-group-id="' + r.id + '">'
          + (isExpanded ? L_ICONS.chevronDown : L_ICONS.chevronRight)
          + ' <span>' + (isExpanded ? 'Hide' : 'Show') + ' ' + subCount + ' sub-folder' + (subCount === 1 ? '' : 's') + '</span>'
          + '</button>';

        if (isExpanded) {
          html += '<div class="project-card-sublist">';
          r.subProjects.forEach(function(sp) {
            const spPct = r.totalSecs > 0 ? Math.round((sp.totalSecs / r.totalSecs) * 100) : 0;
            html += '<div class="subproject-card-row">'
              + '  <span class="subproject-card-name" title="' + sp.name + '">' + sp.name + '</span>'
              + '  <span class="subproject-card-time">' + fmt(sp.totalSecs) + ' (' + spPct + '%)</span>'
              + '</div>';
          });
          html += '</div>';
        }
      }

      html += '</div>';
    });

    grid.innerHTML = html;

    grid.querySelectorAll('.project-card-expand-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const gid = btn.getAttribute('data-group-id');
        if (expandedGroups.has(gid)) {
          expandedGroups.delete(gid);
        } else {
          expandedGroups.add(gid);
        }
        renderExplorer();
      });
    });
  }

  function renderTable(rows, limited) {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) { return; }
    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No projects found' + (filterText ? ' matching "' + filterText + '"' : '') + '</td></tr>';
      return;
    }

    let html = '';
    limited.forEach(function(r) {
      if (groupMode && r.isGroup) {
        const isExpanded = expandedGroups.has(r.id);
        const subCount = r.subProjects ? r.subProjects.length : 0;
        html += '<tr class="group-row ' + (isExpanded ? 'expanded' : '') + '" data-group-id="' + r.id + '">'
          + '<td><div class="group-name-cell">'
          + '<span class="group-chevron">' + (isExpanded ? L_ICONS.chevronDown : L_ICONS.chevronRight) + '</span>'
          + '<span class="group-color-dot" style="background:' + (r.color || '#61afef') + '; color:' + (r.color || '#61afef') + ';"></span>'
          + '<span title="' + r.name + '">' + r.name + '</span>'
          + '<span class="group-badge">' + subCount + ' folder' + (subCount === 1 ? '' : 's') + '</span>'
          + '</div></td>'
          + '<td>' + fmt(r.todaySecs) + '</td>'
          + '<td>' + fmt(r.last7Secs) + '</td>'
          + '<td>' + fmt(r.rolling30Secs) + '</td>'
          + '<td class="lifetime">' + fmt(r.totalSecs) + '</td>'
          + '<td>' + (r.lastActive ? new Date(r.lastActive).toLocaleDateString() : '--') + '</td>'
          + '</tr>';

        if (isExpanded && r.subProjects) {
          r.subProjects.forEach(function(sp) {
            const pct = r.totalSecs > 0 ? Math.round((sp.totalSecs / r.totalSecs) * 100) : 0;
            html += '<tr class="child-row">'
              + '<td><div class="child-name-cell">'
              + '<span class="child-tree-icon">' + L_ICONS.cornerDownRight + '</span>'
              + '<span title="' + sp.name + '">' + sp.name + '</span>'
              + '<div class="child-percent-bar-wrap">'
              + '<div class="child-percent-bar"><div class="child-percent-fill" style="width:' + pct + '%;"></div></div>'
              + '<span class="child-percent-txt">' + pct + '%</span>'
              + '</div>'
              + '</div></td>'
              + '<td>' + fmt(sp.todaySecs) + '</td>'
              + '<td>' + fmt(sp.last7Secs) + '</td>'
              + '<td>' + fmt(sp.rolling30Secs) + '</td>'
              + '<td class="lifetime">' + fmt(sp.totalSecs) + '</td>'
              + '<td>' + (sp.lastActive ? new Date(sp.lastActive).toLocaleDateString() : '--') + '</td>'
              + '</tr>';
          });
        }
      } else {
        html += '<tr>'
          + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="' + r.name + '">' + r.name + '</td>'
          + '<td>' + fmt(r.todaySecs) + '</td>'
          + '<td>' + fmt(r.last7Secs) + '</td>'
          + '<td>' + fmt(r.rolling30Secs) + '</td>'
          + '<td class="lifetime">' + fmt(r.totalSecs) + '</td>'
          + '<td>' + (r.lastActive ? new Date(r.lastActive).toLocaleDateString() : '--') + '</td>'
          + '</tr>';
      }
    });
    tableBody.innerHTML = html;

    tableBody.querySelectorAll('tr.group-row').forEach(function(tr) {
      tr.addEventListener('click', function() {
        const gid = tr.getAttribute('data-group-id');
        if (expandedGroups.has(gid)) {
          expandedGroups.delete(gid);
        } else {
          expandedGroups.add(gid);
        }
        renderExplorer();
      });
    });
  }

  function renderExplorer() {
    let sourceRows = (groupMode && data.groupedFolderRows) ? data.groupedFolderRows : (data.folderRows || []);
    let rows = [...sourceRows];
    if (filterText) {
      rows = rows.filter(function(r) {
        if (r.name.toLowerCase().includes(filterText)) { return true; }
        if (r.subProjects && r.subProjects.some(function(sp) { return sp.name.toLowerCase().includes(filterText); })) {
          return true;
        }
        return false;
      });
    }
    rows.sort(function(a, b) {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === 'string') { return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av); }
      return sortAsc ? av - bv : bv - av;
    });
    const limited = (!showAll && !filterText) ? rows.slice(0, 10) : rows;
    const toggleBtn = document.getElementById('toggleRows');
    if (toggleBtn) {
      toggleBtn.textContent = showAll ? 'Top 10' : ('Show All (' + rows.length + ')');
    }

    renderProjectCards(rows, limited);
    renderTable(rows, limited);
  }

  // --- Smart Suggestion Banner ---
  function updateSuggestionsBanner() {
    const banner = document.getElementById('smartSuggestionBanner');
    const badge = document.getElementById('suggestionsBadge');
    const suggestions = data.suggestedGroups || [];

    if (badge) {
      if (suggestions.length > 0) {
        badge.textContent = suggestions.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (!banner) { return; }
    if (suggestions.length === 0) {
      banner.classList.add('hidden');
      return;
    }

    const first = suggestions[0];
    const textEl = document.getElementById('suggestionText');
    if (textEl) {
      textEl.textContent = 'Group ' + first.projects.map(function(p) { return '"' + p + '"'; }).join(' & ') + ' as "' + first.name + '"?';
    }
    banner.classList.remove('hidden');

    const acceptBtn = document.getElementById('acceptSuggestionBtn');
    if (acceptBtn) {
      acceptBtn.onclick = function() {
        vscode.postMessage({
          command: 'applySuggestion',
          suggestionId: first.id,
          name: first.name,
          projects: first.projects
        });
      };
    }

    const dismissBtn = document.getElementById('dismissSuggestionBtn');
    if (dismissBtn) {
      dismissBtn.onclick = function() {
        vscode.postMessage({
          command: 'dismissSuggestion',
          suggestionId: first.id
        });
      };
    }
  }

  // --- Manage Groups Modal System ---
  const PRESET_COLORS = ['#6366f1', '#61afef', '#56b6c2', '#98c379', '#e5c07b', '#e06c75', '#c678dd', '#f472b6'];
  let selectedGroupColor = '#61afef';

  const groupsModal = document.getElementById('groupsModal');
  const manageGroupsBtn = document.getElementById('manageGroupsBtn');
  const closeGroupsModalBtn = document.getElementById('closeGroupsModalBtn');
  const tabActiveGroupsBtn = document.getElementById('tabActiveGroupsBtn');
  const tabCreateGroupBtn = document.getElementById('tabCreateGroupBtn');
  const modalQuickNewGroupBtn = document.getElementById('modalQuickNewGroupBtn');
  const viewActiveGroupsTab = document.getElementById('viewActiveGroupsTab');
  const viewCreateGroupTab = document.getElementById('viewCreateGroupTab');
  const activeGroupsCountBadge = document.getElementById('activeGroupsCountBadge');
  const createTabLabel = document.getElementById('createTabLabel');
  const editorModeTitle = document.getElementById('editorModeTitle');
  const newGroupNameInput = document.getElementById('newGroupName');
  const newGroupColorInput = document.getElementById('newGroupColor');
  const colorPresetBar = document.getElementById('colorPresetBar');
  const createGroupBtn = document.getElementById('createGroupBtn');
  const createGroupBtnText = document.getElementById('createGroupBtnText');
  const cancelCreateGroupBtn = document.getElementById('cancelCreateGroupBtn');
  const modalFolderList = document.getElementById('modalFolderList');
  const modalFolderSearch = document.getElementById('modalFolderSearch');
  const selectedFoldersCountEl = document.getElementById('selectedFoldersCount');
  const modalSuggestionsSection = document.getElementById('modalSuggestionsSection');
  const modalSuggestionsList = document.getElementById('modalSuggestionsList');
  const modalExistingGroupsList = document.getElementById('modalExistingGroupsList');

  let currentModalTab = 'activeGroups';
  let editingGroupId = null;
  let groupPendingDelete = null;

  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  const deleteConfirmGroupName = document.getElementById('deleteConfirmGroupName');
  const confirmDeleteGroupBtn = document.getElementById('confirmDeleteGroupBtn');
  const cancelDeleteGroupBtn = document.getElementById('cancelDeleteGroupBtn');

  function initColorPresets() {
    if (!colorPresetBar) { return; }
    // Remove previous swatch elements, keeping custom ring
    colorPresetBar.querySelectorAll('.color-swatch').forEach(function(el) { el.remove(); });
    const customRing = colorPresetBar.querySelector('.custom-color-ring');

    PRESET_COLORS.forEach(function(hex) {
      const sw = document.createElement('div');
      sw.className = 'color-swatch' + (hex.toLowerCase() === selectedGroupColor.toLowerCase() ? ' active' : '');
      sw.style.backgroundColor = hex;
      sw.style.color = hex;
      sw.title = hex;
      sw.addEventListener('click', function() {
        selectedGroupColor = hex;
        if (newGroupColorInput) { newGroupColorInput.value = hex; }
        colorPresetBar.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.remove('active'); });
        sw.classList.add('active');
      });
      if (customRing) {
        colorPresetBar.insertBefore(sw, customRing);
      } else {
        colorPresetBar.appendChild(sw);
      }
    });

    if (newGroupColorInput) {
      newGroupColorInput.addEventListener('input', function(e) {
        selectedGroupColor = e.target.value;
        colorPresetBar.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.remove('active'); });
      });
    }
  }

  function switchModalTab(tabName) {
    currentModalTab = tabName;
    if (tabName === 'activeGroups') {
      editingGroupId = null;
      if (tabActiveGroupsBtn) { tabActiveGroupsBtn.classList.add('active'); }
      if (tabCreateGroupBtn) { tabCreateGroupBtn.classList.remove('active'); }
      if (viewActiveGroupsTab) { viewActiveGroupsTab.classList.remove('hidden'); }
      if (viewCreateGroupTab) { viewCreateGroupTab.classList.add('hidden'); }
      if (createTabLabel) { createTabLabel.textContent = 'Create Group'; }
      renderModalExistingGroups();
    } else {
      if (tabCreateGroupBtn) { tabCreateGroupBtn.classList.add('active'); }
      if (tabActiveGroupsBtn) { tabActiveGroupsBtn.classList.remove('active'); }
      if (viewCreateGroupTab) { viewCreateGroupTab.classList.remove('hidden'); }
      if (viewActiveGroupsTab) { viewActiveGroupsTab.classList.add('hidden'); }

      if (editingGroupId) {
        const groups = (data.groupsData && data.groupsData.groups) || [];
        const g = groups.find(function(x) { return x.id === editingGroupId; });
        if (g) {
          if (editorModeTitle) { editorModeTitle.textContent = 'Edit Group "' + g.name + '"'; }
          if (createGroupBtnText) { createGroupBtnText.textContent = 'Save Changes'; }
          if (createTabLabel) { createTabLabel.textContent = 'Edit Group'; }
          if (newGroupNameInput) { newGroupNameInput.value = g.name; }
          selectedGroupColor = g.color || '#61afef';
          if (newGroupColorInput) { newGroupColorInput.value = selectedGroupColor; }
          selectedFolders = new Set(g.projects || []);
        }
      } else {
        if (editorModeTitle) { editorModeTitle.textContent = 'Create New Group'; }
        if (createGroupBtnText) { createGroupBtnText.textContent = 'Create Group'; }
        if (createTabLabel) { createTabLabel.textContent = 'Create Group'; }
        if (newGroupNameInput) { newGroupNameInput.value = ''; }
        selectedFolders.clear();
      }
      initColorPresets();
      renderModalFolderList();
      updateCreateGroupBtnState();
      if (newGroupNameInput) { newGroupNameInput.focus(); }
    }
  }

  function openManageGroupsModal() {
    if (!groupsModal) { return; }
    const activeTip = document.querySelector('.spotlight-tooltip');
    if (activeTip) { activeTip.remove(); }
    const glowing = document.querySelector('.feature-spotlight-glow');
    if (glowing) { glowing.classList.remove('feature-spotlight-glow'); }
    editingGroupId = null;
    selectedFolders.clear();
    if (modalFolderSearch) { modalFolderSearch.value = ''; modalFolderSearchText = ''; }
    renderModalSuggestions();
    switchModalTab('activeGroups');
    groupsModal.classList.remove('hidden');
  }

  function closeManageGroupsModal() {
    if (!groupsModal) { return; }
    groupsModal.classList.add('hidden');
    editingGroupId = null;
  }

  function updateCreateGroupBtnState() {
    if (!createGroupBtn || !newGroupNameInput) { return; }
    const hasName = newGroupNameInput.value.trim().length > 0;
    const hasFolders = selectedFolders.size > 0;
    createGroupBtn.disabled = !(hasName && hasFolders);
    if (selectedFoldersCountEl) {
      selectedFoldersCountEl.textContent = selectedFolders.size;
    }
  }

  function recomputeGroupedDataLocally() {
    const groups = (data.groupsData && data.groupsData.groups) || [];
    const folderToGroup = new Map();
    for (const g of groups) {
      for (const proj of (g.projects || [])) {
        if (proj) { folderToGroup.set(proj.toLowerCase(), g); }
      }
    }

    const groupRowMap = new Map();
    for (const g of groups) {
      groupRowMap.set(g.id, {
        isGroup: true,
        id: g.id,
        name: g.name,
        color: g.color || '#61afef',
        totalSecs: 0,
        todaySecs: 0,
        weekSecs: 0,
        monthSecs: 0,
        rolling30Secs: 0,
        last7Secs: 0,
        lastActive: 0,
        subProjects: []
      });
    }

    const groupedFolderRows = [];
    for (const r of (data.folderRows || [])) {
      const grp = folderToGroup.get(r.name.toLowerCase());
      if (grp && groupRowMap.has(grp.id)) {
        const gRow = groupRowMap.get(grp.id);
        gRow.totalSecs += r.totalSecs;
        gRow.todaySecs += r.todaySecs;
        gRow.weekSecs += r.weekSecs;
        gRow.monthSecs += r.monthSecs;
        gRow.rolling30Secs += r.rolling30Secs;
        gRow.last7Secs += r.last7Secs;
        gRow.lastActive = Math.max(gRow.lastActive, r.lastActive);
        gRow.subProjects.push(r);
      } else {
        groupedFolderRows.push({
          isGroup: false,
          name: r.name,
          totalSecs: r.totalSecs,
          todaySecs: r.todaySecs,
          weekSecs: r.weekSecs,
          monthSecs: r.monthSecs,
          rolling30Secs: r.rolling30Secs,
          last7Secs: r.last7Secs,
          lastActive: r.lastActive,
          subProjects: []
        });
      }
    }

    for (const gRow of groupRowMap.values()) {
      if (gRow.totalSecs > 0 || gRow.subProjects.length > 0) {
        gRow.subProjects.sort((a, b) => b.totalSecs - a.totalSecs);
        groupedFolderRows.push(gRow);
      }
    }
    groupedFolderRows.sort((a, b) => b.totalSecs - a.totalSecs);
    data.groupedFolderRows = groupedFolderRows;

    // Grouped dirTotals
    const groupedDirTotals = {};
    for (const r of groupedFolderRows) {
      groupedDirTotals[r.name] = r.totalSecs;
    }
    data.groupedDirTotals = groupedDirTotals;

    // Grouped last 7 stacked
    const groupedLast7projects = groupedFolderRows.filter(r => (r.last7Secs || 0) > 0).map(r => r.name);
    const groupedLast7stacked = {};
    for (const proj of groupedLast7projects) { groupedLast7stacked[proj] = {}; }
    for (const [proj, dates] of Object.entries(data.last7stacked || {})) {
      const grp = folderToGroup.get(proj.toLowerCase());
      const effective = grp ? grp.name : proj;
      if (!groupedLast7stacked[effective]) { continue; }
      for (const [d, s] of Object.entries(dates)) {
        groupedLast7stacked[effective][d] = (groupedLast7stacked[effective][d] || 0) + s;
      }
    }
    data.groupedLast7stacked = groupedLast7stacked;
    data.groupedLast7projects = groupedLast7projects;

    // Grouped last 30 stacked
    const topGroupedByRolling30 = groupedFolderRows.filter(r => (r.rolling30Secs || 0) > 0).sort((a, b) => b.rolling30Secs - a.rolling30Secs);
    const primaryGrouped = topGroupedByRolling30.slice(0, 6).map(r => r.name);
    const groupedLast30stacked = {};
    for (const proj of primaryGrouped) { groupedLast30stacked[proj] = {}; }
    groupedLast30stacked['Others'] = {};
    for (const [proj, dates] of Object.entries(data.last30stacked || {})) {
      if (proj === 'Others') { continue; }
      const grp = folderToGroup.get(proj.toLowerCase());
      const effective = grp ? grp.name : proj;
      const bucket = primaryGrouped.includes(effective) ? effective : 'Others';
      for (const [d, s] of Object.entries(dates)) {
        groupedLast30stacked[bucket][d] = (groupedLast30stacked[bucket][d] || 0) + s;
      }
    }
    if (!Object.keys(groupedLast30stacked['Others']).length) { delete groupedLast30stacked['Others']; }
    data.groupedLast30stacked = groupedLast30stacked;
    data.groupedTop6projects = Object.keys(groupedLast30stacked);
    data.groupedWeekTop5 = [...groupedFolderRows].sort((a, b) => b.weekSecs - a.weekSecs).slice(0, 5);
  }

  function renderModalSuggestions() {
    if (!modalSuggestionsSection || !modalSuggestionsList) { return; }
    const suggestions = data.suggestedGroups || [];
    if (suggestions.length === 0) {
      modalSuggestionsSection.classList.add('hidden');
      return;
    }
    modalSuggestionsSection.classList.remove('hidden');
    modalSuggestionsList.innerHTML = suggestions.map(function(sug) {
      return '<div class="suggestion-card">'
        + '<div class="suggestion-card-info">'
        + '<span class="suggestion-card-title">' + sug.name + '</span>'
        + '<span class="suggestion-card-projects">' + sug.projects.join(', ') + '</span>'
        + '</div>'
        + '<div class="suggestion-actions">'
        + '<button class="btn-primary-sm apply-sug-btn" data-sug-id="' + sug.id + '" data-sug-name="' + sug.name + '">' + L_ICONS.sparkles + ' Group</button>'
        + '<button class="btn-ghost-sm dismiss-sug-btn" data-sug-id="' + sug.id + '" title="Dismiss">' + L_ICONS.x + '</button>'
        + '</div>'
        + '</div>';
    }).join('');

    modalSuggestionsList.querySelectorAll('.apply-sug-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const id = btn.dataset.sugId;
        const name = btn.dataset.sugName;
        const sug = (data.suggestedGroups || []).find(function(s) { return s.id === id; });
        if (sug) {
          vscode.postMessage({
            command: 'applySuggestion',
            suggestionId: sug.id,
            name: name,
            projects: sug.projects
          });
        }
      });
    });

    modalSuggestionsList.querySelectorAll('.dismiss-sug-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const id = btn.dataset.sugId;
        vscode.postMessage({
          command: 'dismissSuggestion',
          suggestionId: id
        });
      });
    });
  }

  function renderModalFolderList() {
    if (!modalFolderList) { return; }
    const allProjects = data.allProjectNames || (data.folderRows || []).map(function(r) { return r.name; });
    const groups = (data.groupsData && data.groupsData.groups) || [];
    const assignedMap = {};
    groups.forEach(function(g) {
      // If we are editing this group, its current members are not "assigned to another group"
      if (editingGroupId && g.id === editingGroupId) { return; }
      (g.projects || []).forEach(function(p) { assignedMap[p.toLowerCase()] = g.name; });
    });

    // Time map for folder lifetime hours
    const timeMap = {};
    (data.folderRows || []).forEach(function(r) { timeMap[r.name] = r.totalSecs; });

    let filtered = allProjects;
    if (modalFolderSearchText) {
      filtered = filtered.filter(function(p) { return p.toLowerCase().includes(modalFolderSearchText); });
    }

    if (!filtered.length) {
      modalFolderList.innerHTML = '<div style="grid-column:1/-1;font-size:12px;color:var(--text-muted);text-align:center;padding:24px;">No matching project folders found</div>';
      return;
    }

    modalFolderList.innerHTML = filtered.map(function(proj) {
      const assignedGroup = assignedMap[proj.toLowerCase()];
      const isSelected = selectedFolders.has(proj);
      const isAssigned = !!assignedGroup;
      const totalSecs = timeMap[proj] || 0;
      const timeLabel = fmt(totalSecs);

      return '<div class="folder-card-item ' + (isSelected ? 'selected' : '') + ' ' + (isAssigned ? 'disabled' : '') + '" data-proj="' + proj + '" title="' + proj + (isAssigned ? ' (Already in ' + assignedGroup + ')' : '') + '">'
        + '<div class="custom-checkbox">' + (isSelected ? L_ICONS.check : '') + '</div>'
        + '<div class="folder-card-info">'
        + '<span class="folder-card-name">' + proj + '</span>'
        + '<span class="folder-card-meta">' + (isAssigned ? 'In ' + assignedGroup : timeLabel) + '</span>'
        + '</div>'
        + '</div>';
    }).join('');

    modalFolderList.querySelectorAll('.folder-card-item:not(.disabled)').forEach(function(card) {
      card.addEventListener('click', function() {
        const proj = card.dataset.proj;
        if (selectedFolders.has(proj)) {
          selectedFolders.delete(proj);
          card.classList.remove('selected');
          const cb = card.querySelector('.custom-checkbox');
          if (cb) { cb.innerHTML = ''; }
        } else {
          selectedFolders.add(proj);
          card.classList.add('selected');
          const cb = card.querySelector('.custom-checkbox');
          if (cb) { cb.innerHTML = L_ICONS.check; }
        }
        updateCreateGroupBtnState();
      });
    });
  }

  function renderModalExistingGroups() {
    if (!modalExistingGroupsList) { return; }
    const groupsData = data.groupsData || { groups: [] };
    const groups = groupsData.groups || [];

    if (activeGroupsCountBadge) {
      activeGroupsCountBadge.textContent = groups.length;
    }

    if (!groups.length) {
      modalExistingGroupsList.innerHTML = '<div class="groups-empty-state">'
        + '<div class="empty-state-icon">' + L_ICONS.emptyKanban + '</div>'
        + '<h3 class="empty-state-title">No Project Groups Yet</h3>'
        + '<p class="empty-state-text">Group multi-folder repos, frontend/backend splits, and versioned projects to view unified charts and share cards.</p>'
        + '<button class="btn-primary-sm" id="emptyStateCreateBtn" style="margin-top:6px;">' + L_ICONS.plus + ' Create Your First Group</button>'
        + '</div>';

      const emptyBtn = document.getElementById('emptyStateCreateBtn');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', function() { switchModalTab('createGroup'); });
      }
      return;
    }

    const allProjects = data.allProjectNames || (data.folderRows || []).map(function(r) { return r.name; });
    const assignedSet = new Set();
    groups.forEach(function(g) {
      (g.projects || []).forEach(function(p) { assignedSet.add(p.toLowerCase()); });
    });
    // Map for lifetime project times
    const timeMap = {};
    (data.folderRows || []).forEach(function(r) { timeMap[r.name] = r.totalSecs; });

    modalExistingGroupsList.innerHTML = groups.map(function(g) {
      const color = g.color || '#61afef';
      const count = g.projects ? g.projects.length : 0;
      let totalGroupSecs = 0;
      (g.projects || []).forEach(function(p) { totalGroupSecs += (timeMap[p] || 0); });

      const folderPillsHtml = (g.projects && g.projects.length > 0)
        ? (g.projects.map(function(p) {
            const tSecs = timeMap[p] || 0;
            return '<div class="project-pill-tag">'
              + '<span style="color:' + color + ';">' + L_ICONS.folder + '</span>'
              + '<span class="tag-proj-name">' + p + '</span>'
              + '<span class="tag-proj-time">' + fmt(tSecs) + '</span>'
              + '</div>';
          }).join(''))
        : '<span style="font-size:11px;color:var(--text-muted);font-style:italic;">No folders assigned. Click Edit to add folders.</span>';

      return '<div class="existing-group-card" data-group-id="' + g.id + '" style="border-left-color:' + color + ';">'
        + '<div class="existing-group-header">'
        + '<div class="existing-group-title">'
        + '<span class="group-color-dot" style="background:' + color + '; color:' + color + ';"></span>'
        + '<span style="color:' + color + ';">' + L_ICONS.folder + '</span>'
        + '<span class="group-name-text">' + g.name + '</span>'
        + '<span class="group-badge">' + count + ' folder' + (count === 1 ? '' : 's') + '</span>'
        + '<span class="group-time-badge">' + fmt(totalGroupSecs) + '</span>'
        + '</div>'
        + '<div class="existing-group-actions">'
        + '<button class="btn-icon-sm edit-group-btn" data-group-id="' + g.id + '" title="Edit group name, color, and folders">' + L_ICONS.pencil + ' Edit</button>'
        + '<button class="btn-icon-sm btn-icon-danger delete-group-btn" data-group-id="' + g.id + '" data-group-name="' + g.name.replace(/"/g, '&quot;') + '" title="Delete group">' + L_ICONS.trash + '</button>'
        + '</div>'
        + '</div>'
        + '<div class="group-projects-tags">'
        + folderPillsHtml
        + '</div>'
        + '</div>';
    }).join('');

    // Attach listener to Edit button
    modalExistingGroupsList.querySelectorAll('.edit-group-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        editingGroupId = btn.dataset.groupId;
        switchModalTab('createGroup');
      });
    });

    // Delete group with confirmation popup
    modalExistingGroupsList.querySelectorAll('.delete-group-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const gid = btn.dataset.groupId;
        const gname = btn.dataset.groupName || 'this group';
        groupPendingDelete = gid;
        if (deleteConfirmGroupName) { deleteConfirmGroupName.textContent = '"' + gname + '"'; }
        if (deleteConfirmModal) { deleteConfirmModal.classList.remove('hidden'); }
      });
    });
  }

  // --- Modal Navigation Listeners ---
  if (manageGroupsBtn) {
    manageGroupsBtn.addEventListener('click', openManageGroupsModal);
  }
  if (closeGroupsModalBtn) {
    closeGroupsModalBtn.addEventListener('click', closeManageGroupsModal);
  }
  if (groupsModal) {
    groupsModal.addEventListener('click', function(e) {
      if (e.target === groupsModal) { closeManageGroupsModal(); }
    });
  }
  if (tabActiveGroupsBtn) {
    tabActiveGroupsBtn.addEventListener('click', function() { switchModalTab('activeGroups'); });
  }
  if (tabCreateGroupBtn) {
    tabCreateGroupBtn.addEventListener('click', function() { switchModalTab('createGroup'); });
  }
  if (modalQuickNewGroupBtn) {
    modalQuickNewGroupBtn.addEventListener('click', function() {
      editingGroupId = null;
      switchModalTab('createGroup');
    });
  }
  if (cancelCreateGroupBtn) {
    cancelCreateGroupBtn.addEventListener('click', function() {
      editingGroupId = null;
      switchModalTab('activeGroups');
    });
  }

  if (newGroupNameInput) {
    newGroupNameInput.addEventListener('input', updateCreateGroupBtnState);
  }
  if (modalFolderSearch) {
    modalFolderSearch.addEventListener('input', function(e) {
      modalFolderSearchText = e.target.value.toLowerCase();
      renderModalFolderList();
    });
  }

  const selectAllFoldersBtn = document.getElementById('selectAllFoldersBtn');
  const clearAllFoldersBtn = document.getElementById('clearAllFoldersBtn');

  if (selectAllFoldersBtn) {
    selectAllFoldersBtn.addEventListener('click', function() {
      const allProjects = data.allProjectNames || (data.folderRows || []).map(function(r) { return r.name; });
      const groups = (data.groupsData && data.groupsData.groups) || [];
      const assignedMap = {};
      groups.forEach(function(g) {
        if (editingGroupId && g.id === editingGroupId) { return; }
        (g.projects || []).forEach(function(p) { assignedMap[p.toLowerCase()] = g.name; });
      });

      let available = allProjects.filter(function(p) { return !assignedMap[p.toLowerCase()]; });
      if (modalFolderSearchText) {
        available = available.filter(function(p) { return p.toLowerCase().includes(modalFolderSearchText); });
      }
      available.forEach(function(p) { selectedFolders.add(p); });
      renderModalFolderList();
      updateCreateGroupBtnState();
    });
  }

  if (clearAllFoldersBtn) {
    clearAllFoldersBtn.addEventListener('click', function() {
      selectedFolders.clear();
      renderModalFolderList();
      updateCreateGroupBtnState();
    });
  }

  if (createGroupBtn) {
    createGroupBtn.addEventListener('click', function() {
      const name = newGroupNameInput ? newGroupNameInput.value.trim() : '';
      if (!name || selectedFolders.size === 0) { return; }
      const currentData = data.groupsData || { groups: [] };
      if (!currentData.groups) { currentData.groups = []; }

      if (editingGroupId) {
        const g = currentData.groups.find(function(x) { return x.id === editingGroupId; });
        if (g) {
          g.name = name;
          g.color = selectedGroupColor;
          g.projects = Array.from(selectedFolders);
        }
      } else {
        currentData.groups.push({
          id: 'grp_' + Date.now(),
          name: name,
          color: selectedGroupColor,
          projects: Array.from(selectedFolders)
        });
      }

      data.groupsData = currentData;
      recomputeGroupedDataLocally();
      vscode.postMessage({ command: 'saveGroups', groupsData: currentData });
      selectedFolders.clear();
      if (newGroupNameInput) { newGroupNameInput.value = ''; }
      editingGroupId = null;
      updateCreateGroupBtnState();
      switchModalTab('activeGroups');
      renderExplorer();
      drawCharts();
    });
  }

  // --- Delete Confirmation Modal Listeners ---
  if (cancelDeleteGroupBtn) {
    cancelDeleteGroupBtn.addEventListener('click', function() {
      groupPendingDelete = null;
      if (deleteConfirmModal) { deleteConfirmModal.classList.add('hidden'); }
    });
  }

  if (confirmDeleteGroupBtn) {
    confirmDeleteGroupBtn.addEventListener('click', function() {
      if (!groupPendingDelete) return;
      const currentData = data.groupsData || { groups: [] };
      currentData.groups = (currentData.groups || []).filter(function(g) { return g.id !== groupPendingDelete; });
      data.groupsData = currentData;
      recomputeGroupedDataLocally();
      vscode.postMessage({ command: 'saveGroups', groupsData: currentData });
      groupPendingDelete = null;
      if (deleteConfirmModal) { deleteConfirmModal.classList.add('hidden'); }
      renderModalExistingGroups();
      renderModalFolderList();
      renderExplorer();
      drawCharts();
    });
  }

  if (deleteConfirmModal) {
    deleteConfirmModal.addEventListener('click', function(e) {
      if (e.target === deleteConfirmModal) {
        groupPendingDelete = null;
        deleteConfirmModal.classList.add('hidden');
      }
    });
  }

  // --- View Toggle Buttons (Grouped vs Individual) ---
  const viewGroupedBtn = document.getElementById('viewGroupedBtn');
  const viewIndividualBtn = document.getElementById('viewIndividualBtn');

  if (viewGroupedBtn && viewIndividualBtn) {
    viewGroupedBtn.addEventListener('click', function() {
      if (groupMode) { return; }
      groupMode = true;
      viewGroupedBtn.classList.add('active');
      viewIndividualBtn.classList.remove('active');
      renderExplorer();
      drawCharts();
    });
    viewIndividualBtn.addEventListener('click', function() {
      if (!groupMode) { return; }
      groupMode = false;
      viewIndividualBtn.classList.add('active');
      viewGroupedBtn.classList.remove('active');
      renderExplorer();
      drawCharts();
    });
  }

  // --- Release Announcement Banner & Feature Spotlight ---
  const CURRENT_RELEASE_ID = 'v1.1.0';
  const releaseBanner = document.getElementById('releaseBanner');
  const releaseSpotlightBtn = document.getElementById('releaseSpotlightBtn');
  const dismissReleaseBannerBtn = document.getElementById('dismissReleaseBannerBtn');

  function initReleaseBanner() {
    if (!releaseBanner) { return; }
    let isDismissed = false;
    try {
      isDismissed = localStorage.getItem('dismissedRelease_' + CURRENT_RELEASE_ID) === 'true';
    } catch (e) {
      isDismissed = false;
    }

    if (!isDismissed) {
      releaseBanner.classList.remove('hidden');
    }

    if (dismissReleaseBannerBtn) {
      dismissReleaseBannerBtn.addEventListener('click', function() {
        releaseBanner.classList.add('fade-out');
        setTimeout(function() {
          releaseBanner.classList.add('hidden');
        }, 220);
        try {
          localStorage.setItem('dismissedRelease_' + CURRENT_RELEASE_ID, 'true');
        } catch (e) {}
      });
    }

    if (releaseSpotlightBtn) {
      releaseSpotlightBtn.addEventListener('click', function() {
        const targetBtn = document.getElementById('manageGroupsBtn');
        if (!targetBtn) {
          openManageGroupsModal();
          return;
        }

        // Clean up any existing spotlight
        targetBtn.classList.remove('feature-spotlight-glow');
        const oldTip = targetBtn.querySelector('.spotlight-tooltip');
        if (oldTip) { oldTip.remove(); }

        // Scroll smoothly to button
        targetBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add spotlight glow & tooltip
        targetBtn.classList.add('feature-spotlight-glow');
        const tip = document.createElement('div');
        tip.className = 'spotlight-tooltip';
        tip.textContent = 'Click here to manage groups';
        targetBtn.appendChild(tip);

        // Adjust position so it's centered, but shifts if hitting viewport edges
        function adjustTipPlacement() {
          if (!tip.parentNode) { return; }
          const btnRect = targetBtn.getBoundingClientRect();
          const tipRect = tip.getBoundingClientRect();
          const pad = 12;
          const vw = document.documentElement.clientWidth || window.innerWidth;

          const btnCenterX = btnRect.left + btnRect.width / 2;
          const idealTipLeft = btnCenterX - tipRect.width / 2;
          const clampedTipLeft = Math.max(pad, Math.min(vw - tipRect.width - pad, idealTipLeft));

          const offsetFromBtn = clampedTipLeft - btnRect.left;
          tip.style.left = offsetFromBtn + 'px';
          tip.style.transform = 'none';

          // Arrow points directly at the button center
          const arrowXInTip = btnCenterX - clampedTipLeft;
          const clampedArrowX = Math.max(12, Math.min(tipRect.width - 12, arrowXInTip));
          tip.style.setProperty('--arrow-left', clampedArrowX + 'px');
        }

        requestAnimationFrame(adjustTipPlacement);
        window.addEventListener('resize', adjustTipPlacement);

        // Dismiss spotlight as soon as button is clicked
        function dismissSpotlight() {
          targetBtn.classList.remove('feature-spotlight-glow');
          if (tip.parentNode) { tip.remove(); }
          window.removeEventListener('resize', adjustTipPlacement);
          targetBtn.removeEventListener('click', dismissSpotlight);
        }
        targetBtn.addEventListener('click', dismissSpotlight, { once: true });

        // Safety timeout in case user never clicks (15s)
        setTimeout(dismissSpotlight, 15000);
      });
    }
  }

  updateCards();
  drawCharts();
  renderExplorer();
  updateSuggestionsBanner();
  initReleaseBanner();

  document.querySelectorAll('th[data-col]').forEach(function(th) {
    th.addEventListener('click', function() {
      const col = th.dataset.col;
      if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = false; }
      document.querySelectorAll('th').forEach(function(t) { t.classList.remove('sorted'); });
      th.classList.add('sorted');
      renderExplorer();
    });
  });

  const filterInput = document.getElementById('filterInput');
  if (filterInput) {
    filterInput.addEventListener('input', function(e) {
      filterText = e.target.value.toLowerCase();
      renderExplorer();
    });
  }

  const toggleRowsBtn = document.getElementById('toggleRows');
  if (toggleRowsBtn) {
    toggleRowsBtn.addEventListener('click', function() {
      showAll = !showAll;
      renderExplorer();
    });
  }

  // Keyboard Shortcuts & Power User Hardening
  document.addEventListener('keydown', function(e) {
    // Esc key: Close modals or dropdown
    if (e.key === 'Escape') {
      if (deleteConfirmModal && !deleteConfirmModal.classList.contains('hidden')) {
        groupPendingDelete = null;
        deleteConfirmModal.classList.add('hidden');
        return;
      }
      if (groupsModal && !groupsModal.classList.contains('hidden')) {
        closeManageGroupsModal();
        return;
      }
      const menuDropdown = document.getElementById('menuDropdown');
      const menuBtn = document.getElementById('menuBtn');
      if (menuDropdown && !menuDropdown.classList.contains('hidden')) {
        menuDropdown.classList.add('hidden');
        if (menuBtn) {
          menuBtn.setAttribute('aria-expanded', 'false');
          menuBtn.focus();
        }
      }
    }
    // '/' key or Ctrl+F / Cmd+F: Focus search input
    if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f')) && document.activeElement.tagName !== 'INPUT') {
      if (filterInput) {
        e.preventDefault();
        filterInput.focus();
        filterInput.select();
      }
    }
    // Ctrl+S / Cmd+S: Trigger share card export
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      vscode.postMessage({ command: 'shareCard' });
    }
  });

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.command !== 'liveUpdate') { return; }
    data = e.data.data || {};
    updateCards();
    renderExplorer();
    updateFeedbackBadge();
    updateSuggestionsBanner();
    if (groupsModal && !groupsModal.classList.contains('hidden')) {
      renderModalSuggestions();
      renderModalFolderList();
      renderModalExistingGroups();
    }
    // update chart data in-place without full redraw (no animation)
    const effectiveFolderRows = (groupMode && data.groupedFolderRows) ? data.groupedFolderRows : (data.folderRows || []);
    const effectiveL7stacked = (groupMode && data.groupedLast7stacked) ? data.groupedLast7stacked : (data.last7stacked || {});
    const effectiveTop6projects = (groupMode && data.groupedTop6projects) ? data.groupedTop6projects : (data.top6projects || []);
    const effectiveL30stacked = (groupMode && data.groupedLast30stacked) ? data.groupedLast30stacked : (data.last30stacked || {});

    // Update horizontal leaderboard (top 5) and donut share
    const top5 = [...effectiveFolderRows].slice(0, 5);
    drawLeaderboard(top5, data.lifetimeSecs, effectiveFolderRows);
    const effectiveDirTotals = (groupMode && data.groupedDirTotals) ? data.groupedDirTotals : (data.dirTotals || {});
    drawPieChart(effectiveDirTotals, effectiveFolderRows, data.lifetimeSecs);

    if (data.last7dates) {
      drawL7Section(effectiveFolderRows, effectiveL7stacked, effectiveL7projects);
    }
    if (charts['weekdayChart']) {
      const effectiveW5 = (groupMode && data.groupedWeekTop5) ? data.groupedWeekTop5 : (data.weekTop5 || []);
      const activeW5 = (effectiveW5 || []).filter(function(r) { return (r.weekSecs || 0) > 0; }).slice(0, 5);
      const weekItems = activeW5.length ? activeW5 : (effectiveFolderRows || []).slice(0, 5);
      const weekColors = weekItems.map(function(r, idx) { return r.color || C[idx % C.length]; });
      charts['weekdayChart'].data.labels = weekItems.map(function(r) { return r.name; });
      charts['weekdayChart'].data.datasets[0].data = weekItems.map(function(r) { return hrs(r.weekSecs || 0); });
      charts['weekdayChart'].data.datasets[0].backgroundColor = weekColors;
      charts['weekdayChart'].data.datasets[0].hoverBackgroundColor = weekColors;
      charts['weekdayChart'].update('none');
    }
    if (charts['heatmapChart'] && data.last30) {
      var l30dates = Object.keys(data.last30);
      var dailyHours = l30dates.map(function(d) { return hrs(data.last30[d]); });
      var movingAvg7d = dailyHours.map(function(_, idx) {
        var window = dailyHours.slice(Math.max(0, idx - 6), idx + 1);
        var sum = window.reduce(function(a, b) { return a + b; }, 0);
        return +(sum / window.length).toFixed(1);
      });
      charts['heatmapChart'].data.labels = l30dates.map(function(d) { return d.slice(5); });
      if (charts['heatmapChart'].data.datasets[0]) {
        charts['heatmapChart'].data.datasets[0].data = movingAvg7d;
      }
      if (charts['heatmapChart'].data.datasets[1]) {
        charts['heatmapChart'].data.datasets[1].data = dailyHours;
      }
      charts['heatmapChart'].update('none');
      draw30DayHeatmap(l30dates);
    }
    if (data.last6months) {
      drawMonthChart();
    }
    var el = document.getElementById('todayTotal');
    if (el) {
      el.classList.remove('live-pulse');
      void el.offsetWidth; // trigger reflow for animation reset
      el.classList.add('live-pulse');
      setTimeout(function() { el.classList.remove('live-pulse'); }, 600);
    }
  });

  // devBar is always off on load — never persisted
  var state = (typeof __settings !== 'undefined' && __settings) || {};
  var hidden = state.hiddenSections || {};
  hidden['devBar'] = true;

  function applySections() {
    document.querySelectorAll('[data-section]').forEach(function(el) {
      var s = el.getAttribute('data-section');
      if (hidden[s]) { el.classList.add('hidden'); } else { el.classList.remove('hidden'); }
    });
    document.querySelectorAll('.menu-item input').forEach(function(cb) {
      cb.checked = !hidden[cb.getAttribute('data-section')];
    });
  }
  applySections();
  updateFeedbackBadge();

  const menuBtn = document.getElementById('menuBtn');
  const menuDropdown = document.getElementById('menuDropdown');
  if (menuBtn && menuDropdown) {
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const isHidden = menuDropdown.classList.toggle('hidden');
      menuBtn.setAttribute('aria-expanded', String(!isHidden));
    });
    document.addEventListener('click', function() {
      menuDropdown.classList.add('hidden');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
    menuDropdown.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }

  document.querySelectorAll('.menu-item input').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var s = cb.getAttribute('data-section');
      if (s === 'devBar') {
        hidden[s] = !cb.checked;
        applySections();
        return;
      }
      if (cb.checked) { delete hidden[s]; } else { hidden[s] = true; }
      state.hiddenSections = hidden;
      vscode.postMessage({ command: 'saveSettings', settings: state });
      applySections();
    });
  });

  var shareCardBtn = document.getElementById('shareCardBtn');
  if (shareCardBtn) {
    shareCardBtn.addEventListener('click', function() {
      vscode.postMessage({ command: 'shareCard' });
    });
  }

  if (feedbackBtn) {
    feedbackBtn.addEventListener('click', function() {
      if (feedbackBadge) {
        feedbackBadge.classList.add('hidden');
      }
      vscode.postMessage({ command: 'openFeedback' });
    });
  }

  // Debounced window resize handler for bubble chart re-layout
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      if (typeof drawBubbles === 'function') {
        drawBubbles();
      }
    }, 200);
  });

})();
