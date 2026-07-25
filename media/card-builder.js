(function() {
  const vscode = acquireVsCodeApi();
  const dataEl = document.getElementById('app-data');
  const D = JSON.parse(dataEl.dataset.json || '{}');

  // --- Formatter Helper ---
  function fmt(secs) {
    const s = Math.max(0, Math.floor(secs || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // --- UI Elements ---
  const layoutBtns = document.querySelectorAll('.layout-btn');
  const rangeRadios = document.querySelectorAll('input[name="range"]');
  const chartRadios = document.querySelectorAll('input[name="chart"]');
  const funFactSelect = document.getElementById('funFactSelect');
  const slotsContainer = document.getElementById('slotsContainer');
  const projectsListEl = document.getElementById('projectsList');
  const projectSearch = document.getElementById('projectSearch');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const selectNoneBtn = document.getElementById('selectNoneBtn');
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusText = document.getElementById('statusText');

  // --- State ---
  let state = {
    layout: 'A',
    range: 'lifetime', // 'lifetime', 'l30', 'l7', 'month'
    chart: 'bar',
    bottom: 'projects',
    funFact: 'coffee',
    slots: ['totalTime', 'dailyAvg', 'streak', 'peakHours'],
    selectedProjects: Object.keys(D.projects || {}) // All by default
  };

  let computed = null; // Will hold the aggregated data

  // --- Aggregation Engine ---
  function computeData() {
    const allL30 = D.l30dates || [];
    const l30set = new Set(allL30);
    const l7dates = allL30.slice(-7);
    const l7set = new Set(l7dates);

    const latestDate = allL30[allL30.length - 1] || new Date().toISOString().slice(0, 10);
    const monthPrefix = latestDate.slice(0, 7);
    const monthDates = allL30.filter(d => d.startsWith(monthPrefix));
    const monthSet = new Set(monthDates);
    
    let lifeTotalSecs = 0;
    let l30TotalSecs = 0;
    let l7TotalSecs = 0;
    let monthTotalSecs = 0;
    
    const lifeDays = {};
    const l30Days = {};
    const l7Days = {};
    const monthDays = {};
    const hourTotals = new Array(24).fill(0);
    
    allL30.forEach(d => { l30Days[d] = 0; });
    l7dates.forEach(d => { l7Days[d] = 0; });
    monthDates.forEach(d => { monthDays[d] = 0; });

    const topLife = {};
    const topL30 = {};
    const topL7 = {};
    const topMonth = {};

    state.selectedProjects.forEach(proj => {
      const p = (D.projects || {})[proj];
      if (!p) return;

      topLife[proj] = 0;
      topL30[proj] = 0;
      topL7[proj] = 0;
      topMonth[proj] = 0;

      // Dates
      for (const [dateStr, secs] of Object.entries(p.dates || {})) {
        lifeDays[dateStr] = (lifeDays[dateStr] || 0) + secs;
        lifeTotalSecs += secs;
        topLife[proj] += secs;

        if (l30set.has(dateStr)) {
          l30Days[dateStr] = (l30Days[dateStr] || 0) + secs;
          l30TotalSecs += secs;
          topL30[proj] += secs;
        }

        if (l7set.has(dateStr)) {
          l7Days[dateStr] = (l7Days[dateStr] || 0) + secs;
          l7TotalSecs += secs;
          topL7[proj] += secs;
        }

        if (monthSet.has(dateStr)) {
          monthDays[dateStr] = (monthDays[dateStr] || 0) + secs;
          monthTotalSecs += secs;
          topMonth[proj] += secs;
        }
      }

      // Peak Hours
      for (const [hStr, secs] of Object.entries(p.hours || {})) {
        const h = parseInt(hStr, 10);
        if (!isNaN(h) && h >= 0 && h < 24) {
          hourTotals[h] += secs;
        }
      }
    });

    // Active days count
    const lifeActiveCount = Object.keys(lifeDays).length;
    const l30ActiveCount = Object.values(l30Days).filter(v => v > 0).length;
    const l7ActiveCount = Object.values(l7Days).filter(v => v > 0).length;
    const monthActiveCount = Object.values(monthDays).filter(v => v > 0).length;

    // Daily Values Array for charts
    const l30DailyValues = allL30.map(d => l30Days[d] || 0);
    const l7DailyValues = l7dates.map(d => l7Days[d] || 0);
    const monthDailyValues = monthDates.map(d => monthDays[d] || 0);

    // Peak Hour
    const peakHour = hourTotals.indexOf(Math.max(...hourTotals, 0));
    const peakLabel = `${peakHour % 12 || 12}${peakHour < 12 ? 'am' : 'pm'}–${(peakHour + 2) % 12 || 12}${(peakHour + 2) < 12 ? 'am' : 'pm'}`;

    // Streak
    const sortedDays = Object.keys(lifeDays).sort().reverse();
    let streak = 0;
    const now = new Date(D.generatedAt || Date.now());
    const todayStr = now.toISOString().slice(0, 10);
    const yStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    
    if (sortedDays[0] === todayStr || sortedDays[0] === yStr) {
      let cur = new Date(sortedDays[0]);
      for (const d of sortedDays) {
        if (d === cur.toISOString().slice(0, 10)) {
          streak++;
          cur.setDate(cur.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Top Projects Helpers
    function getTop(map, total) {
      return Object.entries(map)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, secs]) => ({
          name, secs, pct: total > 0 ? Math.round((secs/total)*100) : 0, fmt: fmt(secs)
        }));
    }

    const totalHours = Math.floor(lifeTotalSecs / 3600);

    computed = {
      lifetime: {
        totalSecs: lifeTotalSecs,
        totalFmt: fmt(lifeTotalSecs),
        activeDays: lifeActiveCount,
        avgPerDayFmt: fmt(lifeActiveCount > 0 ? Math.round(lifeTotalSecs / lifeActiveCount) : 0),
        topProjects: getTop(topLife, lifeTotalSecs),
        dailyValues: l30DailyValues,
        dates: allL30
      },
      l30: {
        totalSecs: l30TotalSecs,
        totalFmt: fmt(l30TotalSecs),
        activeDays: l30ActiveCount,
        avgPerDayFmt: fmt(l30ActiveCount > 0 ? Math.round(l30TotalSecs / l30ActiveCount) : 0),
        topProjects: getTop(topL30, l30TotalSecs),
        dailyValues: l30DailyValues,
        dates: allL30
      },
      l7: {
        totalSecs: l7TotalSecs,
        totalFmt: fmt(l7TotalSecs),
        activeDays: l7ActiveCount,
        avgPerDayFmt: fmt(l7ActiveCount > 0 ? Math.round(l7TotalSecs / l7ActiveCount) : 0),
        topProjects: getTop(topL7, l7TotalSecs),
        dailyValues: l7DailyValues,
        dates: l7dates
      },
      month: {
        totalSecs: monthTotalSecs,
        totalFmt: fmt(monthTotalSecs),
        activeDays: monthActiveCount,
        avgPerDayFmt: fmt(monthActiveCount > 0 ? Math.round(monthTotalSecs / monthActiveCount) : 0),
        topProjects: getTop(topMonth, monthTotalSecs),
        dailyValues: monthDailyValues,
        dates: monthDates
      },
      streak,
      peakLabel,
      totalProjects: state.selectedProjects.length,
      milestoneLabel: totalHours > 0 ? `${totalHours}h Club` : null
    };
  }

  // --- Slot Options ---
  const STAT_OPTIONS = {
    totalTime: { label: 'Total Time', get: (data) => data.totalFmt },
    dailyAvg:  { label: 'Daily Average', get: (data) => data.avgPerDayFmt },
    activeDays:{ label: 'Active Days', get: (data) => String(data.activeDays) },
    streak:    { label: 'Current Streak', get: () => '🔥 ' + computed.streak + (computed.streak===1?' day':' days') },
    peakHours: { label: 'Peak Hours', get: () => '⚡ ' + computed.peakLabel },
    topProject:{ label: 'Top Project', get: (data) => data.topProjects[0] ? data.topProjects[0].name : 'None' },
    rangeTotal:{ label: 'Selected Range Total', get: (data) => data.totalFmt },
    totalProj: { label: 'Total Projects', get: () => String(computed.totalProjects) },
  };

  // Build slot selects
  function initSlots() {
    slotsContainer.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const row = document.createElement('div');
      row.className = 'slot-row';
      
      const num = document.createElement('div');
      num.className = 'slot-num';
      num.textContent = (i + 1) + '.';
      
      const sel = document.createElement('select');
      sel.className = 'select';
      sel.dataset.index = i;
      
      for (const [key, opt] of Object.entries(STAT_OPTIONS)) {
        const o = document.createElement('option');
        o.value = key;
        o.textContent = opt.label;
        if (state.slots[i] === key) o.selected = true;
        sel.appendChild(o);
      }
      
      sel.addEventListener('change', (e) => {
        state.slots[i] = e.target.value;
        render();
      });
      
      row.appendChild(num);
      row.appendChild(sel);
      slotsContainer.appendChild(row);
    }
  }

  // Build projects list
  function initProjects(filterText = '') {
    projectsListEl.innerHTML = '';
    const allProjs = Object.keys(D.projects || {}).sort();
    allProjs.forEach(proj => {
      if (filterText && !proj.toLowerCase().includes(filterText.toLowerCase())) return;

      const lbl = document.createElement('label');
      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = proj;
      cb.checked = state.selectedProjects.includes(proj);
      
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!state.selectedProjects.includes(proj)) state.selectedProjects.push(proj);
        } else {
          state.selectedProjects = state.selectedProjects.filter(p => p !== proj);
        }
        computeData();
        render();
      });
      
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(proj));
      projectsListEl.appendChild(lbl);
    });
  }

  // --- Listeners ---
  if (projectSearch) {
    projectSearch.addEventListener('input', (e) => {
      initProjects(e.target.value);
    });
  }
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const filterText = projectSearch.value.toLowerCase();
      Object.keys(D.projects || {}).forEach(proj => {
        if (filterText && !proj.toLowerCase().includes(filterText)) return;
        if (!state.selectedProjects.includes(proj)) state.selectedProjects.push(proj);
      });
      computeData();
      initProjects(projectSearch.value);
      render();
    });
  }
  if (selectNoneBtn) {
    selectNoneBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const filterText = projectSearch.value.toLowerCase();
      Object.keys(D.projects || {}).forEach(proj => {
        if (filterText && !proj.toLowerCase().includes(filterText)) return;
        state.selectedProjects = state.selectedProjects.filter(p => p !== proj);
      });
      computeData();
      initProjects(projectSearch.value);
      render();
    });
  }

  layoutBtns.forEach(btn => btn.addEventListener('click', () => {
    layoutBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.layout = btn.dataset.layout;
    render();
  }));

  rangeRadios.forEach(r => r.addEventListener('change', (e) => {
    if (e.target.checked) { state.range = e.target.value; render(); }
  }));

  chartRadios.forEach(r => r.addEventListener('change', (e) => {
    if (e.target.checked) { state.chart = e.target.value; render(); }
  }));

  const bottomRadios = document.querySelectorAll('input[name="bottom"]');
  bottomRadios.forEach(r => r.addEventListener('change', (e) => {
    if (e.target.checked) { state.bottom = e.target.value; render(); }
  }));

  if (funFactSelect) {
    funFactSelect.addEventListener('change', (e) => {
      state.funFact = e.target.value;
      render();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (statusText) statusText.textContent = 'Saving...';
      vscode.postMessage({
        command: 'saveCard',
        data: canvas.toDataURL('image/png')
      });
    });
  }

  window.addEventListener('message', event => {
    if (event.data.command === 'saved') {
      if (statusText) {
        statusText.textContent = 'Saved successfully!';
        setTimeout(() => statusText.textContent = '', 3000);
      }
    }
  });

  // --- Canvas Helpers ---
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
  
  function drawLogo(img, x, y, size, color) {
    if (img) { ctx.drawImage(img, x, y, size, size); return; }
    ctx.beginPath(); ctx.arc(x+size/2,y+size/2,size/2-1,0,Math.PI*2);
    ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x+size/2,y+4); ctx.lineTo(x+size/2,y+size/2);
    ctx.moveTo(x+size/2,y+size/2); ctx.lineTo(x+size/2+4,y+size/2+3);
    ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke();
  }

  function drawChartHelper(ctx, data, W, PAD, y, c1, c2, textColor) {
    if(state.chart === 'none' || !data.dailyValues || !data.dailyValues.length) return y;
    
    let chartLabel = 'ACTIVE DAYS';
    if (state.range === 'l30') chartLabel = 'LAST 30 ACTIVE DAYS';
    else if (state.range === 'l7') chartLabel = 'LAST 7 ACTIVE DAYS';
    else if (state.range === 'month') chartLabel = 'THIS MONTH ACTIVE DAYS';
    else if (state.range === 'lifetime') chartLabel = 'RECENT ACTIVITY';

    ctx.font='600 9px "Segoe UI"'; ctx.fillStyle=textColor;
    ctx.fillText(chartLabel, PAD, y+10); y+=22;
    const chartH=80, barCount=data.dailyValues.length;
    const maxDay = Math.max(...data.dailyValues, 1);
    const step=Math.max(1, Math.ceil(barCount/7));

    if(state.chart === 'bar') {
      const barW=Math.max(4, Math.floor((W-PAD*2)/barCount)-2);
      const barGap=Math.floor((W-PAD*2-barW*barCount)/Math.max(barCount-1,1));
      data.dailyValues.forEach((v,i) => {
        const bh=Math.max(2,Math.round((v/maxDay)*chartH));
        const bx=PAD+i*(barW+barGap), by=y+chartH-bh;
        if(c2) {
          const bg=ctx.createLinearGradient(bx,by,bx,by+bh);
          bg.addColorStop(0,c1); bg.addColorStop(1,c2);
          rr(bx,by,barW,bh,2); ctx.fillStyle=bg; ctx.fill();
        } else {
          rr(bx,by,barW,bh,2); ctx.fillStyle=c1; ctx.fill();
        }
      });
      ctx.font='9px "Segoe UI"'; ctx.fillStyle=textColor; ctx.textAlign='center';
      data.dates.forEach((d,i) => {
        if(i%step!==0&&i!==barCount-1)return;
        ctx.fillText(d.slice(5),PAD+i*(barW+barGap)+barW/2,y+chartH+14);
      });
      ctx.textAlign='left';
    } else if (state.chart === 'line') {
      const pointGap = (W-PAD*2)/Math.max(1, barCount-1);
      ctx.beginPath();
      ctx.moveTo(PAD, y+chartH);
      const points = [];
      data.dailyValues.forEach((v,i) => {
        const bh=Math.round((v/maxDay)*chartH);
        points.push({x: PAD+i*pointGap, y: y+chartH-bh});
      });
      ctx.moveTo(points[0].x, points[0].y);
      for(let i=0; i<points.length-1; i++){
        const p1=points[i], p2=points[i+1];
        const cx=(p1.x+p2.x)/2;
        ctx.bezierCurveTo(cx, p1.y, cx, p2.y, p2.x, p2.y);
      }
      ctx.strokeStyle=c1; ctx.lineWidth=2; ctx.stroke();
      
      points.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
        ctx.fillStyle='#fff'; ctx.fill();
        ctx.strokeStyle=c1; ctx.lineWidth=1; ctx.stroke();
      });

      ctx.font='9px "Segoe UI"'; ctx.fillStyle=textColor; ctx.textAlign='center';
      data.dates.forEach((d,i) => {
        if(i%step!==0&&i!==barCount-1)return;
        ctx.fillText(d.slice(5),PAD+i*pointGap,y+chartH+14);
      });
      ctx.textAlign='left';
    }
    return y+chartH+26;
  }

  // Generate Fun Fact string
  function getFunFactStr(currentData) {
    const secs = currentData.totalSecs || 0;
    switch(state.funFact) {
      case 'coffee': return '☕  You powered through ~' + Math.floor(secs/(30*60)) + ' cups of coffee';
      case 'netflix': return '📺  Enough to watch ' + Math.floor(secs/(45*60)) + ' Netflix episodes instead';
      case 'days': return '🚀  That\'s ' + (secs/86400).toFixed(1) + ' days of non-stop coding';
      case 'books': return '📚  Could\'ve read ' + Math.floor(secs/(6*3600)) + ' books';
      case 'sleep': return '😴  Skipped ' + Math.floor(secs/(8*3600)) + ' full nights of sleep';
      default: return null;
    }
  }

  // Load Logo
  let logoImg = null;
  if (D.iconDataUrl) {
    logoImg = new Image();
    logoImg.onload = render;
    logoImg.src = D.iconDataUrl;
  }

  // --- Renderers ---
  const COLORS = ['#61afef','#98c379','#e5c07b','#e06c75','#c678dd','#56b6c2'];

  function getRangeLabel() {
    switch (state.range) {
      case 'l30': return 'LAST 30 DAYS';
      case 'l7': return 'LAST 7 DAYS';
      case 'month': return 'THIS MONTH';
      case 'lifetime':
      default: return 'LIFETIME';
    }
  }

  function renderLayoutA(data, W, H, SC) {
    ctx.save();
    // BG
    rr(0,0,W,H,20); ctx.fillStyle='#0a0a14'; ctx.fill();
    ctx.fillStyle='rgba(198,120,221,0.05)';
    for(let gx=20;gx<W;gx+=24) for(let gy=20;gy<H;gy+=24){ctx.beginPath();ctx.arc(gx,gy,1,0,Math.PI*2);ctx.fill();}
    const gl=ctx.createRadialGradient(0,H/2,0,0,H/2,300);
    gl.addColorStop(0,'rgba(198,120,221,0.07)'); gl.addColorStop(1,'transparent');
    ctx.fillStyle=gl; ctx.fillRect(0,0,W,H);
    const bar=ctx.createLinearGradient(0,0,W,0);
    bar.addColorStop(0,'#c678dd'); bar.addColorStop(1,'#61afef');
    rr(0,0,W,4,0); ctx.fillStyle=bar; ctx.fill();

    const PAD=36; let y=PAD;

    drawLogo(logoImg, PAD, y-2, 26, '#c678dd');
    ctx.font='700 13px "Segoe UI"'; ctx.fillStyle='#fff'; ctx.letterSpacing='1.5px';
    ctx.fillText('DEV TIMEKEEPER', PAD+34, y+15); ctx.letterSpacing='0px';

    if(computed.milestoneLabel) {
      ctx.font='600 10px "Segoe UI"';
      const bw=ctx.measureText('🏆 '+computed.milestoneLabel).width+20;
      const grd=ctx.createLinearGradient(W-PAD-bw,0,W-PAD,0);
      grd.addColorStop(0,'rgba(198,120,221,0.2)'); grd.addColorStop(1,'rgba(97,175,239,0.2)');
      rr(W-PAD-bw,y,bw,22,11); ctx.fillStyle=grd; ctx.fill();
      rr(W-PAD-bw,y,bw,22,11);
      const sg=ctx.createLinearGradient(W-PAD-bw,0,W-PAD,0);
      sg.addColorStop(0,'rgba(198,120,221,0.6)'); sg.addColorStop(1,'rgba(97,175,239,0.6)');
      ctx.strokeStyle=sg; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#fff'; ctx.fillText('🏆 '+computed.milestoneLabel,W-PAD-bw+10,y+15);
    }
    y+=50;

    ctx.font='800 58px "Segoe UI"'; ctx.fillStyle='#ffffff';
    ctx.fillText(data.totalFmt,PAD,y+52);
    ctx.font='500 10px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.22)';
    ctx.fillText('TOTAL CODING TIME  •  ' + getRangeLabel(),PAD,y+70);
    y+=92;

    const ffStr = getFunFactStr(data);
    if(ffStr) {
      ctx.font='500 10px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.4)';
      ctx.fillText(ffStr, PAD, y-4);
      y+=16;
    }

    const sw=(W-PAD*2-30)/4;
    state.slots.forEach((key,i) => {
      const opt = STAT_OPTIONS[key];
      const val = opt ? opt.get(data) : '--';
      const sx=PAD+i*(sw+10);
      const c = COLORS[i%COLORS.length];
      
      rr(sx,y,sw,78,12); ctx.fillStyle='rgba(255,255,255,0.03)'; ctx.fill();
      rr(sx,y,sw,78,12);
      const border=ctx.createLinearGradient(sx,y,sx,y+78);
      border.addColorStop(0,c+'55'); border.addColorStop(0.5,'rgba(255,255,255,0.06)'); border.addColorStop(1,'rgba(255,255,255,0.02)');
      ctx.strokeStyle=border; ctx.lineWidth=1; ctx.stroke();
      rr(sx+1,y+1,sw-2,3,6); ctx.fillStyle=c+'33'; ctx.fill();
      
      ctx.font='700 18px "Segoe UI"'; ctx.fillStyle=c; ctx.textAlign='center';
      ctx.fillText(val,sx+sw/2,y+34);
      ctx.font='500 9px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.25)';
      ctx.fillText(opt ? opt.label.toUpperCase() : '',sx+sw/2,y+56); ctx.textAlign='left';
    });
    y+=94;

    y = drawChartHelper(ctx, data, W, PAD, y, '#c678dd', 'rgba(198,120,221,0.1)', 'rgba(255,255,255,0.2)');

    if (state.bottom === 'projects') {
      ctx.font='500 9px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.2)';
      ctx.fillText('TOP PROJECTS',PAD,y+10); y+=22;
      data.topProjects.slice(0,4).forEach((entry,i) => {
        const color=COLORS[i%COLORS.length]; const rx=y+i*38;
        ctx.beginPath(); ctx.arc(PAD+6,rx+10,5,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
        ctx.font='500 12px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.75)';
        let nm=entry.name; while(ctx.measureText(nm).width>W-PAD*2-80&&nm.length>4)nm=nm.slice(0,-1);
        if(nm!==entry.name)nm+='…'; ctx.fillText(nm,PAD+18,rx+14);
        ctx.font='700 12px "Segoe UI"'; ctx.fillStyle=color; ctx.textAlign='right';
        ctx.fillText(entry.fmt,W-PAD,rx+14); ctx.textAlign='left';
        rr(PAD,rx+22,W-PAD*2,3,2); ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fill();
        if(entry.pct>0){
          const fw=Math.max(4,Math.round((entry.pct/100)*(W-PAD*2)));
          const fg=ctx.createLinearGradient(PAD,0,PAD+fw,0);
          fg.addColorStop(0,color+'cc'); fg.addColorStop(1,color+'22');
          rr(PAD,rx+22,fw,3,2); ctx.fillStyle=fg; ctx.fill();
        }
      });
      y+=data.topProjects.slice(0,4).length*38+12;
    }

    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PAD,y); ctx.lineTo(W-PAD,y); ctx.stroke(); y+=14;
    ctx.font='500 9px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.fillText('Generated '+new Date().toLocaleDateString()+' • Dev Timekeeper',PAD,y+10);
    ctx.restore();
  }

  function renderLayoutB(data, W, H, SC) {
    ctx.save();
    rr(0,0,W,H,16); ctx.fillStyle='#ffffff'; ctx.fill();
    rr(0,0,W,H,16); ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1; ctx.stroke();
    
    const PAD=36; let y=PAD;

    drawLogo(logoImg, PAD, y-2, 26, '#3b82f6');
    ctx.font='700 13px "Segoe UI"'; ctx.fillStyle='#0f172a'; ctx.letterSpacing='1.5px';
    ctx.fillText('DEV TIMEKEEPER', PAD+34, y+15); ctx.letterSpacing='0px';

    if(computed.milestoneLabel) {
      ctx.font='600 10px "Segoe UI"';
      const bw=ctx.measureText('🏆 '+computed.milestoneLabel).width+20;
      rr(W-PAD-bw,y,bw,22,11); ctx.fillStyle='#f8fafc'; ctx.fill();
      rr(W-PAD-bw,y,bw,22,11); ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#334155'; ctx.fillText('🏆 '+computed.milestoneLabel,W-PAD-bw+10,y+15);
    }
    y+=50;

    ctx.font='800 58px "Segoe UI"'; ctx.fillStyle='#0f172a';
    ctx.fillText(data.totalFmt,PAD,y+52);
    ctx.font='600 10px "Segoe UI"'; ctx.fillStyle='#64748b';
    ctx.fillText('TOTAL CODING TIME  •  ' + getRangeLabel(),PAD,y+70);
    y+=92;

    const ffStr = getFunFactStr(data);
    if(ffStr) {
      ctx.font='500 10px "Segoe UI"'; ctx.fillStyle='#64748b';
      ctx.fillText(ffStr, PAD, y-4);
      y+=16;
    }

    const sw=(W-PAD*2-30)/4;
    state.slots.forEach((key,i) => {
      const opt = STAT_OPTIONS[key];
      const val = opt ? opt.get(data) : '--';
      const sx=PAD+i*(sw+10);
      
      rr(sx,y,sw,78,8); ctx.fillStyle='#f8fafc'; ctx.fill();
      rr(sx,y,sw,78,8); ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1; ctx.stroke();
      
      ctx.font='700 18px "Segoe UI"'; ctx.fillStyle='#0f172a'; ctx.textAlign='center';
      ctx.fillText(val,sx+sw/2,y+36);
      ctx.font='600 9px "Segoe UI"'; ctx.fillStyle='#64748b';
      ctx.fillText(opt ? opt.label.toUpperCase() : '',sx+sw/2,y+56); ctx.textAlign='left';
    });
    y+=94;

    y = drawChartHelper(ctx, data, W, PAD, y, '#3b82f6', null, '#64748b');

    if (state.bottom === 'projects') {
      ctx.font='600 9px "Segoe UI"'; ctx.fillStyle='#64748b';
      ctx.fillText('TOP PROJECTS',PAD,y+10); y+=22;
      data.topProjects.slice(0,4).forEach((entry,i) => {
        const rx=y+i*38;
        ctx.font='600 12px "Segoe UI"'; ctx.fillStyle='#0f172a';
        let nm=entry.name; while(ctx.measureText(nm).width>W-PAD*2-80&&nm.length>4)nm=nm.slice(0,-1);
        if(nm!==entry.name)nm+='…'; ctx.fillText(nm,PAD,rx+14);
        ctx.font='700 12px "Segoe UI"'; ctx.fillStyle='#3b82f6'; ctx.textAlign='right';
        ctx.fillText(entry.fmt,W-PAD,rx+14); ctx.textAlign='left';
        rr(PAD,rx+22,W-PAD*2,4,2); ctx.fillStyle='#f1f5f9'; ctx.fill();
        if(entry.pct>0){
          const fw=Math.max(4,Math.round((entry.pct/100)*(W-PAD*2)));
          rr(PAD,rx+22,fw,4,2); ctx.fillStyle='#3b82f6'; ctx.fill();
        }
      });
      y+=data.topProjects.slice(0,4).length*38+12;
    }

    ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PAD,y); ctx.lineTo(W-PAD,y); ctx.stroke(); y+=14;
    ctx.font='500 9px "Segoe UI"'; ctx.fillStyle='#94a3b8';
    ctx.fillText('Generated '+new Date().toLocaleDateString()+' • Dev Timekeeper',PAD,y+10);
    ctx.restore();
  }

  // --- Upgraded Gradient Mode (Layout C) ---
  function renderLayoutC(data, W, H, SC) {
    ctx.save();
    rr(0,0,W,H,24); 
    
    // Rich multi-stop gradient background
    const bg=ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#0f172a');   // Slate 900
    bg.addColorStop(0.35,'#3b0764'); // Purple 950
    bg.addColorStop(0.7,'#1e1b4b');  // Indigo 950
    bg.addColorStop(1,'#0284c7');    // Sky 600
    ctx.fillStyle=bg; ctx.fill();

    // Ambient radial light orbs
    const orb1=ctx.createRadialGradient(W-80,80,0,W-80,80,280);
    orb1.addColorStop(0,'rgba(168,85,247,0.35)');
    orb1.addColorStop(1,'transparent');
    ctx.fillStyle=orb1; ctx.fillRect(0,0,W,H);

    const orb2=ctx.createRadialGradient(80,H-100,0,80,H-100,260);
    orb2.addColorStop(0,'rgba(56,189,248,0.3)');
    orb2.addColorStop(1,'transparent');
    ctx.fillStyle=orb2; ctx.fillRect(0,0,W,H);

    // Multi-color vibrant top accent bar
    const bar=ctx.createLinearGradient(0,0,W,0);
    bar.addColorStop(0,'#a855f7'); bar.addColorStop(0.5,'#38bdf8'); bar.addColorStop(1,'#34d399');
    rr(0,0,W,5,0); ctx.fillStyle=bar; ctx.fill();

    const PAD=40; let y=PAD;

    drawLogo(logoImg, PAD, y-2, 26, '#38bdf8');
    ctx.font='700 13px "Segoe UI"'; ctx.fillStyle='#ffffff'; ctx.letterSpacing='1.5px';
    ctx.fillText('DEV TIMEKEEPER', PAD+34, y+15); ctx.letterSpacing='0px';

    if(computed.milestoneLabel) {
      ctx.font='700 10px "Segoe UI"';
      const bw=ctx.measureText('🏆 '+computed.milestoneLabel).width+24;
      rr(W-PAD-bw,y,bw,24,12); ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fill();
      rr(W-PAD-bw,y,bw,24,12); ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#ffffff'; ctx.fillText('🏆 '+computed.milestoneLabel,W-PAD-bw+12,y+16);
    }
    y+=60;

    ctx.font='800 64px "Segoe UI"'; ctx.fillStyle='#ffffff';
    ctx.fillText(data.totalFmt,PAD,y+54);
    ctx.font='600 11px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.fillText('TOTAL CODING TIME  •  ' + getRangeLabel(),PAD,y+76);
    y+=100;

    const ffStr = getFunFactStr(data);
    if(ffStr) {
      rr(PAD,y,W-PAD*2,36,10); ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill();
      rr(PAD,y,W-PAD*2,36,10); ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1; ctx.stroke();
      ctx.font='600 11px "Segoe UI"'; ctx.fillStyle='#ffffff';
      ctx.fillText(ffStr, PAD+14, y+22);
      y+=56;
    }

    const sw=(W-PAD*2-30)/4;
    state.slots.forEach((key,i) => {
      const opt = STAT_OPTIONS[key];
      const val = opt ? opt.get(data) : '--';
      const sx=PAD+i*(sw+10);
      
      rr(sx,y,sw,82,12); ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fill();
      rr(sx,y,sw,82,12); ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1; ctx.stroke();
      
      ctx.font='700 18px "Segoe UI"'; ctx.fillStyle='#ffffff'; ctx.textAlign='center';
      ctx.fillText(val,sx+sw/2,y+38);
      ctx.font='600 9px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.65)';
      ctx.fillText(opt ? opt.label.toUpperCase() : '',sx+sw/2,y+60); ctx.textAlign='left';
    });
    y+=104;

    y = drawChartHelper(ctx, data, W, PAD, y, '#38bdf8', 'rgba(56,189,248,0.15)', 'rgba(255,255,255,0.7)');

    if (state.bottom === 'projects') {
      ctx.font='600 9px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.65)';
      ctx.fillText('TOP PROJECTS',PAD,y+10); y+=22;
      data.topProjects.slice(0,4).forEach((entry,i) => {
        const rx=y+i*38;
        ctx.font='600 13px "Segoe UI"'; ctx.fillStyle='#ffffff';
        let nm=entry.name; while(ctx.measureText(nm).width>W-PAD*2-80&&nm.length>4)nm=nm.slice(0,-1);
        if(nm!==entry.name)nm+='…'; ctx.fillText(nm,PAD,rx+14);
        ctx.font='700 13px "Segoe UI"'; ctx.fillStyle='#38bdf8'; ctx.textAlign='right';
        ctx.fillText(entry.fmt,W-PAD,rx+14); ctx.textAlign='left';
        rr(PAD,rx+22,W-PAD*2,4,2); ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill();
        if(entry.pct>0){
          const fw=Math.max(4,Math.round((entry.pct/100)*(W-PAD*2)));
          const fg=ctx.createLinearGradient(PAD,0,PAD+fw,0);
          fg.addColorStop(0,'#a855f7'); fg.addColorStop(1,'#38bdf8');
          rr(PAD,rx+22,fw,4,2); ctx.fillStyle=fg; ctx.fill();
        }
      });
      y+=data.topProjects.slice(0,4).length*38+16;
    }

    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PAD,y); ctx.lineTo(W-PAD,y); ctx.stroke(); y+=14;
    ctx.font='500 9px "Segoe UI"'; ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.fillText('Generated '+new Date().toLocaleDateString()+' • Dev Timekeeper',PAD,y+10);
    ctx.restore();
  }

  function render() {
    if (!computed) computeData();
    const data = computed[state.range] || computed.lifetime;
    
    // Calculate dynamic height based on options
    let H = 340; // Base height (header + total + footer)
    if (state.funFact !== 'none') H += (state.layout==='C'?56:16);
    H += 94; // Slots
    if (state.chart !== 'none') H += 128; // Chart
    if (state.bottom === 'projects') H += Math.max(1, Math.min(4, (data.topProjects || []).length)) * 38 + 34; // Projects

    const W = 680;
    const SC = 2; // Retina scale
    
    canvas.width = W * SC;
    canvas.height = H * SC;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(SC, SC);

    ctx.clearRect(0,0,W,H);
    
    if (state.layout === 'A') renderLayoutA(data, W, H, SC);
    else if (state.layout === 'B') renderLayoutB(data, W, H, SC);
    else if (state.layout === 'C') renderLayoutC(data, W, H, SC);
  }

  // --- Init ---
  computeData();
  initSlots();
  initProjects();
  render();

})();
