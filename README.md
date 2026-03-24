# Twix

An AI chat app where conversations can **branch**. Highlight any part of a response to open a side thread (called a "tangent"), explore that idea in depth, and merge your findings back — without losing your place in the main conversation.

Think of it like browser tabs, but for thoughts.

## What it does

**Branching conversations** — In a normal chatbot, you have one linear thread. In Twix, you can highlight any text the AI wrote, click "Open tangent", and a new side panel opens with a focused sub-conversation about just that topic. Tangents can branch into their own tangents, as deep as you want.

**Full context inheritance** — Every tangent automatically inherits the full conversation history from its parent. The AI always knows the bigger picture, even when you're five branches deep.

**Merge back** — When you're done exploring a tangent, merge it back into the parent thread. The AI generates a short summary of what was discussed, so you (and the AI) can reference it later.

**Web search** — When you ask about current events or recent topics, the AI automatically searches the web first and cites its sources inline.

## How it works under the hood

### The branching model

The database stores conversations as a **tree of threads**. Each conversation has one main thread (depth 0) and any number of child threads (tangents). Each tangent points back to:
- its **parent thread** (where it branched from)
- the specific **parent message** (the message the user highlighted)
- the **highlighted text** (what they selected)

This creates a tree structure: Main → Tangent A → Sub-tangent A1, etc.

### Context building — hierarchical compression + semantic RAG

When the AI responds in any thread, it needs to "see" the conversation history above it. Naively sending every ancestor message verbatim would cause token usage to explode as users branch deeper.

Twix solves this with three layered strategies:

#### 1. Hierarchical compression

The **context builder** (`lib/context-builder.ts`) compresses ancestor context based on distance — the further away an ancestor thread is, the more aggressively it gets compressed:

```
┌──────────────────────────────────────────────────────────────────────┐
│                      WHAT THE AI RECEIVES                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Grandparent+ (depth 0, 1, ...)        ░░ KNOWLEDGE ONLY     │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ [Thread Knowledge — ancestor thread (depth 0):           │  │  │
│  │  │   Topics: RSA encryption, key management                 │  │  │
│  │  │   Facts: RSA uses two primes p,q | n = p×q               │  │  │
│  │  │   Decisions: Use 2048-bit keys | Python implementation   │  │  │
│  │  │   User Preferences: Wants code examples ]                │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │  ~ 50-150 tokens per ancestor (was 2000+)                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                          │                                           │
│                    ▼ branched on "highlighted text"                   │
│                          │                                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Immediate parent (depth N-1)     ░░ KNOWLEDGE + RECENT MSGS │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ Structured knowledge of older messages                   │  │  │
│  │  ├──────────────────────────────────────────────────────────┤  │  │
│  │  │ Last 10 messages VERBATIM (up to branch point)           │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                          │                                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ★ Semantic retrieval block          ░░ CHERRY-PICKED MSGS   │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ Top 6 most relevant messages from ANY ancestor thread,   │  │  │
│  │  │ retrieved via pgvector cosine similarity (HNSW index)    │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                          │                                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Current thread (depth N)               ░░ FULL DETAIL        │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │ ALL messages in full                                     │  │  │
│  │  │ + merged tangent knowledge injected at merge points      │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### 2. Conversation-tree RAG (pgvector)

Most RAG systems search flat document stores. Twix does **topology-aware semantic retrieval** over the conversation tree:

- Every message is embedded at write time using `text-embedding-3-small` (1536 dimensions)
- Embeddings are stored as pgvector columns with an HNSW index for fast cosine similarity
- When building context, the user's current message is embedded and compared against **all ancestor thread messages**
- The top-K most semantically relevant messages are cherry-picked and injected, regardless of how far back they occurred

This means a tangent about "RSA key rotation" branched from a 50-message CS lecture will pull in the cryptography messages from 40 messages ago — not the unrelated sorting algorithm discussion from 5 messages ago.

```
  User message: "How do we handle key rotation?"
         │
         ▼  embed query → [0.12, -0.34, ...]
         │
         ▼  cosine similarity search (HNSW index)
         │  scoped to ancestor thread IDs only
         │
    ┌────┴──────────────────────────────────────┐
    │  Ancestor threads (recursive CTE)          │
    │                                            │
    │  Main thread (50 msgs)                     │
    │    msg #7:  "RSA uses two large primes"    │  sim: 0.89 ★
    │    msg #12: "Key generation process..."    │  sim: 0.85 ★
    │    msg #31: "Bubble sort comparison..."    │  sim: 0.23 ✗
    │                                            │
    │  Tangent A (15 msgs)                       │
    │    msg #3:  "Public key distribution..."   │  sim: 0.82 ★
    │    msg #8:  "Certificate authorities..."   │  sim: 0.79 ★
    │                                            │
    └────────────────────────────────────────────┘
         │
         ▼  inject top 6 (above 0.6 threshold)
         │  deduplicated against already-included messages
         │
    [Semantically retrieved ancestor messages]
