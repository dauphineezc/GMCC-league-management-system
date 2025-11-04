C:.
├───app
│   │   globals.css
│   │   layout.tsx
│   │   page.tsx
│   │   tailwind.config.js
│   │
│   ├───(admin)
│   │   └───admin
│   │       │   page.tsx
│   │       │
│   │       ├───leagues
│   │       │   └───[leagueId]
│   │       │       │   page.tsx
│   │       │       │
│   │       │       ├───export.csv
│   │       │       │       route.ts
│   │       │       │
│   │       │       ├───results
│   │       │       │       resultsClient.tsx
│   │       │       │
│   │       │       └───schedule
│   │       │               scheduleClient.tsx
│   │       │
│   │       ├───seed
│   │       │       page.tsx
│   │       │
│   │       └───team
│   │           └───[teamId]
│   │                   page.tsx
│   │
│   ├───(superadmin)
│   │   └───superadmin
│   │       │   page.tsx
│   │       │
│   │       ├───admins
│   │       │       page.tsx
│   │       │
│   │       ├───export
│   │       │   ├───admins.csv
│   │       │   │       route.ts
│   │       │   │
│   │       │   └───players.csv
│   │       │           route.ts
│   │       │
│   │       ├───leagues
│   │       │   │   createLeagueAction.ts
│   │       │   │   createLeagueClient.tsx
│   │       │   │   createLeagueTypes.ts
│   │       │   │   page.tsx
│   │       │   │
│   │       │   └───[leagueId]
│   │       │           page.tsx
│   │       │
│   │       ├───players
│   │       │       page.tsx
│   │       │
│   │       ├───team
│   │       │   └───[teamId]
│   │       │           page.tsx
│   │       │
│   │       └───teams
│   │               assignTeam.tsx
│   │               editableLeagueAssignment.tsx
│   │               page.tsx
│   │
│   ├───admins
│   │       page.tsx
│   │
│   ├───api
│   │   ├───admin
│   │   │   ├───approve
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───backfill-membership-names
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───claims
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───migrate-league-team-sets
│   │   │   │       route.ts
│   │   │   │
│   │   │   └───update-game-statuses
│   │   │           route.ts
│   │   │
│   │   ├───auth
│   │   │   ├───bootstrap
│   │   │   │       route.ts
│   │   │   │
│   │   │   └───session
│   │   │           route.ts
│   │   │
│   │   ├───cron
│   │   │   └───daily-status-update
│   │   │           route.ts
│   │   │
│   │   ├───dev
│   │   │   ├───migrate-email-to-uid
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───normalize-team-fields
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───rebuild-teams-index
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───reindex
│   │   │   │       route.ts
│   │   │   │
│   │   │   └───set-display-name
│   │   │           route.ts
│   │   │
│   │   ├───divisions
│   │   │   └───[divisionId]
│   │   │       └───schedule
│   │   │               route.ts
│   │   │
│   │   ├───invites
│   │   │       route.ts
│   │   │
│   │   ├───join
│   │   │   └───by-code
│   │   │           route.ts
│   │   │
│   │   ├───leagues
│   │   │   └───[leagueId]
│   │   │       ├───games
│   │   │       │   └───[gameId]
│   │   │       │       └───result
│   │   │       │               route.ts
│   │   │       │
│   │   │       ├───meta
│   │   │       │       route.ts
│   │   │       │
│   │   │       ├───schedule
│   │   │       │   │   route.ts
│   │   │       │   │
│   │   │       │   ├───pdf
│   │   │       │   │       route.ts
│   │   │       │   │
│   │   │       │   ├───pdf-info
│   │   │       │   │       route.ts
│   │   │       │   │
│   │   │       │   ├───upload
│   │   │       │   │       route.ts
│   │   │       │   │
│   │   │       │   └───[gameId]
│   │   │       │           route.ts
│   │   │       │
│   │   │       └───standings
│   │   │           │   route.ts
│   │   │           │
│   │   │           └───calculate
│   │   │                   route.ts
│   │   │
│   │   ├───me
│   │   │       route.ts
│   │   │
│   │   ├───superadmin
│   │   │   ├───claims
│   │   │   │       route.ts
│   │   │   │
│   │   │   ├───leagues
│   │   │   │   │   route.ts
│   │   │   │   │
│   │   │   │   └───[leagueId]
│   │   │   │       │   route.ts
│   │   │   │       │
│   │   │   │       └───assign-admin
│   │   │   │               route.ts
│   │   │   │
│   │   │   └───teams
│   │   │       └───assign
│   │   │               route.ts
│   │   │
│   │   ├───team-names
│   │   │       route.ts
│   │   │
│   │   ├───teams
│   │   │   │   route.ts
│   │   │   │
│   │   │   └───[teamId]
│   │   │       │   route.ts
│   │   │       │
│   │   │       └───players
│   │   │               route.ts
│   │   │
│   │   ├───users
│   │   │   ├───profile
│   │   │   │       route.ts
│   │   │   │
│   │   │   └───[uid]
│   │   │       └───email
│   │   │               route.ts
│   │   │
│   │   └───__tests__
│   │           divisions-usage.test.ts
│   │           teams.test.ts
│   │
│   ├───create-account
│   │       page.tsx
│   │
│   ├───create-team
│   │       page.tsx
│   │
│   ├───export
│   │   ├───admins.csv
│   │   │       route.ts
│   │   │
│   │   └───players.csv
│   │           route.ts
│   │
│   ├───join
│   │       page.tsx
│   │
│   ├───leagues
│   │   │   page.tsx
│   │   │
│   │   └───[leagueId]
│   │       │   page.tsx
│   │       │
│   │       ├───export.csv
│   │       │       route.ts
│   │       │
│   │       ├───results
│   │       │       page.tsx
│   │       │       resultsClient.tsx
│   │       │
│   │       ├───schedule
│   │       │       page.tsx
│   │       │       scheduleClient.tsx
│   │       │
│   │       ├───sendAnnouncement
│   │       │       actions.ts
│   │       │       client.tsx
│   │       │       page.tsx
│   │       │
│   │       └───teams
│   │           └───[teamsId]
│   │                   page.tsx
│   │
│   ├───login
│   │       page.tsx
│   │
│   ├───logout
│   │       page.tsx
│   │
│   ├───player
│   │       page.tsx
│   │
│   ├───players
│   │       page.tsx
│   │
│   ├───team
│   │   └───[teamId]
│   │           page.tsx
│   │
│   └───teams
│           page.tsx
│
├───components
│       adminAssignmentEditor.tsx
│       adminLeagueSplitTabs.tsx
│       adminLeagueSummaryCard.tsx
│       adminTeamTabs.tsx
│       announcementFilters.tsx
│       collapsible.tsx
│       conditionalDisplay.tsx
│       deleteResourceButton.tsx
│       directoryRosterClient.tsx
│       gameHistory.tsx
│       leagueActionsDropdown.tsx
│       leagueTabs.tsx
│       navbar.tsx
│       navbarWrapper.tsx
│       pdfScheduleUpload.tsx
│       playerDirectoryClient.tsx
│       playerInfoPopup.tsx
│       playerTeamSummaryCard.tsx
│       publicLeagueTabs.server.tsx
│       publicLeagueTabs.tsx
│       scheduleList.tsx
│       scheduleViewer.server.tsx
│       scheduleViewer.shared.tsx
│       scheduleViewer.tsx
│       superAdminList.tsx
│       superPlayerList.tsx
│       teamCard.tsx
│       teamTabs.tsx
│
├───lib
│   │   absoluteUrl.ts
│   │   adminActions.ts
│   │   adminIndex.ts
│   │   adminUserLookup.ts
│   │   authTypes.ts
│   │   csv.ts
│   │   divisions.ts
│   │   firebaseAdmin.ts
│   │   firebaseClient.ts
│   │   getLeagues.ts
│   │   kvBatch.ts
│   │   kvread.ts
│   │   leagueDoc.ts
│   │   orgAccess.ts
│   │   permissions.ts
│   │   playerTeams.ts
│   │   readLeagueName.ts
│   │   rosterAggregate.ts
│   │   scheduleKv.ts
│   │   serverUser.ts
│   │   types.ts
│   │   usePermissions.ts
│   │
│   ├───schedule
│   │       parseScheduleFromPDF.ts
│   │       pdfParseShim.node.ts
│   │
│   └───__tests__
│           divisions.test.ts
│           orgAccess.test.ts
│           permissions.test.ts
│
├───server
│       invites.ts
│       memberships.ts
│       schedules.ts
│
└───types
        domain.ts