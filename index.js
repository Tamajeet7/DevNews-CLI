#!/usr/bin/env node

const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { program } = require('commander');

// --- ANSI Color Theme & Styling ---
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  
  // Colors
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  green: '\x1b[32m',
  brightGreen: '\x1b[92m',
  yellow: '\x1b[33m',
  brightYellow: '\x1b[93m',
  red: '\x1b[31m',
  brightRed: '\x1b[91m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
  
  // Backgrounds
  bgCyan: '\x1b[46m\x1b[30m',
  bgMagenta: '\x1b[45m\x1b[30m',
  bgBlue: '\x1b[44m\x1b[30m',
};

// Cache file to allow `devnews open <num>`
const CACHE_FILE = path.join(os.tmpdir(), 'devnews_cache.json');

function saveCache(items) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (_) {}
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch (_) {}
  return [];
}

// Format relative time (e.g. "2 hours ago")
function timeAgo(unixTimestamp) {
  if (!unixTimestamp) return '';
  const seconds = Math.floor((Date.now() - unixTimestamp * 1000) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Generate ASCII progress bar
function renderProgressBar(percentage, width = 24) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  
  let color = c.brightGreen;
  if (clamped > 80) color = c.brightRed;
  else if (clamped > 60) color = c.brightYellow;

  const bar = `${color}${'█'.repeat(filled)}${c.gray}${'░'.repeat(empty)}${c.reset}`;
  return `${bar} ${c.bold}${clamped.toFixed(1)}%${c.reset}`;
}

// Native CPU load measurement
function getCpuUsage() {
  return new Promise((resolve) => {
    const cpus1 = os.cpus();
    setTimeout(() => {
      const cpus2 = os.cpus();
      let idleDiff = 0;
      let totalDiff = 0;
      for (let i = 0; i < cpus1.length; i++) {
        const t1 = cpus1[i].times;
        const t2 = cpus2[i].times;
        const total1 = Object.values(t1).reduce((a, b) => a + b, 0);
        const total2 = Object.values(t2).reduce((a, b) => a + b, 0);
        idleDiff += t2.idle - t1.idle;
        totalDiff += total2 - total1;
      }
      const usage = 100 - (100 * idleDiff / (totalDiff || 1));
      resolve(Math.max(0, Math.min(100, usage)));
    }, 150);
  });
}

// Open URL in system default browser
function openBrowser(url) {
  if (!url || url === 'No URL') {
    console.log(`${c.red}✖ No valid URL to open.${c.reset}`);
    return;
  }
  const platform = process.platform;
  let cmd = '';
  if (platform === 'win32') cmd = `start "" "${url}"`;
  else if (platform === 'darwin') cmd = `open "${url}"`;
  else cmd = `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.log(`${c.red}Failed to open browser: ${err.message}${c.reset}`);
    } else {
      console.log(`${c.green}✔ Opened in browser:${c.reset} ${c.underline}${url}${c.reset}`);
    }
  });
}

// Format uptime string
function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

// ----------------------------------------------------------------------------
// CLI Setup
// ----------------------------------------------------------------------------

program
  .name('devnews')
  .version('2.0.0')
  .description('⚡ DevNews CLI — Instant developer news, trending GitHub repos, and system monitor');

// --- Command: news (Hacker News) ---
program
  .command('news')
  .description('Fetch top stories from Hacker News')
  .option('-n, --limit <number>', 'Number of stories to fetch', '5')
  .option('-t, --type <type>', 'Type of stories (top, new, best, ask, show)', 'top')
  .option('-s, --search <keyword>', 'Filter stories by keyword')
  .action(async (options) => {
    const limit = Math.max(1, Math.min(30, parseInt(options.limit, 10) || 5));
    const typeMap = {
      top: 'topstories',
      new: 'newstories',
      best: 'beststories',
      ask: 'askstories',
      show: 'showstories'
    };
    const endpoint = typeMap[options.type.toLowerCase()] || 'topstories';

    console.log(`\n${c.bgCyan} ⚡ DEVNEWS ${c.reset} ${c.bold}${c.cyan}Fetching ${options.type.toUpperCase()} Hacker News stories...${c.reset}\n`);

    try {
      const { data: storyIds } = await axios.get(`https://hacker-news.firebaseio.com/v0/${endpoint}.json`);
      const selectedIds = storyIds.slice(0, limit * 2); // fetch extra in case of search filter

      const stories = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            const { data } = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
            return data;
          } catch {
            return null;
          }
        })
      );

      let filtered = stories.filter(Boolean);
      if (options.search) {
        const query = options.search.toLowerCase();
        filtered = filtered.filter(s => s.title && s.title.toLowerCase().includes(query));
      }
      filtered = filtered.slice(0, limit);

      if (filtered.length === 0) {
        console.log(`${c.yellow}No stories found matching your criteria.${c.reset}\n`);
        return;
      }

      // Save to cache for `devnews open <index>`
      const cacheData = filtered.map(s => ({
        title: s.title,
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`
      }));
      saveCache(cacheData);

      filtered.forEach((story, idx) => {
        const domain = story.url ? new URL(story.url).hostname.replace('www.', '') : 'news.ycombinator.com';
        const ago = timeAgo(story.time);
        
        console.log(`${c.bold}${c.brightCyan}[${idx + 1}]${c.reset} ${c.bold}${c.white}${story.title}${c.reset}`);
        console.log(`    ${c.gray}🔗 ${c.underline}${story.url || `https://news.ycombinator.com/item?id=${story.id}`}${c.reset}`);
        console.log(`    ${c.brightYellow}★ ${story.score || 0} pts${c.reset} ${c.gray}|${c.reset} ${c.cyan}💬 ${story.descendants || 0} comments${c.reset} ${c.gray}|${c.reset} ${c.green}👤 ${story.by}${c.reset} ${c.gray}| ${ago} (${domain})${c.reset}\n`);
      });

      console.log(`${c.gray}Tip: Run ${c.white}devnews open <number>${c.gray} to open any article in your browser!${c.reset}\n`);
    } catch (err) {
      console.error(`${c.red}✖ Failed to fetch Hacker News: ${err.message}${c.reset}\n`);
    }
  });

// --- Command: devto (DEV.to Tech Articles) ---
program
  .command('devto')
  .description('Fetch trending developer articles from DEV.to')
  .option('-n, --limit <number>', 'Number of articles to fetch', '5')
  .option('-t, --tag <tag>', 'Filter by tag (e.g. javascript, react, ai, python)')
  .action(async (options) => {
    const limit = Math.max(1, Math.min(25, parseInt(options.limit, 10) || 5));
    const tagQuery = options.tag ? `&tag=${encodeURIComponent(options.tag)}` : '';

    console.log(`\n${c.bgMagenta} 👩‍💻 DEV.TO ${c.reset} ${c.bold}${c.magenta}Trending Tech Articles ${options.tag ? `(#${options.tag})` : ''}...${c.reset}\n`);

    try {
      const { data: articles } = await axios.get(`https://dev.to/api/articles?per_page=${limit}${tagQuery}`, {
        headers: { 'User-Agent': 'DevNews-CLI' }
      });

      if (!articles || articles.length === 0) {
        console.log(`${c.yellow}No DEV.to articles found.${c.reset}\n`);
        return;
      }

      saveCache(articles.map(a => ({ title: a.title, url: a.url })));

      articles.forEach((article, idx) => {
        const tags = (article.tag_list || []).map(t => `#${t}`).join(' ');
        console.log(`${c.bold}${c.magenta}[${idx + 1}]${c.reset} ${c.bold}${c.white}${article.title}${c.reset}`);
        console.log(`    ${c.gray}🔗 ${c.underline}${article.url}${c.reset}`);
        console.log(`    ${c.brightRed}❤️  ${article.positive_reactions_count} reactions${c.reset} ${c.gray}|${c.reset} ${c.cyan}⏱  ${article.reading_time_minutes} min read${c.reset} ${c.gray}|${c.reset} ${c.yellow}${tags}${c.reset}\n`);
      });

      console.log(`${c.gray}Tip: Run ${c.white}devnews open <number>${c.gray} to open any article in your browser!${c.reset}\n`);
    } catch (err) {
      console.error(`${c.red}✖ Failed to fetch DEV.to articles: ${err.message}${c.reset}\n`);
    }
  });

