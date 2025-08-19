# 🏀 League Management System (MVP)

A basketball league management webapp supporting **team registration**, **league schedules**, and **standings**.

## Priorities
1. **Registration**: team creation, member invites, player validation, dues.
2. **Scheduling**: league & team-specific schedules (PDF for MVP).
3. **Standings & Scores**: game results, league standings (future).

---

## User Roles
- **Player**  
  Can join one team per league. Sees their roster, schedule, standings.  
- **Manager (scoped role)**  
  A **player** with additional rights **within their team only**:  
  - Edit team name/description  
  - Invite other players (via one-time link or code)  
  - Their name is visually distinct on roster  
- **Admin**  
  Manages a specific league: approves teams, uploads schedules, records standings/results, views master roster.  
- **Super Admin**  
  Full visibility across all leagues and teams (for developers and basketball department head).  

---

## User Flows

### Public (not logged in)
- View all leagues → see teams (names + descriptions only), schedule PDFs, standings (placeholder).
- Prompt: _“To create or join a team, or to see your teams, please log in.”_

### Player
- Dashboard: list of teams (ones managed by player are visually distinct).  
- Create Team → select league, enter name + description.  
- Join Team → enter invite code or follow invite link.  
- Team Page:  
  - Team name + description (manager can edit).  
  - Approval state (set by admin).  
  - Roster (badge indicates team manager).  
  - Invite option (manager only).  
  - Team schedule (subset of league schedule).  
  - Current standings + past games results (future).

### Admin
- Dashboard: list of leagues they manage.  
- League Page:  
  - Manage league schedule (upload PDF for now).  
  - Input standings/game results (auto-update teams).  
  - View all teams in league.  
  - View master roster: all players in the league + their teams, managers starred, payment status.  
- Team Page (admin view): same as player, plus:  
  - Approve/unapprove team.  
  - View player profile (contact info, dues status, all teams).  

### Super Admin
- Dashboard: all leagues → managers + teams → team rosters.  
- Mostly read-only oversight.  

---

## Tech Stack
- **Frontend/Backend:** Next.js (App Router)  
- **Auth:** Firebase Authentication  
- **Database:** Vercel KV (NoSQL)  
- **Deployment:** Vercel  
- **Files:** Schedule PDFs stored externally (for now)  
- **Payments:** MVP: boolean paid/unpaid on membership (no provider integration yet)

---

## Data Model (simplified KV)
- **User**: id, email, name, phone, address  
- **League**: id, name, schedulePdfUrl, standings placeholder  
- **Team**: id, leagueId, name, description, managerUserId, approved flag  
- **Membership**: { userId, teamId, role: `PLAYER` or `MANAGER`, paymentStatus }  
- **Game**: id, leagueId, startAt, location, homeTeamId, awayTeamId, scores  

---

## Roadmap
- **MVP**: Firebase auth, team creation/join, rosters, dues status, admin approval.  
- **Next**: League/team schedules (PDF upload → in-app scheduler).  
- **Later**: Standings & scoring logs, bracket view.  
- **Future**: Stripe integration, notifications, advanced scheduling.
