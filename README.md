# TicketPilot AI

<!-- HOW TO EDIT THE LINKS ABOVE
1. Live demo: after you deploy, replace TODO-add-live-demo-link with your Vercel address.
2. Demo video: replace TODO-add-demo-video-link with your LinkedIn post or YouTube link.
Until you have a link, delete that word and the "|" next to it.
Also change the Status line below after you deploy. -->

An AI-assisted customer support desk for a made-up software company called **Orbitly**.

A customer raises a ticket. An AI agent reads it, finds help articles, and writes a draft reply. **A person checks the draft before anything is sent.** Risky requests, like refunds, are never answered by the AI. They go straight to a person.

**Status:** works on my computer. Not deployed yet.

> This is a learning and portfolio project. All data is dummy data.

## [**Live demo**](TODO-add-live-demo-link) | [**Demo video**](TODO-add-demo-video-link) | [Source code](https://github.com/asim-momin-7864/ticket-pilot-ai-app)

## Screenshots

<!-- Save each picture in docs/screenshots with the file name shown below. Use the same theme (light or dark) for all of them. Do not show private data or keys. If you skip a screenshot, delete its title and its image line. -->

**Home page**

![Home page](docs/screenshots/home.png)

**Raise Ticket page**

![Raise Ticket page](docs/screenshots/raise-ticket.png)

**Ticket status page (customer view)**

![Ticket status page](docs/screenshots/ticket-status.png)

**My Tickets page**

![My Tickets page](docs/screenshots/my-tickets.png)

**Staff login page**

![Staff login page](docs/screenshots/staff-login.png)

**Admin inbox**

![Admin inbox](docs/screenshots/inbox.png)

**Admin ticket page with the AI draft and sources**

![Admin ticket page](docs/screenshots/ai-draft.png)

**Admin overview dashboard**

![Admin overview](docs/screenshots/dashboard.png)

**n8n workflow (send email)**

![n8n send email workflow](docs/screenshots/n8n.png)

**Slack message for an escalated ticket**

![Slack escalation message](docs/screenshots/slack.png)

---

## What does this project do?

1. A customer fills in a short form to **raise a ticket**. No account is needed.
2. The customer gets a private link to see the ticket status.
3. An **AI agent** cleans the message, works out what it is about, and checks the safety rules.
4. If the ticket is safe, the agent searches the **knowledge base** (help articles) and writes a draft reply with sources.
5. If the ticket is risky (refund, cancellation, billing details, legal, security, personal data), the agent does **not** answer. The ticket is marked **Escalated** and the team is told in Slack.
6. A staff member opens the ticket in the admin area and can **Approve**, **Edit and approve**, or **Escalate**.
7. After approval, the reply is sent to the customer by email through **n8n**.

**The golden rule:** the AI only suggests. A person decides.

---

## Features

**Customer side (no login)**

- Raise a ticket with name, email, subject and message
- Ticket status page with 4 steps: Received, Analyzing, Escalated, Replied
- See the replies from support on the status page, with a Refresh button
- My Tickets page with recent tickets (demo only, see "Known limits")

**Staff side (login needed)**

- Inbox with tabs: Needs review, Escalated, Replied, Failed. A panel at the top shows tickets that the AI is still working on
- Ticket page with the conversation, the AI draft, the sources it used, and a simple event log
- Approve, Edit and approve, or Escalate a draft
- Re-run button for tickets where the AI step failed
- Overview page with counts, tickets by department, and how staff reviewed the AI drafts

**Safety**

- A person approves every reply before it is sent
- Rules written in code (not in a prompt) decide which tickets must go to a person
- Staff pages are protected in three places: the page, the server action, and the database
- Spam protection: a hidden form field and a limit of 5 tickets per hour for each email

---

## How a ticket moves

![Ticket flow](docs/screenshots/ticket-flow.png)

<!-- file: docs/screenshots/ticket-flow.png (a diagram of the flow below; delete this image line if you do not have one) -->

```
Customer raises a ticket
        |
        v
Ticket saved in Supabase (status PROCESSING)  --->  Customer gets a private status link
        |
        v   (runs in the background)
AI agent starts
   1. Clean the message
   2. Understand it (what it is about, which department, how urgent, how sure the AI is)
   3. Safety rules in code: is it risky?
        |
        +-- Risky (or not sure)  --->  Status ESCALATED  --->  Slack message to the team + holding email (n8n)
        |
        +-- Safe   --->  4. Search the knowledge base
                         5. Write a draft reply with sources
                         6. Check that every source is a real article that was found
                         7. Save the draft, status PENDING_REVIEW
                                   |
                                   v
                         Staff reviews the draft
                           - Approve
                           - Edit and approve
                           - Escalate
                                   |
                                   v
                         Reply saved + email sent (n8n)
                         Status REPLIED
```

