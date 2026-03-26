(function () {
  const vscode = acquireVsCodeApi();
  let data = __data;

  const GRID = '#1e1e22';
  const TICK = '#555';
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
    if (!secs || secs <= 0) { return '--'; }
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
    return h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
  }
  function hrs(secs) { return +(secs / 3600).toFixed(1); }

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

  function updateCards() {
    document.getElementById('todayTotal').textContent     = fmt(data.todayTotal);
    document.getElementById('weekTotal').textContent      = fmt(data.weekTotal);
    document.getElementById('monthTotal').textContent     = fmt(data.monthTotal);
    document.getElementById('lifetimeTotal').textContent  = fmt(data.lifetimeSecs);
    document.getElementById('activeDays').textContent     = (data.activeDays || 0) + ' days';
    document.getElementById('avgPerDay').textContent      = fmt(data.avgPerDay);
    document.getElementById('totalProjects').textContent  = String(data.totalProjects || 0);
    document.getElementById('mostActiveProj').textContent = data.mostActiveProj || '--';
    document.getElementById('lastUpdated').textContent    = 'Updated ' + new Date().toLocaleTimeString();
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
      var textColor = (n.lang === 'JavaScript') ? '#222' : '#c8f0c8';
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
    const pie8 = Object.entries(data.dirTotals).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    makeChart('pieChart', {
      type: 'doughnut',
      data: {
        labels: pie8.map(function(x) { return x[0]; }),
        datasets: [{ data: pie8.map(function(x) { return hrs(x[1]); }), backgroundColor: C, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { color: TICK, boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: function(ctx) { return ' ' + ctx.label + ': ' + ctx.parsed + 'h'; } } }
        }
      }
    });

    // 3. Last 7 days stacked area by project
    const l7dates = data.last7dates;
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
        plugins: {
          legend: { labels: { color: TICK, boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            mode: 'index',
            filter: function(item) { return item.parsed.y > 0; },
            callbacks: {
              title: function(ctx) { return ctx[0].label; },
              beforeBody: function(ctx) {
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
    const w5 = data.weekTop5;
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
    const l30dates = Object.keys(data.last30);
    makeChart('heatmapChart', {
      type: 'bar',
      data: {
        labels: l30dates.map(function(d) { return d.slice(5); }),
        datasets: (data.top6projects || []).map(function(proj, i) {
          return {
            label: proj,
            data: l30dates.map(function(d) { return hrs(((data.last30stacked[proj] || {})[d]) || 0); }),
            backgroundColor: STACK[i % STACK.length],
            borderRadius: 2,
            barPercentage: 0.9
          };
        })
      },
      options: {
        responsive: true,
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
          x: { stacked: true, ticks: { color: TICK, maxTicksLimit: 10, maxRotation: 0 }, grid: { display: false } },
          y: { stacked: true, ticks: { color: TICK, callback: function(v) { return v + 'h'; } }, grid: { color: GRID } }
        }
      }
    });

    // 6. Last 6 months
    const months = Object.keys(data.last6months);
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

    // 7. Hour of day - total hours (last 30 days)
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
              label: function(ctx) { return ' ' + ctx.parsed.y + 'h (last 30 days)'; }
            }
          }
        },
        scales: {
          x: { ticks: { color: TICK }, grid: { display: false } },
          y: {
            beginAtZero: true,
            suggestedMax: Math.max(1, Math.ceil(maxHour + 0.2)),
            ticks: { color: TICK, callback: function(v) { return v + 'h'; } },
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
    let rows = [...data.folderRows];
    if (filterText) { rows = rows.filter(function(r) { return r.name.toLowerCase().includes(filterText); }); }
    rows.sort(function(a, b) {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === 'string') { return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av); }
      return sortAsc ? av - bv : bv - av;
    });
    const limited = (!showAll && !filterText) ? rows.slice(0, 10) : rows;
    document.getElementById('toggleRows').textContent = showAll ? 'Top 10' : ('Show All (' + rows.length + ')');
    document.getElementById('tableBody').innerHTML = limited.map(function(r) {
      return '<tr><td>' + r.name + '</td><td>' + fmt(r.todaySecs) + '</td><td>' + fmt(r.weekSecs) +
        '</td><td>' + fmt(r.monthSecs) + '</td><td class="lifetime">' + fmt(r.totalSecs) +
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
  document.getElementById('filterInput').addEventListener('input', function(e) {
    filterText = e.target.value.toLowerCase(); renderTable();
  });
  document.getElementById('toggleRows').addEventListener('click', function() {
    showAll = !showAll; renderTable();
  });

  window.addEventListener('message', function(e) {
    if (e.data.command !== 'liveUpdate') { return; }
    data = e.data.data;
    updateCards();
    renderTable();
    // update chart data in-place without full redraw (no animation)
    if (charts['barChart']) {
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
    if (charts['heatmapChart']) {
      var l30dates = Object.keys(data.last30);
      charts['heatmapChart'].data.datasets.forEach(function(ds) {
        var proj = ds.label;
        ds.data = l30dates.map(function(d){return hrs(((data.last30stacked[proj]||{})[d])||0);});
      });
      charts['heatmapChart'].update('none');
    }
    var el = document.getElementById('todayTotal');
    el.style.color = '#98c379';
    setTimeout(function() { el.style.color = ''; }, 500);
  });
  // 3-dot menu -- section visibility persisted to disk via extension
  var state = (typeof __settings !== 'undefined' && __settings) || {};
  var hidden = state.hiddenSections || {};

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

  document.getElementById('menuBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('menuDropdown').classList.toggle('hidden');
  });
  document.addEventListener('click', function() {
    document.getElementById('menuDropdown').classList.add('hidden');
  });
  document.getElementById('menuDropdown').addEventListener('click', function(e) {
    e.stopPropagation();
  });
  document.querySelectorAll('.menu-item input').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var s = cb.getAttribute('data-section');
      if (cb.checked) { delete hidden[s]; } else { hidden[s] = true; }
      state.hiddenSections = hidden;
      // persist to disk via extension
      vscode.postMessage({ command: 'saveSettings', settings: state });
      applySections();
    });
  });

})();
