# My Project

## What I'm building
A strength logging tool that is easy to use and minimalistic.
It contains an AI coach that lets you build a weekly program, workouts, and templates.
It then analyzes each workout and your progress each week.

## Who I am
I am not a developer. I do not know how to code.
Please communicate with me accordingly at all times.

## Start of Every Session
**Read `/Users/jess/v2/plan.md` first and tell me where we left off** based on the task checkboxes and Session Log. Don't ask — just read it and orient yourself quickly.

## How to communicate with me
- Before doing ANYTHING, explain in plain English what you're about to do and why
- When you need me to make a decision, always give me numbered options like this:
  ```
  Here are your choices:
  1. [Option] — this means [outcome]. Good if you want [result]
  2. [Option] — this means [outcome]. Good if you want [result]
  Which do you prefer?
  ```
- After finishing a task, summarize what changed in 1-2 sentences
- Never use technical terms without explaining them first
- If something breaks, tell me in plain English what went wrong before trying to fix it
- **Before each task AND before entering plan mode**, tell me which Claude model would be best to use and why (Haiku for simple tasks, Sonnet for most tasks, Opus for complex ones), then use it to save tokens

## Decision-making rules
- Always ask me before making big structural changes
- Prefer simple solutions over clever ones
- When in doubt, do less and ask me first
- Never delete anything without warning me first

## How I want to save money (tokens)
- Use Plan mode for any task that will touch more than 2 files
- Do one thing at a time — don't try to fix everything at once
- Commit to git after each working feature

## My tech stack
- Vite + React 19 + TypeScript (single-page app, NOT Next.js)
- Database: Dexie (IndexedDB) — fully client-side, no backend database
- AI: OpenAI via serverless proxy function (API key stays server-side)
- PWA: vite-plugin-pwa with offline support and installable app
- Styling: plain CSS + clsx utility
- Charts: recharts
- Icons: lucide-react

## Deployment
This deploys to Vercel via GitHub (push to main = auto-deploy).

**How it works:**
- Vercel runs `npm run build` which produces static files in `dist/`
- AI calls go through a serverless function at `api/openai/v1/chat/completions.js` — this keeps the OpenAI key server-side
- The `.env.production` file enables proxy mode automatically for production builds

**Vercel dashboard setup:**
- `OPENAI_API_KEY` must be set as an environment variable (Production only)
- NEVER set `VITE_OPENAI_API_KEY` in Vercel — the VITE_ prefix bakes it into the JavaScript bundle and exposes it to users

**Before deploying, always:**
1. Run `npm run build` locally to check for errors
2. Run `npm run test:run` to make sure tests pass

**Cloud Run files** (Dockerfile, server/) are kept for possible future use but are not part of the Vercel deployment.

## Things I always want
- Save points: commit to git after every feature that works
- Simple code that's easy to change later
- Tell me if something will cost money to run

## Things I never want
- Surprise large changes
- Multiple things changed at once
- Jargon without explanation
