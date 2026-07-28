(function () {
  const vscode = acquireVsCodeApi();
  let data = __data || {};

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
    document.getElementById('lastUpdated').textContent    = 'Updated ' + new Date().toLocaleTimeString();
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

  function drawCharts() {
    if (!data || !data.folderRows) { return; }
    // 1. Top 10 lifetime bar
    const top10 = [...data.folderRows].slice(0, 10);
    makeChart('barChart', {
      type: 'bar',
      data: {
        labels: top10.map(function(r) { return r.name; }),
        datasets: [{ data: top10.map(function(r) { return hrs(r.totalSecs); }), backgroundColor: C[0], borderRadius: 4 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: scaleOpts('h') }
    });

    // 2. Donut share
    const pie8 = Object.entries(data.dirTotals || {}).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
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
    const l7datasets = (data.last7projects || [])
      .map(function(proj, i) {
        return {
          label: proj,
          data: l7dates.map(function(d) { return hrs(((data.last7stacked[proj] || {})[d]) || 0); }),
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
          legend: { labels: { color: TICK, boxWidth: 12, font: { size: 11 } } },
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
          x: { stacked: true, ticks: { color: TICK }, grid: { color: GRID } },
          y: { stacked: true, ticks: { color: TICK, callback: function(v) { return v + 'h'; } }, grid: { color: GRID } }
        }
      }
    });

    // 4. Top 5 this week horizontal bar
    const w5 = data.weekTop5 || [];
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
        datasets: (data.top6projects || []).map(function(proj, i) {
          return {
            label: proj,
            data: l30dates.map(function(d) { return hrs(((data.last30stacked[proj] || {})[d]) || 0); }),
            backgroundColor: STACK[i % STACK.length],
            borderRadius: 0,
            barPercentage: 0.92,
            categoryPercentage: 0.98
          };
        })
      },
      options: {
        responsive: true,
        aspectRatio: 4,
        plugins: {
          legend: { labels: { color: TICK, boxWidth: 12, font: { size: 11 } } },
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
              maxTicksLimit: 8,
              autoSkip: true
            },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            stacked: true,
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

  // Table
  let sortCol = 'totalSecs', sortAsc = false, filterText = '', showAll = false;

  function renderTable() {
    let rows = [...(data.folderRows || [])];
    if (filterText) { rows = rows.filter(function(r) { return r.name.toLowerCase().includes(filterText); }); }
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
    tableBody.innerHTML = limited.map(function(r) {
      return '<tr><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="' + r.name + '">' + r.name + '</td><td>' + fmt(r.todaySecs) + '</td><td>' + fmt(r.last7Secs) +
        '</td><td>' + fmt(r.rolling30Secs) + '</td><td class="lifetime">' + fmt(r.totalSecs) +
        '</td><td>' + (r.lastActive ? new Date(r.lastActive).toLocaleDateString() : '--') + '</td></tr>';
    }).join('');
  }

  updateCards();
  drawCharts();
  renderTable();

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
    // Esc key: Close menu dropdown
    if (e.key === 'Escape') {
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
    // update chart data in-place without full redraw (no animation)
    if (charts['barChart'] && data.folderRows) {
      var top10 = [...data.folderRows].slice(0,10);
      charts['barChart'].data.datasets[0].data = top10.map(function(r){return hrs(r.totalSecs);});
      charts['barChart'].update('none');
    }
    if (charts['lineChart'] && data.last7dates) {
      charts['lineChart'].data.datasets.forEach(function(ds) {
        var proj = ds.label;
        ds.data = data.last7dates.map(function(d){return hrs(((data.last7stacked[proj]||{})[d])||0);});
      });
      charts['lineChart'].update('none');
    }
    if (charts['heatmapChart'] && data.last30) {
      var l30dates = Object.keys(data.last30);
      charts['heatmapChart'].data.datasets.forEach(function(ds) {
        var proj = ds.label;
        ds.data = l30dates.map(function(d){return hrs(((data.last30stacked[proj]||{})[d])||0);});
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
