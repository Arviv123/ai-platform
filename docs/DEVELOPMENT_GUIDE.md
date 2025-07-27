# Development Guide

## Prerequisites

### Required Software
- **Node.js 20+**: [Download](https://nodejs.org/)
- **PostgreSQL 15+**: [Download](https://www.postgresql.org/download/)
- **Redis**: [Download](https://redis.io/download) (for rate limiting)
- **Git**: [Download](https://git-scm.com/)

### Optional Tools
- **Docker**: For containerized development
- **pgAdmin**: PostgreSQL management GUI
- **Postman/Insomnia**: API testing
- **VS Code**: Recommended IDE with extensions:
  - ES7+ React/Redux/React-Native snippets
  - Prettier
  - ESLint
  - Prisma
  - Tailwind CSS IntelliSense

## Initial Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd ai-platform
npm run install:all
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb aiplatform

# Copy environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed
```

### 3. API Keys Setup
Edit `.env` file with your API keys:
- Get Claude API key from [Anthropic Console](https://console.anthropic.com/)
- Get OpenAI API key from [OpenAI Platform](https://platform.openai.com/)
- Get Stripe keys from [Stripe Dashboard](https://dashboard.stripe.com/)

### 4. Start Development
```bash
npm run dev
```

This will start:
- Frontend at http://localhost:3000
- Backend at http://localhost:3001
- Database viewer at http://localhost:5555 (run `npm run db:studio`)

## Project Structure

```
ai-platform/
├── frontend/                 # Next.js frontend
│   ├── app/                 # App router pages
│   ├── components/          # Reusable components
│   ├── lib/                 # Utilities and configurations
│   ├── stores/              # Zustand state management
│   └── styles/              # Global styles
├── backend/                 # Express.js backend
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── services/        # Business logic
│   │   ├── models/          # Database models (Prisma)
│   │   ├── routes/          # API routes
│   │   └── utils/           # Helper functions
│   ├── prisma/              # Database schema and migrations
│   └── tests/               # Test files
├── mcp-manager/             # MCP integration layer
│   ├── src/
│   │   ├── manager/         # MCP server management
│   │   ├── protocols/       # Protocol implementations
│   │   └── types/           # TypeScript definitions
└── docs/                    # Documentation
```

## Development Workflow

### Branching Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/feature-name`: New features
- `fix/bug-description`: Bug fixes
- `hotfix/critical-fix`: Production hotfixes

### Commit Convention
```
type(scope): description

Examples:
feat(auth): add JWT refresh token functionality
fix(mcp): resolve server connection timeout issue
docs(api): update authentication endpoints documentation
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
Scopes: `frontend`, `backend`, `mcp`, `db`, `auth`, `billing`, `ui`

### Code Quality
```bash
# Run linting
npm run lint

# Run tests
npm run test

# Type checking (if using TypeScript)
npm run type-check

# Format code
npm run format
```

## Common Development Tasks

### Adding a New API Endpoint

1. **Define the route** in `backend/src/routes/`
2. **Create controller** in `backend/src/controllers/`
3. **Add business logic** in `backend/src/services/`
4. **Update database schema** if needed in `backend/prisma/schema.prisma`
5. **Write tests** in `backend/tests/`

Example:
```javascript
// backend/src/routes/chat.js
router.post('/sessions', authMiddleware, chatController.createSession);

// backend/src/controllers/chatController.js
exports.createSession = async (req, res) => {
  try {
    const session = await chatService.createSession(req.user.id, req.body);
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
```

### Adding a New Frontend Component

1. **Create component** in `frontend/components/`
2. **Add to Storybook** (if using)
3. **Write tests** in `frontend/__tests__/`
4. **Update type definitions** if needed

Example:
```jsx
// frontend/components/ChatMessage.jsx
import { memo } from 'react';

const ChatMessage = memo(({ message, isUser }) => {
  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      {message.content}
    </div>
  );
});

export default ChatMessage;
```

### Database Changes

1. **Update schema** in `backend/prisma/schema.prisma`
2. **Create migration**: `npx prisma migrate dev --name description`
3. **Update seed data** if needed in `backend/prisma/seed.js`
4. **Update types** and services

### Adding MCP Server Support

1. **Define server config** in `mcp-manager/src/types/`
2. **Implement connection logic** in `mcp-manager/src/manager/`
3. **Add to server registry**
4. **Update frontend UI** for server management

## Testing

### Backend Testing
```bash
cd backend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage
npm run test:integration   # Integration tests only
```

### Frontend Testing
```bash
cd frontend
npm test                   # Run all tests
npm run test:watch        # Watch mode
npm run test:e2e          # End-to-end tests
```

### Test Structure
- **Unit tests**: Individual functions/components
- **Integration tests**: API endpoints, database operations
- **E2E tests**: Full user workflows

## Debugging

### Backend Debugging
- Use VS Code debugger with Node.js configuration
- Add breakpoints in code
- Use `console.log` strategically
- Check logs in `backend/logs/`

### Frontend Debugging
- Use browser DevTools
- React DevTools extension
- Network tab for API calls
- Console for errors and logs

### Database Debugging
```bash
# Access database directly
npm run db:studio

# View query logs
tail -f backend/logs/database.log

# Reset database
npm run db:reset
```

## Environment Management

### Development
- Uses `.env` file
- Local database
- Mock payment processing
- Detailed logging

### Testing
- Uses `.env.test` file
- Test database
- Mocked external services
- Minimal logging

### Production
- Environment variables set in deployment platform
- Production database
- Real payment processing
- Error-level logging only

## Performance Tips

### Backend
- Use database indexes appropriately
- Implement caching with Redis
- Use connection pooling
- Monitor API response times

### Frontend
- Implement code splitting
- Use React.memo for expensive components
- Optimize bundle size
- Implement virtual scrolling for long lists

### Database
- Use proper indexes
- Avoid N+1 queries
- Use pagination for large datasets
- Monitor slow queries

## Troubleshooting

### Common Issues

**Database connection errors:**
```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Reset database
npm run db:reset
```

**Port already in use:**
```bash
# Find process using port
lsof -i :3000
# Kill process
kill -9 <PID>
```

**Module not found errors:**
```bash
# Clear node_modules and reinstall
npm run clean
npm run install:all
```

**MCP server connection issues:**
- Check server configuration
- Verify server executable exists
- Check server logs
- Test server independently

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with tests
4. Run quality checks: `npm run lint && npm run test`
5. Commit with conventional format
6. Push and create Pull Request

## Getting Help

- Check existing documentation
- Search through GitHub issues
- Ask in team Discord/Slack
- Contact lead developer

---

Happy coding! 🚀