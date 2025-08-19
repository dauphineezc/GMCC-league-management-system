# A more detailed user flow

---

# User roles: 
- **Player**  
  - Includes team managers
  - Manager status is tied **only to a specific team**, not the user profile
  - A user could be a regular player on one team and a manager on another
- **Admin**  
  - Manages a league
- **Super Admin**  
  - Has access to all leagues, teams, and players

---

# User flow:
## Public (Not Logged In)
- Option to view leagues (will show list of leagues: 5v5, 4v4B, etc). Click on a league to see:
  - The teams (names and descriptions only, not players) in each league
  - The league schedule (will be pdfs for now until we add in in-app scheduling capabilities)
  - The standings/bracket/game scores (placeholder information for now - lowest priority)
- Option to log in
  - Message: “To see your current teams, or to create or join a team, please log in.”

---

## Logged in as a player:
- See a list of your teams (any you are team manager of are visually distinct)
- Below list of current teams, there are buttons to 'Create Team' and 'Join Team'
- Click on a team to see team-specific information. Takes you to a team page with:
  - Team name + description (editable only if you are manager of that team)
  - Whether the team is approved (state set by league admin, based on whether all players have paid their dues)
  - Team roster (option to send invite link/code present for team manager)
  - Upcoming schedule (team-specific schedule that shows upcoming games for that team only)
  - Current standing (shows previous games + their scores, overall league ranking)

---

## Logged in as an admin:
- Comes up with a list of leagues you’re admin of. Click on a league to:
  - View all the teams within that league
  - Update the league schedule
    - Inputting a league’s schedule should automatically update the team-specific schedule on each team’s page
  - Update league standings/input game results
    - Inputting league standings/game results on the league homepage should automatically update the standings/game history section of that team’s page
  - View master roster
    - Shows a list of all players in that league, with their team name (in that league) beside them, stars beside all team managers (for teams in that league)
    - Click on the name to bring up a popup with their player profile (contact information, teams they’re in, whether or not they paid)
  - Click on a team to view the team page - basically the same as what players see, except with the additional capabilities:
    - Change approved/unapproved state
    - Click on a player in the roster to see player profile (contact information, teams they’re in, whether or not they paid)

---

## Logged in as a super admin:
- View all leagues
  → click on a league to see league manager and all teams in that league
  → click on a team to see all players
- View all players (master roster but with all players across all leagues)
- Super admin role is loosely defined (for now just developers + head of basketball department)
