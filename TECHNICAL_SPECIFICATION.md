# AI Platform with MCP Integration - Technical Specification

## 📋 Project Overview

### Vision
Create a professional AI platform that provides Claude-like functionality with MCP server integration, custom prompt engineering, context engineering, and a monetization system for B2B customers.

### Core Value Proposition
- **Custom AI Assistant**: Branded AI interface with multiple model support
- **MCP Integration**: Dynamic connection to custom MCP servers
- **Enterprise Ready**: User management, billing, and subscription system
- **Revenue Generation**: Pay-per-use credits and subscription tiers

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   MCP Layer     │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Servers)     │
│                 │    │                 │    │                 │
│ - Chat UI       │    │ - API Gateway   │    │ - iplan-server  │
│ - User Mgmt     │    │ - Auth System   │    │ - Custom MCP    │
│ - Billing       │    │ - MCP Manager   │    │ - Future MCPs   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │  AI Providers   │    │  External APIs  │
│ (PostgreSQL)    │    │ - Claude API    │    │ - Payment Gw    │
│                 │    │ - OpenAI API    │    │ - Email Service │
│ - Users         │    │ - Gemini API    │    │ - Analytics     │
│ - Sessions      │    │ - Custom Models │    │                 │
│ - Billing       │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🎯 Feature Specifications

### 1. Frontend Application (React/Next.js)

#### User Interface Components
- **Chat Interface**: Similar to provided HTML design
  - Sidebar with navigation
  - Chat message area
  - Input field with send button
  - Message history
  
- **User Management**
  - Registration/Login
  - Profile management
  - Subscription status
  - Credit balance display

- **MCP Server Management**
  - Add/Remove MCP servers
  - Configure server parameters
  - Test server connections
  - View available tools

- **Prompt Engineering Studio**
  - Create custom prompts
  - Template library
  - Version control for prompts
  - A/B testing capabilities

- **Context Engineering Interface**
  - Context templates
  - Dynamic context injection
  - Context history
  - Performance metrics

#### Technical Requirements
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS + HeadlessUI
- **State Management**: Zustand
- **Authentication**: NextAuth.js
- **API Client**: Axios with interceptors
- **Real-time**: Socket.io-client

### 2. Backend API Server (Node.js/Express)

#### Core Services

##### Authentication Service
```javascript
// JWT-based authentication
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
DELETE /api/auth/logout
GET /api/auth/me
```

##### Chat Service
```javascript
// Chat management
POST /api/chat/sessions          // Create new chat session
GET /api/chat/sessions           // Get user chat sessions
GET /api/chat/sessions/:id       // Get specific session
POST /api/chat/sessions/:id/messages  // Send message
DELETE /api/chat/sessions/:id    // Delete session
```

##### MCP Management Service
```javascript
// MCP server management
GET /api/mcp/servers            // List configured servers
POST /api/mcp/servers           // Add new server
PUT /api/mcp/servers/:id        // Update server config
DELETE /api/mcp/servers/:id     // Remove server
POST /api/mcp/servers/:id/test  // Test server connection
GET /api/mcp/servers/:id/tools  // Get available tools
```

##### AI Provider Service
```javascript
// AI model integration
POST /api/ai/chat               // Send chat request
GET /api/ai/models              // List available models
POST /api/ai/stream             // Streaming chat response
```

##### Billing Service
```javascript
// Credit and subscription management
GET /api/billing/credits        // Get user credits
POST /api/billing/purchase      // Purchase credits
GET /api/billing/subscription   // Get subscription info
POST /api/billing/subscribe     // Create subscription
```

#### Technical Stack
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schemas
- **Rate Limiting**: Redis-based
- **Logging**: Winston
- **Testing**: Jest + Supertest

### 3. MCP Integration Layer

#### MCP Manager Component
```javascript
class MCPManager {
  async connectToServer(config)     // Connect to MCP server
  async disconnectServer(id)       // Disconnect server
  async listTools(serverId)        // Get available tools
  async callTool(serverId, tool, params)  // Execute tool
  async getServerStatus(serverId)  // Check server health
}
```

#### Server Configuration Schema
```javascript
{
  id: string,
  name: string,
  command: string,
  args: string[],
  env: Record<string, string>,
  enabled: boolean,
  userId: string,
  createdAt: Date,
  updatedAt: Date
}
```

### 4. Database Schema (PostgreSQL)