When does a ticket go to a person instead of getting a draft?

- The topic is risky: refund, cancellation, billing details, legal, security or personal data
- The customer asks about their own account data, or asks for a human
- The AI is not sure (confidence below 0.5)
- No help article matches the question
- The draft cites an article that was not found (it is rejected)

If the AI step crashes, the ticket is **Failed**, and staff press **Re-run**.

### Ticket statuses

| Status         | Meaning                                                            |
| -------------- | ------------------------------------------------------------------ |
| PROCESSING     | The AI agent is working on it                                      |
| PENDING_REVIEW | A draft is ready and waits for a staff member                      |
| ESCALATED      | A person must handle it                                            |
| REPLIED        | A reply was sent                                                   |
| RESOLVED       | Reserved for later. Nothing sets it yet, so tickets end at REPLIED |
| FAILED         | Something went wrong; staff can press Re-run                       |

Customers see a 4-step bar: Received, Analyzing, Escalated, Replied.

### Who does what

- **Next.js** shows the pages and runs the server actions.
- **The agent code** (LangGraph) decides what to do with a ticket.
- **Supabase** stores tickets, messages, events and the knowledge base.
- **n8n** only delivers messages (email and Slack). It never makes decisions.

---

## Tech stack

| Part                    | Tool                                                    |
| ----------------------- | ------------------------------------------------------- |
| Framework               | Next.js 16 (App Router), React 19, TypeScript           |
| Styling                 | Tailwind CSS v4, shadcn/ui                              |
| Database and login      | Supabase (Postgres, Auth, Row Level Security, pgvector) |
| AI agent                | LangGraph.js                                            |
| AI model                | Google Gemini, through the Vercel AI SDK                |
| Checking data           | Zod                                                     |
| Sending email and Slack | n8n                                                     |

---

## Database

The database has 5 tables, 2 dashboard views and 3 small functions. The full SQL is in `docs/ticketpilot_schema.sql`.

| Name                   | What it is for                                                          |
| ---------------------- | ----------------------------------------------------------------------- |
| `profiles`             | Staff users only (role ADMIN or AGENT). Customers have no row           |
| `tickets`              | One row per ticket, with status, department, priority and the link code |
| `ticket_messages`      | Customer messages, AI drafts and staff replies                          |
| `ticket_events`        | A log of everything that happened (also shown as the event log)         |
| `kb_chunks`            | Help articles cut into small pieces, each with an AI embedding          |
| `match_kb_chunks`      | Function that finds the pieces closest in meaning to a question         |
| `is_staff`, `is_admin` | Small helper functions used by the security rules                       |
| `dashboard_*` views    | Counts for the admin overview page                                      |

---

## Project structure

```
src/
  proxy.ts          Refreshes the login and protects /admin
  actions/          Server actions (create ticket, review ticket, re-run, login, sign out)
  app/              Pages
    page.tsx          Home page
    support/          Customer pages (new ticket, my tickets, ticket status)
    login/            Staff login
    admin/            Staff pages (overview, inbox, ticket page)
  components/       Forms, header and shadcn/ui components
  lib/
    agent/            The AI agent (clean, classify, rules, search, draft, escalate, graph)
    integrations/     Code that talks to n8n
    supabase/         Supabase clients (server, admin, proxy)
    require-staff.ts  Checks that the user is staff
kb/                 Help articles (markdown) and internal playbooks
docs/
  ticketpilot_schema.sql   Database tables and security rules
  seed.sql                 Demo tickets
  sample-tickets.md        Example messages to try
  n8n/                     n8n workflows (send email, notify Slack)
  screenshots/             Pictures for this README
scripts/
  ingest-kb.ts             Loads the help articles into the database
```

---

## Pages