```

#### 3. Structured knowledge distillation

Instead of compressing conversations into lossy paragraph summaries, Twix distills them into **structured, queryable knowledge**:

```json
{
  "topics": ["RSA encryption", "key management"],
  "facts": ["RSA uses two large primes p and q", "Public key is (n, e) where n = p×q"],
  "decisions": ["Will use 2048-bit keys", "Python implementation with PyCryptodome"],
  "openQuestions": ["How to handle key rotation?"],
  "preferences": ["Wants code examples with every explanation"],
  "entities": { "RSA": "asymmetric encryption algorithm", "PyCryptodome": "Python crypto library" }
}
```

Why structured knowledge beats paragraph summaries:
- The LLM can **scan structured context faster** and more accurately
- Cross-branch knowledge can be **merged cleanly** (union facts, resolve conflicts)
- **Contradictions** across branches become detectable
- Individual fields can be **selectively injected** based on relevance

Knowledge is generated eagerly (fire-and-forget after every assistant response) and stored as JSONB on the thread row.

#### Full request flow

```
  User sends message
         │
    ┌────┴─────────────────────────────────────────────────────────┐
    │  IN PARALLEL:                                                │
    │  ┌─────────────┐  ┌──────────────────┐  ┌────────────────┐  │
    │  │ Verify       │  │ Build context    │  │ Persist user   │  │
    │  │ thread +     │  │ (hierarchical    │  │ message to DB  │  │
    │  │ auth         │  │  compression +   │  │                │  │
    │  │              │  │  semantic RAG)   │  │                │  │
    │  └─────────────┘  └──────────────────┘  └───────┬────────┘  │
    └──────────────────────────────────────────────────┼───────────┘
                                                       │
                                              fire-and-forget:
                                              embed user message
                                              (text-embedding-3-small)
         │
         ▼
  Stream AI response to client
         │
         ▼
  ┌──────────────────────────────────────────────┐
  │  ON FINISH (fire-and-forget, non-blocking):  │
  │                                              │
  │  1. Persist assistant message                │
  │  2. Embed assistant message (pgvector)       │
  │  3. Maybe update thread knowledge:           │
  │     ┌────────────────────────────────────┐   │
  │     │ 20+ new msgs since last update?    │   │
  │     │  yes → distill structured knowledge│   │
  │     │        + generate plain summary    │   │
  │     │        → store both on thread row  │   │
  │     │  no  → skip                        │   │
  │     └────────────────────────────────────┘   │
  │  4. Maybe auto-title conversation            │
  └──────────────────────────────────────────────┘