#### Core Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user',
  credits INTEGER DEFAULT 0,
  subscription_tier VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  model VARCHAR(50),
  system_prompt TEXT,
  context_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata JSONB,
  token_count INTEGER,
  cost_credits INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- MCP servers
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  command VARCHAR(255) NOT NULL,
  args JSONB DEFAULT '[]',
  env JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  last_health_check TIMESTAMP,
  health_status VARCHAR(20) DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Credit transactions
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'purchase' | 'usage' | 'refund'
  amount INTEGER NOT NULL,
  description TEXT,
  session_id UUID REFERENCES chat_sessions(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'active' | 'cancelled' | 'expired'
  credits_per_month INTEGER,
  price_per_month DECIMAL(10,2),
  billing_cycle_start DATE,
  billing_cycle_end DATE,
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 💰 Monetization Strategy

### Credit System
- **Token-based pricing**: 1 credit = ~1000 tokens
- **Model-specific rates**:
  - Claude Sonnet: 2 credits per 1000 tokens
  - Claude Haiku: 1 credit per 1000 tokens  
  - GPT-4: 3 credits per 1000 tokens
  - GPT-3.5: 1 credit per 1000 tokens

### Subscription Tiers

| Tier | Monthly Price | Credits Included | MCP Servers | Support |
|------|---------------|------------------|-------------|---------|
| Free | $0 | 1,000 | 1 | Community |
| Pro | $29 | 10,000 | 5 | Email |
| Business | $99 | 50,000 | 20 | Priority |
| Enterprise | Custom | Unlimited | Unlimited | Dedicated |

### Additional Revenue Streams
- **Custom MCP Development**: $500-2000 per server
- **Professional Services**: $150/hour consultation
- **Enterprise Licensing**: Custom pricing
- **API Access**: Usage-based pricing

---

## 🔧 Implementation Phases

### Phase 1: MVP (4 weeks)
- [ ] Basic frontend chat interface
- [ ] User authentication
- [ ] Claude API integration
- [ ] Single MCP server connection (iplan)
- [ ] Basic credit system

### Phase 2: Core Features (3 weeks)
- [ ] Multiple MCP server support
- [ ] Prompt engineering interface
- [ ] Context engineering
- [ ] Payment integration (Stripe)
- [ ] User dashboard

### Phase 3: Advanced Features (3 weeks)
- [ ] Multiple AI model support
- [ ] Advanced analytics
- [ ] Team collaboration features
- [ ] API rate limiting
- [ ] Admin panel

### Phase 4: Scale & Polish (2 weeks)
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation
- [ ] Marketing site
- [ ] Launch preparation

---

## 🚀 Development Workflow

### Git Strategy
- **Main branch**: Production-ready code
- **Develop branch**: Integration branch
- **Feature branches**: `feature/feature-name`
- **Hotfix branches**: `hotfix/issue-description`

### Commit Convention
```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Scopes: frontend, backend, mcp, db, auth, billing
```

### Quality Gates
- [ ] All tests pass
- [ ] Code coverage > 80%
- [ ] ESLint/Prettier compliance
- [ ] Security scan passes
- [ ] Performance benchmarks met

---

## 📊 Success Metrics

### Technical KPIs
- **Response Time**: < 2s for chat responses
- **Uptime**: 99.9% availability
- **Error Rate**: < 0.1% of requests
- **Test Coverage**: > 90%

### Business KPIs
- **User Acquisition**: 100 users in month 1
- **Revenue**: $5,000 MRR by month 3
- **Retention**: 80% monthly retention
- **NPS Score**: > 50

---

## 🔐 Security Considerations

### Authentication & Authorization
- JWT tokens with short expiry (15 minutes)
- Refresh token rotation
- Role-based access control (RBAC)
- Rate limiting per user/IP

### Data Protection
- Encryption at rest (database)
- Encryption in transit (HTTPS/WSS)
- PII data anonymization
- GDPR compliance ready

### MCP Security
- Sandboxed MCP server execution
- Input validation for all MCP calls
- Resource limits per server
- Audit logging for all operations

---

## 📋 Progress Tracking

### Completed ✅
- [x] Project initialization
- [x] Git repository setup
- [x] Technical specification

### In Progress 🟡
- [ ] Project structure setup

### Pending ⏳
- [ ] Frontend development
- [ ] Backend API development
- [ ] MCP integration
- [ ] Database setup
- [ ] Authentication system
- [ ] Billing system
- [ ] Testing & deployment

---

*Last Updated: 2025-01-27*
*Next Review: Weekly*