// --- Command: github (Trending GitHub Repositories) ---
program
  .command('github')
  .description('Fetch top trending repositories on GitHub')
  .option('-n, --limit <number>', 'Number of repositories to fetch', '5')
  .option('-l, --lang <language>', 'Filter by programming language (e.g. typescript, python, rust, go)')
  .action(async (options) => {
    const limit = Math.max(1, Math.min(25, parseInt(options.limit, 10) || 5));
    const langFilter = options.lang ? `+language:${encodeURIComponent(options.lang)}` : '';
    
    // Get repos created or updated recently with high star counts
    const query = `stars:>100${langFilter}`;
    const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=${limit}`;

    console.log(`\n${c.bgBlue} 🐙 GITHUB ${c.reset} ${c.bold}${c.brightCyan}Top Trending Repositories ${options.lang ? `(${options.lang})` : ''}...${c.reset}\n`);

    try {
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'DevNews-CLI',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const repos = data.items || [];
      if (repos.length === 0) {
        console.log(`${c.yellow}No GitHub repositories found.${c.reset}\n`);
        return;
      }

      saveCache(repos.map(r => ({ title: r.full_name, url: r.html_url })));

      repos.forEach((repo, idx) => {
        const desc = repo.description ? (repo.description.length > 90 ? repo.description.slice(0, 87) + '...' : repo.description) : 'No description';
        const lang = repo.language ? `${c.brightYellow}● ${repo.language}${c.reset}` : `${c.gray}● Text${c.reset}`;
        
        console.log(`${c.bold}${c.brightCyan}[${idx + 1}]${c.reset} ${c.bold}${c.white}${repo.full_name}${c.reset} ${lang}`);
        console.log(`    ${c.gray}${desc}${c.reset}`);
        console.log(`    ${c.gray}🔗 ${c.underline}${repo.html_url}${c.reset}`);
        console.log(`    ${c.yellow}⭐ ${repo.stargazers_count.toLocaleString()}${c.reset} ${c.gray}|${c.reset} ${c.cyan}🍴 ${repo.forks_count.toLocaleString()}${c.reset} ${c.gray}|${c.reset} ${c.red}⚠️  ${repo.open_issues_count} open issues${c.reset}\n`);
      });

      console.log(`${c.gray}Tip: Run ${c.white}devnews open <number>${c.gray} to open any repository in your browser!${c.reset}\n`);
    } catch (err) {
      console.error(`${c.red}✖ Failed to fetch GitHub repositories: ${err.message}${c.reset}\n`);
    }
  });

// --- Command: sys (System Hardware & Resource Monitor) ---
program
  .command('sys')
  .description('Show system performance, resource usage, and host specs')
  .action(async () => {
    console.log(`\n${c.bgCyan} 💻 SYSTEM MONITOR ${c.reset} ${c.bold}${c.cyan}Analyzing hardware & resources...${c.reset}\n`);

    try {
      const cpuLoad = await getCpuUsage();
      const totalMemBytes = os.totalmem();
      const freeMemBytes = os.freemem();
      const usedMemBytes = totalMemBytes - freeMemBytes;
      const memPercent = (usedMemBytes / totalMemBytes) * 100;

      const totalGB = (totalMemBytes / (1024 ** 3)).toFixed(2);
      const usedGB = (usedMemBytes / (1024 ** 3)).toFixed(2);
      const freeGB = (freeMemBytes / (1024 ** 3)).toFixed(2);

      const cpus = os.cpus();
      const cpuModel = cpus[0] ? cpus[0].model.trim() : 'Unknown CPU';
      const cpuCores = cpus.length;
      const uptime = formatUptime(os.uptime());

      // Network info
      const nets = os.networkInterfaces();
      let primaryIp = '127.0.0.1';
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            primaryIp = net.address;
            break;
          }
        }
      }

      console.log(`┌─────────────────────────────────────────────────────────┐`);
      console.log(`│ ${c.bold}${c.brightCyan}HARDWARE & OS SPECS${c.reset}                                    │`);
      console.log(`├─────────────────────────────────────────────────────────┤`);
      console.log(`│ ${c.yellow}OS Platform:${c.reset}      ${os.type()} ${os.release()} (${os.arch()})`);
      console.log(`│ ${c.yellow}Hostname:${c.reset}         ${os.hostname()}`);
      console.log(`│ ${c.yellow}CPU Model:${c.reset}        ${cpuModel}`);
      console.log(`│ ${c.yellow}CPU Cores:${c.reset}        ${cpuCores} Threads`);
      console.log(`│ ${c.yellow}System Uptime:${c.reset}    ${uptime}`);
      console.log(`│ ${c.yellow}Local IPv4:${c.reset}       ${primaryIp}`);
      console.log(`│ ${c.yellow}Node.js Version:${c.reset}  ${process.version}`);
      console.log(`├─────────────────────────────────────────────────────────┤`);
      console.log(`│ ${c.bold}${c.brightGreen}RESOURCE UTILIZATION${c.reset}                                  │`);
      console.log(`├─────────────────────────────────────────────────────────┤`);
      console.log(`│ ${c.yellow}CPU Load:${c.reset}         ${renderProgressBar(cpuLoad)}`);
      console.log(`│ ${c.yellow}Memory Usage:${c.reset}     ${renderProgressBar(memPercent)}`);
      console.log(`│ ${c.gray}                  ${usedGB} GB used / ${totalGB} GB total (${freeGB} GB free)${c.reset}`);
      console.log(`└─────────────────────────────────────────────────────────┘\n`);
    } catch (err) {
      console.error(`${c.red}✖ Failed to read system stats: ${err.message}${c.reset}\n`);
    }
  });

// --- Command: open <number> ---
program
  .command('open <number>')
  .description('Open a story or repo by number from the last fetched list')
  .action((number) => {
    const idx = parseInt(number, 10) - 1;
    const cache = loadCache();
    if (!cache || cache.length === 0) {
      console.log(`${c.yellow}No recent articles in cache. Run 'devnews news', 'devnews devto', or 'devnews github' first!${c.reset}\n`);
      return;
    }
    if (isNaN(idx) || idx < 0 || idx >= cache.length) {
      console.log(`${c.red}Invalid index. Available items: 1 to ${cache.length}.${c.reset}\n`);
      return;
    }
    const target = cache[idx];
    console.log(`\n${c.cyan}Opening: ${c.bold}${target.title}${c.reset}`);
    openBrowser(target.url);
    console.log();
  });

// --- Command: digest (All-in-one Daily Summary) ---
program
  .command('digest')
  .description('Show an all-in-one daily briefing (System status + Top News + Trending Repos)')
  .action(async () => {
    console.log(`\n${c.bgCyan} 🌅 DEVNEWS DAILY DIGEST ${c.reset} ${c.bold}${c.white}${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}${c.reset}\n`);

    // 1. System Quick Glance
    try {
      const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(1);
      const usedMem = ((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(1);
      const memPct = (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(0);
      console.log(`${c.bold}${c.cyan}💻 System Status:${c.reset} Uptime: ${formatUptime(os.uptime())} | RAM: ${usedMem}/${totalMem}GB (${memPct}%)\n`);
    } catch (_) {}

    // 2. Top 3 Hacker News
    try {
      console.log(`${c.bold}${c.brightYellow}🔥 Top Tech News (Hacker News):${c.reset}`);
      const { data: topIds } = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json');
      const top3 = topIds.slice(0, 3);
      const stories = await Promise.all(top3.map(id => axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.data).catch(() => null)));
      stories.filter(Boolean).forEach((s, i) => {
        console.log(`  ${c.cyan}${i + 1}.${c.reset} ${c.bold}${s.title}${c.reset} ${c.gray}(★ ${s.score || 0})${c.reset}`);
        console.log(`     ${c.gray}${s.url || 'https://news.ycombinator.com/item?id=' + s.id}${c.reset}`);
      });
      console.log();
    } catch (_) {}

    // 3. Top 3 GitHub Trending Repos
    try {
      console.log(`${c.bold}${c.brightGreen}🐙 Top GitHub Repositories:${c.reset}`);
      const { data } = await axios.get('https://api.github.com/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=3', {
        headers: { 'User-Agent': 'DevNews-CLI', 'Accept': 'application/vnd.github.v3+json' }
      });
      (data.items || []).forEach((r, i) => {
        console.log(`  ${c.green}${i + 1}.${c.reset} ${c.bold}${r.full_name}${c.reset} ${c.yellow}⭐ ${r.stargazers_count.toLocaleString()}${c.reset}`);
        console.log(`     ${c.gray}${r.description ? r.description.slice(0, 75) + '...' : r.html_url}${c.reset}`);
      });
      console.log();
    } catch (_) {}

    console.log(`${c.gray}For full details, run: ${c.white}devnews news${c.gray} | ${c.white}devnews github${c.gray} | ${c.white}devnews sys${c.reset}\n`);
  });

// Parse Arguments
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
