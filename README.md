# TikTok Scraper Dashboard

A modern, responsive web dashboard for managing TikTok scraping operations. Built with Next.js, TypeScript, and Tailwind CSS, designed to be deployed on Vercel.

## Features

### 🎯 Dashboard Overview
- Real-time system statistics
- Queue status monitoring
- Worker activity tracking
- System health indicators

### 📋 Queue Management
- Add TikTok URLs to scraping queue
- Support for both profile and individual video scraping
- Real-time progress tracking
- Queue item status monitoring
- Remove pending items from queue

### 👥 Worker Management
- Add and remove workers
- Start, pause, and stop worker processes
- Monitor worker status and activity
- View current tasks and processing statistics
- Error handling and worker reset functionality

### 📊 Results Viewing
- View completed scraping results
- Download CSV files
- Success rate statistics
- Processing time analytics
- File size information

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Headless UI
- **Icons**: Heroicons
- **Deployment**: Vercel
- **State Management**: React hooks with local state
- **API**: Next.js API routes

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tiktok-scraper-ui
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment on Vercel

### Option 1: Deploy from GitHub

1. Push your code to a GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Configure project settings:
   - Framework Preset: Next.js
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
6. Click "Deploy"

### Option 2: Deploy with Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel --prod
```

## Project Structure

```
src/
├── app/                    # App router pages
│   ├── api/               # API routes
│   │   ├── queue/         # Queue management endpoints
│   │   ├── workers/       # Worker management endpoints
│   │   ├── results/       # Results endpoints
│   │   └── stats/         # Statistics endpoints
│   ├── queue/             # Queue management page
│   ├── workers/           # Worker management page
│   ├── results/           # Results viewing page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Dashboard page
├── components/            # Reusable components
│   ├── Navbar.tsx         # Navigation component
│   └── StatCard.tsx       # Statistics card component
├── lib/                   # Utility libraries
│   └── storage.ts         # Data storage utilities
└── types/                 # TypeScript type definitions
    └── scraper.ts         # Scraper-related types
```

## API Endpoints

### Queue Management
- `GET /api/queue` - Get all queue items
- `POST /api/queue` - Add item to queue
- `DELETE /api/queue?id={id}` - Remove item from queue

### Worker Management  
- `GET /api/workers` - Get all workers
- `POST /api/workers` - Create new worker
- `PATCH /api/workers` - Update worker status
- `DELETE /api/workers?id={id}` - Remove worker

### Results
- `GET /api/results` - Get all scraping results

### Statistics
- `GET /api/stats` - Get system statistics

## Data Models

### QueueItem
```typescript
interface QueueItem {
  id: string
  url: string
  type: 'profile' | 'video'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  addedAt: string
  startedAt?: string
  completedAt?: string
  error?: string
  progress?: number
  videosFound?: number
  videosProcessed?: number
}
```

### Worker
```typescript
interface Worker {
  id: string
  name: string
  status: 'idle' | 'running' | 'paused' | 'error'
  currentTask?: QueueItem
  processedCount: number
  startedAt?: string
  lastActivity?: string
  errorMessage?: string
}
```

## Features in Detail

### Real-time Updates
- Dashboard polls API every 5 seconds for updates
- Queue page polls every 3 seconds for real-time progress
- Workers page polls every 3 seconds for status updates

### Responsive Design
- Mobile-first approach
- Responsive navigation with mobile menu
- Grid layouts that adapt to screen size
- Touch-friendly interface elements

### User Experience
- Loading states for all async operations
- Error handling with user-friendly messages
- Confirmation dialogs for destructive actions
- Visual feedback for all user interactions

## Integration with Python Scraper

This dashboard is designed to work with the existing Python TikTok scraper. To integrate:

1. **API Integration**: Modify the Python scraper to communicate with the dashboard's API endpoints
2. **Queue Processing**: Have the Python scraper poll the `/api/queue` endpoint for new jobs
3. **Status Updates**: Update job status through the API as processing progresses
4. **Results Storage**: Save completed results through the `/api/results` endpoint

## Customization

### Styling
- Modify `tailwind.config.js` to customize colors and themes
- Update `src/app/globals.css` for custom CSS
- Customize component styles in individual component files

### Functionality
- Add new API endpoints in `src/app/api/`
- Create new pages in `src/app/`
- Extend data models in `src/types/scraper.ts`
- Add new components in `src/components/`

## Environment Variables

For production deployment, you may want to set:

```bash
NODE_ENV=production
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the GitHub issues
2. Create a new issue with detailed description
3. Include steps to reproduce any bugs 