| Page          | Address               | Who can open it                              |
| ------------- | --------------------- | -------------------------------------------- |
| Home          | `/`                   | Everyone                                     |
| Raise Ticket  | `/support/new`        | Everyone                                     |
| My Tickets    | `/support/my-tickets` | Everyone                                     |
| Ticket status | `/support/<code>`     | Anyone with the link                         |
| Staff login   | `/login`              | Everyone (a logged-in user goes to `/admin`) |
| Inbox         | `/admin/inbox`        | Staff only                                   |
| Ticket page   | `/admin/tickets/<id>` | Staff only                                   |
| Overview      | `/admin`              | Staff only                                   |

---

## AI details

| Item                     | Value                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| AI provider              | Google Gemini, through `@ai-sdk/google` and the Vercel AI SDK      |
| Chat model               | Set by `LLM_MODEL` (I use `gemini-3.1-flash-lite`)                 |
| Embedding model          | Set by `EMBEDDING_MODEL` (I use `gemini-embedding-001`)            |
| Vector size              | 768 (`EMBEDDING_DIM`). It must match the database column           |
| Help articles used       | Up to 4 per ticket, with similarity above 0.6                      |
| Confidence limit         | Below 0.5 goes to a person                                         |
| AI time limit            | 45 seconds per call, with 2 retries                                |
| Customer text in prompts | Treated as data. The prompt says to ignore instructions inside it  |
| Citations                | Checked in code. A draft that cites an unknown article is rejected |
| Replies                  | The prompt forbids promising refunds, credits or time limits       |

The help articles are public (the AI may use them) or internal (never used for customer answers).

---

## Run it on your computer

### What you need

