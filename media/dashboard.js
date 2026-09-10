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

  const scaleOpts = function(unit) {
    return {
      x: { ticks: { color: TICK, maxRotation: 30 }, grid: { color: GRID } },
      y: { ticks: { color: TICK, callback: function(v) { return v + unit; } }, grid: { color: GRID } }
    };
  };

  const charts = {};
  function makeChart(id, config) {
    if (charts[id]) { charts[id].destroy(); }
    const el = document.getElementById(id);
    if (!el) { return; }
    charts[id] = new Chart(el, config);
  }

  function setDelta(elId, current, prev, label) {
    const el = document.getElementById(elId);
    if (!el) { return; }
    if (!prev && !current) {
      el.textContent = 'No previous data';
      el.className = 'card-delta delta-neutral';
      return;
    }
    if (!prev) {
      el.textContent = '▲ ' + fmtDiff(current) + ' vs ' + label + ' (0)';
      el.className = 'card-delta delta-up';
      return;
    }
    const diff = current - prev;
    const pct = (diff / prev) * 100;
    const arrow = diff >= 0 ? '▲' : '▼';
    const sign = diff >= 0 ? '+' : '-';
    const pctStr = Math.abs(pct).toFixed(1);
    const diffStr = fmtDiff(Math.abs(diff));
    el.textContent = `${arrow} ${sign}${diffStr} (${sign}${pctStr}%) vs ${label} (${fmt(prev)})`;
    el.className = 'card-delta ' + (diff >= 0 ? 'delta-up' : 'delta-down');
  }

  function updateDevBar() {
    var repo = document.getElementById('devRepo');
    var file = document.getElementById('devFile');
    var session = document.getElementById('devSession');
    if (repo) { repo.textContent = data.currentProject || '(none — no workspace folder)'; }
    if (file) { file.textContent = data.currentFile || '(no active file)'; }
    if (session) { session.textContent = fmt(data.todayTotal); }
    var heroProject = document.getElementById('heroProject');
    var heroFile = document.getElementById('heroFile');
    if (heroProject) { heroProject.textContent = data.currentProject || 'No workspace selected'; }
    if (heroFile) { heroFile.textContent = data.currentFile || 'Open a file to start tracking'; }
    var trackingStatus = document.getElementById('trackingStatus');
    if (trackingStatus) { trackingStatus.textContent = data.currentFile ? 'Active workspace' : 'Workspace overview'; }
  }

  function updateCards() {
    if (!data) { return; }
    document.getElementById('todayTotal').textContent     = fmt(data.todayTotal);
    document.getElementById('weekTotal').textContent      = fmt(data.weekTotal);
    document.getElementById('monthTotal').textContent     = fmt(data.monthTotal);
    document.getElementById('lifetimeTotal').textContent  = fmt(data.lifetimeSecs);
    document.getElementById('activeDays').textContent     = (data.activeDays || 0) + ' days';
    document.getElementById('avgPerDay').textContent      = fmt(data.avgPerDay);
    document.getElementById('totalProjects').textContent  = String(data.totalProjects || 0);
    document.getElementById('mostActiveProj').textContent = data.mostActiveProj || '--';
    var syncTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    document.getElementById('lastUpdated').textContent = 'Updated ' + syncTime;
    var heroLastUpdated = document.getElementById('heroLastUpdated');
    if (heroLastUpdated) { heroLastUpdated.textContent = syncTime; }
    setDelta('todayDelta', data.todayTotal, data.yesterdayTotal, 'yesterday');
    setDelta('weekDelta', data.weekTotal, data.prevWeekTotal, 'last week');
    setDelta('monthDelta', data.monthTotal, data.prevMonthTotal, 'last month');
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

  function drawCharts() {
    if (!data) { return; }
    const effectiveFolderRows = (groupMode && data.groupedFolderRows) ? data.groupedFolderRows : (data.folderRows || []);
    const effectiveDirTotals = (groupMode && data.groupedDirTotals) ? data.groupedDirTotals : (data.dirTotals || {});
    const effectiveL7stacked = (groupMode && data.groupedLast7stacked) ? data.groupedLast7stacked : (data.last7stacked || {});
    const effectiveL7projects = (groupMode && data.groupedLast7projects) ? data.groupedLast7projects : (data.last7projects || []);
    const effectiveW5 = (groupMode && data.groupedWeekTop5) ? data.groupedWeekTop5 : (data.weekTop5 || []);
    const effectiveTop6projects = (groupMode && data.groupedTop6projects) ? data.groupedTop6projects : (data.top6projects || []);
    const effectiveL30stacked = (groupMode && data.groupedLast30stacked) ? data.groupedLast30stacked : (data.last30stacked || {});

    // 1. Top 10 lifetime bar
    const top10 = [...effectiveFolderRows].slice(0, 10);
    makeChart('barChart', {
      type: 'bar',
      data: {
        labels: top10.map(function(r) { return r.name; }),
        datasets: [{ data: top10.map(function(r) { return hrs(r.totalSecs); }), backgroundColor: C[0], borderRadius: 4 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: scaleOpts('h') }
    });

    // 2. Donut share
    const pie8 = Object.entries(effectiveDirTotals || {}).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    var pieColors = C.slice(0, pie8.length);
    makeChart('pieChart', {
      type: 'doughnut',
      data: {
        labels: pie8.map(function(x) { return x[0]; }),
        datasets: [{
          data: pie8.map(function(x) { return hrs(x[1]); }),
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
          if (elements.length && pie8[elements[0].index]) {
            var idx = elements[0].index;
            if (centerLabel) { centerLabel.textContent = pie8[idx][0]; }
            if (centerValue) { centerValue.textContent = fmt(pie8[idx][1]); }
          } else {
            if (centerLabel) { centerLabel.textContent = 'Projects'; }
            if (centerValue) { centerValue.textContent = fmt(data.lifetimeSecs); }
          }
        }
      },
      plugins: []
    });
    // build custom legend
    var pieLegend = document.getElementById('pieLegend');
    if (pieLegend) {
      pieLegend.innerHTML = pie8.map(function(x, i) {
        return '<div class="pie-legend-item" data-idx="'+i+'" style="display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer;transition:opacity 0.15s;">'
          + '<span style="width:10px;height:10px;border-radius:50%;background:'+C[i]+';flex-shrink:0;"></span>'
          + '<span style="font-size:11px;font-weight:500;color:var(--text-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;" title="'+x[0]+'">'+x[0]+'</span>'
          + '<span style="font-size:11px;font-weight:600;color:'+C[i]+';margin-left:auto;padding-left:8px;font-variant-numeric:tabular-nums;">'+fmt(x[1])+'</span>'
          + '</div>';
      }).join('');
      pieLegend.querySelectorAll('.pie-legend-item').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
          var idx = +el.dataset.idx;
          var chart = charts['pieChart'];
          if (!chart) { return; }
          chart.setDatasetVisibility(0, true);
          var meta = chart.getDatasetMeta(0);
          meta.data.forEach(function(arc, i) { arc.options.backgroundColor = i === idx ? C[i] : C[i] + '44'; });
          chart.update('none');
          pieLegend.querySelectorAll('.pie-legend-item').forEach(function(l, i) {
            l.style.opacity = i === idx ? '1' : '0.35';
          });
          var centerLabel = document.getElementById('pieCenterLabel');
          var centerValue = document.getElementById('pieCenterValue');
          if (centerLabel && pie8[idx]) { centerLabel.textContent = pie8[idx][0]; }
          if (centerValue && pie8[idx]) { centerValue.textContent = fmt(pie8[idx][1]); }
        });
        el.addEventListener('mouseleave', function() {
          var chart = charts['pieChart'];
          if (!chart) { return; }
          var meta = chart.getDatasetMeta(0);
          meta.data.forEach(function(arc, i) { arc.options.backgroundColor = C[i]; });
          chart.update('none');
          pieLegend.querySelectorAll('.pie-legend-item').forEach(function(l) { l.style.opacity = '1'; });
          var centerLabel = document.getElementById('pieCenterLabel');
          var centerValue = document.getElementById('pieCenterValue');
          if (centerLabel) { centerLabel.textContent = 'Projects'; }
          if (centerValue) { centerValue.textContent = fmt(data.lifetimeSecs); }
        });
      });
    }

    // Set initial doughnut center values on load
    var initCenterLabel = document.getElementById('pieCenterLabel');
    var initCenterValue = document.getElementById('pieCenterValue');
    if (initCenterLabel) { initCenterLabel.textContent = 'Projects'; }
    if (initCenterValue) { initCenterValue.textContent = fmt(data.lifetimeSecs); }

    // 3. Last 7 days stacked area by project
    const l7dates = data.last7dates || [];
    const l7datasets = (effectiveL7projects || [])
      .map(function(proj, i) {
        return {
          label: proj,
          data: l7dates.map(function(d) { return hrs(((effectiveL7stacked[proj] || {})[d]) || 0); }),
          backgroundColor: STACK[i % STACK.length] + 'cc',
          borderColor: STACK[i % STACK.length],
          borderWidth: 1.5,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: STACK[i % STACK.length]
        };
      })
      .filter(function(ds) { return ds.data.some(function(v) { return v > 0; }); });
    makeChart('lineChart', {
      type: 'line',
      data: { labels: l7dates, datasets: l7datasets },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false, axis: 'x' },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: TICK,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 6,
              boxHeight: 6,
              padding: 10,
              font: { size: 10 }
            }
          },
          tooltip: {
            filter: function(item) { return item.parsed.y > 0; },
            callbacks: {
              title: function(ctx) {
                if (!ctx || !ctx.length) { return ''; }
                return ctx[0].label;
              },
              beforeBody: function(ctx) {
                if (!ctx || !ctx.length) { return 'No data'; }
                const total = ctx.reduce(function(s, c) { return s + c.parsed.y; }, 0);
                return 'Total: ' + fmt(Math.round(total * 3600));
              },
              label: function(ctx) { return ' ' + ctx.dataset.label + ':  ' + fmt(Math.round(ctx.parsed.y * 3600)); }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { color: TICK, font: { size: 10 } }, grid: { color: GRID } },
          y: { stacked: true, beginAtZero: true, ticks: { color: TICK, callback: function(v) { return v + 'h'; } }, grid: { color: GRID } }
        }
      }
    });

    // 4. Top 5 this week horizontal bar
    const w5 = effectiveW5 || [];
    makeChart('weekBarChart', {
      type: 'bar',
      data: {
        labels: w5.map(function(r) { return r.name; }),
        datasets: [{ data: w5.map(function(r) { return hrs(r.weekSecs); }), backgroundColor: C[1], borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: TICK, callback: function(v) { return v + 'h'; } }, grid: { color: GRID } },
          y: { ticks: { color: TICK }, grid: { color: GRID } }
        }
      }
    });

    // 5. Last 30 days stacked by project
    const l30dates = Object.keys(data.last30 || {});
    makeChart('heatmapChart', {
      type: 'bar',
      data: {
        labels: l30dates.map(function(d) { return d.slice(5); }),
        datasets: (effectiveTop6projects || []).map(function(proj, i) {
          return {
            label: proj,
            data: l30dates.map(function(d) { return hrs(((effectiveL30stacked[proj] || {})[d]) || 0); }),
            backgroundColor: STACK[i % STACK.length],
            borderRadius: 2,
            borderSkipped: false,
            barPercentage: 0.85,
            categoryPercentage: 0.9
          };
        })
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: TICK,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 6,
              boxHeight: 6,
              padding: 10,
              font: { size: 10 }
            }
          },
          tooltip: {
            callbacks: {
              title: function(ctx) { return l30dates[ctx[0].dataIndex]; },
              beforeBody: function(ctx) {
                const date = l30dates[ctx[0].dataIndex];
                const total = (data.top6projects || []).reduce(function(s, p) { return s + (((data.last30stacked[p] || {})[date]) || 0); }, 0);
                return 'Total: ' + fmt(total);
              },
              label: function(ctx) { return ' ' + ctx.dataset.label + ':  ' + fmt(Math.round(ctx.parsed.y * 3600)); }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
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
            stacked: true,
            beginAtZero: true,
            ticks: { color: TICK, callback: function(v) { return v + 'h'; } },
            grid: { color: GRID, drawTicks: false },
            border: { display: false, dash: [4, 4] }
          }
        }
      }
    });

    // 6. Last 6 months
    const months = Object.keys(data.last6months || {});
    makeChart('monthChart', {
      type: 'bar',
      data: {
        labels: months.map(function(m) {
          const parts = m.split('-');
          return new Date(+parts[0], +parts[1] - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
        }),
        datasets: [{
          data: months.map(function(m) { return hrs(data.last6months[m]); }),
          backgroundColor: months.map(function(_, i) { return i === months.length - 1 ? C[2] : C[0]; }),
          borderRadius: 4
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: scaleOpts('h') }
    });

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
  let modalFolderSearchText = '';

  function renderTable() {
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
        renderTable();
      });
    });
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
      renderTable();
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
      renderTable();
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
      renderTable();
      drawCharts();
    });
    viewIndividualBtn.addEventListener('click', function() {
      if (!groupMode) { return; }
      groupMode = false;
      viewIndividualBtn.classList.add('active');
      viewGroupedBtn.classList.remove('active');
      renderTable();
      drawCharts();
    });
  }

  // --- Release Announcement Banner & Feature Spotlight ---
  const CURRENT_RELEASE_ID = 'v1.0.38';
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
  renderTable();
  updateSuggestionsBanner();
  initReleaseBanner();

  document.querySelectorAll('th[data-col]').forEach(function(th) {
    th.addEventListener('click', function() {
      const col = th.dataset.col;
      if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = false; }
      document.querySelectorAll('th').forEach(function(t) { t.classList.remove('sorted'); });
      th.classList.add('sorted');
      renderTable();
    });
  });

  const filterInput = document.getElementById('filterInput');
  if (filterInput) {
    filterInput.addEventListener('input', function(e) {
      filterText = e.target.value.toLowerCase();
      renderTable();
    });
  }

  const toggleRowsBtn = document.getElementById('toggleRows');
  if (toggleRowsBtn) {
    toggleRowsBtn.addEventListener('click', function() {
      showAll = !showAll;
      renderTable();
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
    renderTable();
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
    const effectiveL30stacked = (groupMode && data.groupedLast30stacked) ? data.groupedLast30stacked : (data.last30stacked || {});

    if (charts['barChart']) {
      var top10 = [...effectiveFolderRows].slice(0, 10);
      charts['barChart'].data.labels = top10.map(function(r) { return r.name; });
      charts['barChart'].data.datasets[0].data = top10.map(function(r) { return hrs(r.totalSecs); });
      charts['barChart'].update('none');
    }
    if (charts['lineChart'] && data.last7dates) {
      charts['lineChart'].data.datasets.forEach(function(ds) {
        var proj = ds.label;
        ds.data = data.last7dates.map(function(d) { return hrs(((effectiveL7stacked[proj] || {})[d]) || 0); });
      });
      charts['lineChart'].update('none');
    }
    if (charts['heatmapChart'] && data.last30) {
      var l30dates = Object.keys(data.last30);
      charts['heatmapChart'].data.datasets.forEach(function(ds) {
        var proj = ds.label;
        ds.data = l30dates.map(function(d) { return hrs(((effectiveL30stacked[proj] || {})[d]) || 0); });
      });
      charts['heatmapChart'].update('none');
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