```

### State management

The client uses **Zustand** (a lightweight React state library) with four stores:
- **Tangent store** — tracks which tangent panels are open, which is active, parent-child relationships
- **Chat store** — per-thread chat state
- **Conversation store** — sidebar conversation list
- **UI store** — sidebar open/closed, etc.

The tangent store handles cascade closing (closing a parent closes all its children) and tab switching (when a thread has multiple child tangents, only one is visible at a time).

### AI streaming

Chat uses the **Vercel AI SDK v6** with `streamText()`. The AI response streams token-by-token to the client via `useChat`. The AI also has access to **tools** — functions it can call mid-response:

| Tool | What it does |
|------|-------------|
| `webSearch` | Searches the web via Tavily API, returns top results with snippets |

## Tech stack

| Layer | Technology | What it is |
|-------|-----------|------------|
| Framework | **Next.js 16** (App Router) | Full-stack React framework — handles both the UI and the API |
| Language | **TypeScript** | JavaScript with type checking |
| Database | **PostgreSQL** + **Prisma v7** | Relational database + ORM with typed queries |
| Vector search | **pgvector** (HNSW index) | Semantic similarity search over message embeddings |
| Embeddings | **OpenAI text-embedding-3-small** | 1536-dimension embeddings for conversation-tree RAG |
| Auth | **NextAuth v5** | Handles login, sessions, and protecting routes |
| AI | **OpenAI GPT-4.1-nano** via **Vercel AI SDK v6** | LLM for chat, knowledge distillation, and summaries |
| State | **Zustand** | Lightweight client-side state management |
| Styling | **Tailwind CSS v4** | Utility-first CSS framework |
| Code editor | **CodeMirror** (via `@uiw/react-codemirror`) | In-browser code editor with syntax highlighting |
| Math rendering | **KaTeX** | Renders LaTeX math equations in responses |
| Markdown | **react-markdown** + remark/rehype plugins | Renders AI responses as formatted HTML |
| Web search | **Tavily** | API for real-time web search results |
| Testing | **Vitest** + **Testing Library** | Unit testing framework |

## Live Demo

Deployed on **Vercel** with **Neon** (serverless PostgreSQL): [twix-chat.vercel.app](https://twix-chat.vercel.app/)

## Setup

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** running locally (or a remote connection string) — must support the `pgvector` extension
- An **OpenAI API key**

### 1. Clone and install

```bash
git clone <your-repo-url>
cd tenex
npm install
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```env
# Required
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/twix"
AUTH_SECRET="run-npx-auth-secret-to-generate-this"
AUTH_URL="http://localhost:3000"
OPENAI_API_KEY="sk-..."

# Optional — enables web search
TAVILY_API_KEY=""
```

Generate `AUTH_SECRET` by running:
```bash
npx auth secret
```

### 3. Set up the database

```bash
# Create the database (if using local PostgreSQL)
createdb twix

# Run migrations to create all the tables
npx prisma migrate dev

# (Optional) Seed with a test user and sample conversation
npx prisma db seed
# Creates: test@twix.dev / password123
```

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up or use the test account.

### Other commands

```bash
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run tests (Vitest)
npm run format       # Format code (Prettier)
```

## Project structure

```
tenex/
├── app/                        # Next.js App Router pages & API routes
│   ├── (auth)/                 # Login & register pages
│   ├── (chat)/                 # Main chat interface
│   │   └── c/[conversationId]/ # Individual conversation page
│   └── api/
│       ├── chat/route.ts       # AI streaming endpoint (main brain)
│       ├── conversations/      # CRUD for conversations
│       └── threads/            # Thread operations (branch, merge, messages)
├── components/
│   ├── chat/                   # Chat UI (messages, input, code blocks)
│   ├── auth/                   # Login/register forms
│   ├── landing/                # Landing page
│   └── layout/                 # Sidebar, navigation
├── hooks/                      # React hooks (useChat wrapper, text selection, etc.)
├── lib/
│   ├── context-builder.ts      # Hierarchical compression + semantic RAG (core algorithm)
│   ├── embeddings.ts           # pgvector embedding generation + similarity search
│   ├── knowledge.ts            # Structured knowledge distillation (generateText + Zod schema)
│   ├── thread-summarizer.ts    # Eager summarization + knowledge distillation orchestrator
│   ├── merge.ts                # AI summary generation for merges
│   ├── ai.ts                   # Model config & system prompt
│   └── prisma.ts               # Database client
├── store/                      # Zustand stores (tangent, chat, conversation, ui)
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Test data seeder
└── types/                      # TypeScript type definitions
```

## Database schema (simplified)

```
User ──< Conversation ──< Thread ──< Message
                              │           │
                              │           └── embedding vector(1536)  ← pgvector
                              │
                              ├── parentThreadId  (points to parent thread)
                              ├── parentMessageId (the message that was highlighted)
                              ├── highlightedText (what the user selected)
                              ├── depth           (0 = main, 1+ = tangent)
                              ├── status          (ACTIVE / MERGED / ARCHIVED)
                              ├── summary         (plain text paragraph)
                              └── knowledge       (JSONB — structured distillation)

MergeEvent
  ├── sourceThreadId  (the tangent being merged)
  ├── targetThreadId  (the parent thread receiving it)
  ├── afterMessageId  (where in the parent to insert the summary)
  └── summary         (AI-generated summary of the tangent)
```
