# ⚡ DevNews CLI

A fast, lightweight, and beautiful command-line tool for developers to stay up to date with tech news, trending repositories, and monitor host hardware metrics directly inside the terminal.

---

## 🚀 Features

- 📰 **Hacker News Feed**: Instant parallel fetching of Top, New, Best, Ask HN, and Show HN stories.
- 👩‍💻 **DEV.to Community Feed**: Trending developer blog posts, tags, reactions, and read times.
- 🐙 **Trending GitHub Repos**: Discover today's top open-source repositories filtered by language.
- 💻 **Real-time System Monitor**: Hardware specs, live CPU % load gauge, RAM gauge, uptime, and IP address.
- 🌐 **One-Click Browser Launcher**: Instantly open any fetched story in your default browser with `devnews open <number>`.
- 🌅 **Daily Tech Digest**: Quick morning executive briefing with system status, top stories, and trending repos.

---

## 📦 Installation

### Run directly with `npm link` (Global CLI command)
```bash
cd DevNews-CLI
npm link
```
Now you can use `devnews` anywhere in your terminal!

---

## 💻 Commands & Usage

### 1. Hacker News (`devnews news`)
```bash
# Top 5 stories (default)
devnews news

# Custom limit
devnews news -n 10

# Filter by type (top, new, best, ask, show)
devnews news -t ask

# Search by keyword
devnews news -s "ai"
```

### 2. DEV.to Articles (`devnews devto`)
```bash
# Trending articles
devnews devto

# Filter by tag
devnews devto -t react
devnews devto -t python
```

### 3. GitHub Trending Repositories (`devnews github`)
```bash
# Top trending repos
devnews github

# Filter by language
devnews github -l typescript
devnews github -l rust
```

### 4. System Hardware & Resource Monitor (`devnews sys`)
```bash
devnews sys
```

### 5. Open Story in Browser (`devnews open <number>`)
```bash
devnews open 1
devnews open 3
```

### 6. Daily Tech Digest (`devnews digest`)
```bash
devnews digest
```