- Node.js 20 or newer, and npm
- A free [Supabase](https://supabase.com) project
- A Google Gemini API key from Google AI Studio
- (Optional) An [n8n](https://n8n.io) instance, a Gmail account and a Slack workspace for real emails and Slack messages

### Steps

**1. Get the code and install**

```bash
git clone <your-repo-url>
cd ticket-pilot-ai-app
npm install
```

**2. Set up the database**

In the Supabase dashboard, open the **SQL Editor** and run these files in this order. Use a new, empty project.

1. `docs/ticketpilot_schema.sql`
2. `docs/seed.sql` (15 demo tickets)

**3. Create your staff account**

This app has no sign-up page on purpose. Staff accounts are made by hand:

1. In Supabase, go to **Authentication > Users > Add user**. Enter an email and a password.
2. Copy the new user's ID.
3. In the SQL Editor, run this with your ID:

```sql
insert into public.profiles (id, full_name, role)
values ('<paste-user-id-here>', 'Demo Staff', 'ADMIN');
```

4. In Supabase, turn off public sign-ups (Authentication settings) so nobody else can create an account.

**4. Add your environment variables**

Copy `.env.example` to `.env.local` and fill in the values:

| Variable                               | Needed?  | What it is                                                               |
| -------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Required | Your Supabase project address                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Required | Supabase public key                                                      |
| `SUPABASE_SECRET_KEY`                  | Required | Server-only key. Never share it                                          |
| `GOOGLE_GENERATIVE_AI_API_KEY`         | Required | Google Gemini key                                                        |
| `LLM_MODEL`                            | Required | Gemini model for classify and draft, for example `gemini-3.1-flash-lite` |
| `EMBEDDING_MODEL`                      | Required | Embedding model, for example `gemini-embedding-001`                      |
| `EMBEDDING_DIM`                        | Required | Size of the embedding. Must be `768`                                     |
| `APP_BASE_URL`                         | Optional | `http://localhost:3000` on your computer. Used for links in Slack        |
| `DEMO_MODE`                            | Optional | `true` shows an email preview instead of sending the email               |
| `N8N_BASE_URL`                         | Optional | Address of your n8n                                                      |
| `N8N_SHARED_SECRET`                    | Optional | Secret shared with n8n                                                   |

> Never commit `.env.local`. The secret key must stay on the server. Never put it in code that runs in the browser.

**5. Load the help articles**

```bash
npm run ingest
```

This reads the markdown files in `kb/`, cuts them into pieces, makes embeddings with Gemini, and saves them in Supabase. Without this step, the agent finds no articles and escalates every ticket.

**6. (Optional) Set up n8n**

1. Import the two files from `docs/n8n/` into n8n: `w2-send-email.json` and `w3-notify-slack.json`.
2. Connect your Gmail and Slack accounts inside n8n.
3. Put the n8n address and the shared secret into `.env.local`. The app calls the webhooks `/webhook/send-email` and `/webhook/notify-slack` and sends the secret in the `x-shared-secret` header.

If you skip this step, the app still works. Tickets, drafts and reviews work fine. Only the email and Slack messages are missing.

**7. Start the app**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful commands

| Command          | What it does                             |
| ---------------- | ---------------------------------------- |
| `npm run dev`    | Start the app for development            |
| `npm run build`  | Make a production build                  |
| `npm run start`  | Run the production build                 |
| `npm run lint`   | Check the code style                     |
| `npm run ingest` | Load the help articles into the database |

### Demo mode

With `DEMO_MODE=true`, the app does not send emails to customers. It saves an `email_preview` event instead. Slack messages are still sent if n8n is set up.

---

## Try it yourself

More example messages are in `docs/sample-tickets.md`.

1. Open **Raise Ticket** and send: `How do I enable SSO?` Wait a little. The AI writes a draft.
2. Send a second ticket: `I was charged by mistake and I want a refund.` This one should be **Escalated** with no AI answer.
3. Go to **Staff login** and sign in.
4. Open the **Inbox**. The SSO ticket is under **Needs review**. The refund ticket is under **Escalated**.
5. Open the SSO ticket. Read the draft and the sources. Press **Approve**.
6. Open the ticket status page and see the reply.

### Demo login for visitors

| Role  | Email                                                   | Password  |
| ----- | ------------------------------------------------------- | --------- |
| Staff | [demo-staff@example.com](mailto:demo-staff@example.com) | demo12345 |

This is a demo account with dummy data. In demo mode, no real email is sent.

---

## How it stays safe

- **A person approves every AI reply.** The agent saves a draft. Only the review action can send it.
- **Safety rules are code.** The list of risky topics is in `src/lib/agent/policy.ts`. A prompt cannot talk the code out of it.
- **Customer text is treated as data**, not as instructions.
- **The AI is checked.** Its answers must match a Zod schema, and every source it cites must be an article that was really found.
- **No accounts for customers.** Each ticket gets a long random link.
- **Staff checks in every action.** Each staff server action calls `requireStaff()` first. Hiding a page is not enough. The proxy also sends logged-out visitors from `/admin` to the login page.
- **Database rules (RLS).** Only staff can read tickets. The app writes to the database from the server with the secret key, so normal users have no write rights at all.
- **Knowledge base search is server only.** Normal users cannot call the search function. It returns only public, current articles, so internal notes never reach customers.
- **Double-click safe.** The review action claims the ticket first in one database step, so two clicks cannot send two replies.
- **Spam control.** A hidden form field catches bots, and each email can raise 5 tickets per hour.
- **No secrets in the repo.** Keys live in `.env.local`.

---

## What I did not build, and known limits

I want to be honest about what this project does not do:

- **My Tickets shows recent tickets for everyone.** It shows the latest 50 tickets. I did this to keep the demo simple. In a real product, a customer would see only their own tickets.
- **The private link code is a random ID stored as it is.** It is not hashed. A real product would store only a hash.
- **One staff account, made by hand.** There is no sign-up page and no team page.
- **No inbound email.** Tickets come from the web form only.
- **No customer follow-ups.** A customer cannot reply on a ticket after it is answered.
- **No live updates.** Staff and customers reload the page to see changes.
- **No "Resolved" button.** The status exists in the database, but nothing sets it yet.
- **No charts over time.** The overview shows simple counts only.
- **No automated tests yet.** I test by hand with the examples in `docs/sample-tickets.md`.
- **AI usage has only a small limit.** Each email can raise 5 tickets per hour, and there is no overall daily limit. If the Gemini quota runs out, a ticket ends as FAILED and staff can press Re-run.
- **All data is dummy data.** Do not enter real personal information.

---

## What I learned

- How to build a multi-step AI agent with branches (answer or escalate)
- Why safety rules belong in code and not in a prompt
- How to keep a human in the loop before an AI reply is sent
- How Row Level Security, server actions and staff checks work together
- How to use n8n only for sending messages, and keep decisions in my own code
- How to turn help articles into embeddings and search them by meaning
- How to run work in the background after a request, and what to do when it fails

---

## How I used AI while building

I used AI assistants to explain ideas, review code, fix errors and help write this README. I ran and tested the code myself and decided which features to keep or cut. I am still learning.

---

## Author

Built by **Asim Momin** as a portfolio project.

[GitHub](https://github.com/asim-momin-7864) · [LinkedIn](http://www.linkedin.com/in/asim-momin7864) · Email: TODO

<!-- Add your email and, if you have one, your portfolio link. -->
