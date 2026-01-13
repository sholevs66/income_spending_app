# 💰 Israeli Finance Dashboard

A self-hosted personal finance dashboard that scrapes Israeli bank accounts and credit cards, providing monthly balance tracking with Israeli-style date logic.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

- **🏦 Bank Scraping** - Automatic data fetching from Israeli banks (Hapoalim, Visa Cal, Isracard)
- **📅 Israeli Month Logic** - Salary and credit card payments on the 1st-3rd count for the previous month
- **🎯 Savings Goals** - Set monthly savings targets with smart budget calculations
- **📂 Categories** - Auto-labeling of transactions with learning rules
- **📈 Investments** - Track investments separately (not counted as expenses)
- **📊 Moving Averages** - 3-month category averages with progress bars
- **💬 Comments** - Add personal notes to any transaction
- **🔒 Self-Hosted** - All data stays on your machine

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- Israeli bank account credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/income_spending_app.git
cd income_spending_app

# Install dependencies
npm install

# Create environment file
touch .env
```

### Configuration

Create a `.env` file with your credentials:

```env
# Bank Hapoalim
HAPOALIM_USER=your_username
HAPOALIM_PASS=your_password

# Visa Cal
CAL_USER=your_username
CAL_PASS=your_password

# Isracard (optional)
ISRACARD_ID=your_id_number
ISRACARD_CARD6=last_6_digits
ISRACARD_PASS=your_password
```

### Running

```bash
# 1. Scrape bank data (opens browser for 2FA)
npm run scrape

# 2. Start the dashboard
npm start

# 3. Open http://localhost:3000
```

## 🐳 Docker

```bash
# Build and run
docker-compose up -d

# Scrape data
docker-compose run app npm run scrape

# Stop
docker-compose down
```

## 📁 Project Structure

```
income_spending_app/
├── server.js        # Express API server
├── db.js            # SQLite database layer
├── scrape.js        # Bank scraper
├── public/          # Frontend files
│   ├── index.html
│   ├── app.js
│   └── style.css
├── finance.db       # Your data (gitignored)
├── .env             # Credentials (gitignored)
└── Dockerfile       # Docker configuration
```

## 🔧 npm Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the dashboard server |
| `npm run scrape` | Fetch transactions from banks |

## 📊 Dashboard Features

### Monthly View
- Income vs Expenses balance
- Category breakdown with moving averages
- Progress bars showing spending vs average

### Savings Calculator
- Set monthly savings target
- Expected income (manual or auto-calculated)
- Smart budget for variable expenses

### Transaction Management
- Auto-categorization rules
- Manual exclusions from balance
- Investment tracking
- Personal comments

## 🔒 Security

- All credentials stored in `.env` (never committed)
- Data stored locally in SQLite
- No external servers - fully self-hosted
- Bank scraping uses official APIs via [israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers)

## 📱 Deployment (Raspberry Pi)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Copy project files and .env
scp -r income_spending_app pi@raspberrypi:~/

# Run
cd ~/income_spending_app
docker-compose up -d

# Set up auto-scraping (crontab -e)
0 8,20 * * * cd ~/income_spending_app && docker-compose run app npm run scrape
```

## 📄 License

MIT License - feel free to use and modify!

## 🙏 Credits

- [israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers) - Bank scraping library
- Built with Express.js, SQLite, and vanilla JavaScript
