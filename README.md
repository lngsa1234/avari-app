# Avari - Women's Networking Platform

Avari is a Next.js-based platform that connects professional women through hybrid meetups, 1:1 coffee chats, group video calls, and direct messaging.

## ✨ Features

- 🤝 **Hybrid Meetups**: Attend in-person OR join via video
- ☕ **1:1 Coffee Chats**: Schedule private video calls with WebRTC
- 👥 **Group Video Calls**: Host meetups with up to 17 participants (Agora)
- 💬 **Direct Messaging**: Real-time text chat between users
- 📹 **Screen Sharing**: Share your screen during group calls
- ⏺️ **Call Recording**: Record video calls for later playback
- 💬 **In-call Chat**: Text messaging during video calls
- 🔐 **Secure Auth**: Google OAuth + email/password via Supabase

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Agora account (for group video)

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/avari-app.git
cd avari-app

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
# (Open Supabase Dashboard → SQL Editor, run migration files)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 📚 Documentation

### Core Documentation
- **[Architecture](./docs/ARCHITECTURE.md)** - System overview, tech stack, project structure
- **[Database](./docs/DATABASE.md)** - Schema, tables, RLS policies
- **[Design Decisions](./docs/DESIGN_DECISIONS.md)** - Key architectural choices explained
- **[Deployment](./docs/DEPLOYMENT.md)** - Setup, build, and deployment guide

### Feature Documentation
- **[Authentication](./docs/AUTHENTICATION.md)** - OAuth, email/password, session management
- **[Meetups](./docs/MEETUPS.md)** - Create and manage hybrid events
- **[Coffee Chats](./docs/COFFEE_CHATS.md)** - 1:1 video calls with WebRTC
- **[Group Video](./docs/GROUP_VIDEO.md)** - Multi-participant calls with Agora
- **[Messaging](./docs/MESSAGING.md)** - Real-time direct messaging
- **[Networking](./docs/NETWORKING.md)** - User connections and recommendations

### Additional Resources
- **[API Integrations](./docs/API_INTEGRATIONS.md)** - Supabase, Agora, Socket.IO setup
- **[Roadmap](./docs/ROADMAP.md)** - Future enhancements and priorities
- **[Agora Setup](./AGORA_SETUP.md)** - Detailed Agora configuration guide

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- TypeScript (for video hooks)

**Backend:**
- Supabase (PostgreSQL + Auth + Realtime)

**Video:**
- Agora RTC SDK (group calls)
- WebRTC + Socket.IO (1:1 calls)

## 📁 Project Structure

```
avari-app/
├── app/                    # Next.js pages
├── components/             # React components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
├── docs/                   # Documentation
├── database-migration-*.sql # Database schemas
└── .env.local             # Environment variables
```

## 🔑 Environment Variables

Required variables in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Agora
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id

# Socket.IO Signaling
NEXT_PUBLIC_SIGNALING_SERVER_URL=https://live-chat-demo.onrender.com
```

See [Deployment Guide](./docs/DEPLOYMENT.md) for complete setup instructions.

## 🧪 Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📦 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

See [Deployment Guide](./docs/DEPLOYMENT.md) for other platforms (Netlify, Railway, Docker).

## 🔐 Security

- Row Level Security (RLS) on all database tables
- JWT-based authentication
- HTTPS-only connections
- OAuth 2.0 for Google sign-in
- Encrypted media streams (DTLS-SRTP)

## 🤝 Contributing

Contributions are welcome! Please read the documentation before submitting PRs.

## 📄 License

[Your License Here]

## 👥 Team

- **Ling Wang** - Project Owner

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/avari-app/issues)
- **Docs**: See `/docs` folder
- **Supabase Support**: [Discord](https://discord.supabase.com)
- **Agora Support**: [Community Forum](https://www.agora.io/en/community/)

---

**Built with ❤️ for women in tech**
