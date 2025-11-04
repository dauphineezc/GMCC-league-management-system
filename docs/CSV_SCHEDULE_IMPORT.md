# CSV Schedule Bulk Import

## Overview

The CSV bulk import feature allows administrators to upload multiple games at once via a CSV file, eliminating the need to manually enter each game individually.

## CSV Format

The CSV file should have the following columns (in order):

1. **Home Team** - Name of the home team
2. **Away Team** - Name of the away team  
3. **Date** - Game date
4. **Time** - Game time
5. **Location** - Venue/court name

### Header Row (Optional)

You can optionally include a header row. The importer will automatically detect it if it contains keywords like "home", "away", "date", or "time".

## Date Formats Supported

The following date formats are supported:
- `YYYY-MM-DD` (e.g., 2025-01-15)
- `MM/DD/YYYY` (e.g., 01/15/2025)
- `M/D/YYYY` (e.g., 1/15/2025)
- `MM-DD-YYYY` (e.g., 01-15-2025)

## Time Formats Supported

The following time formats are supported:
- 24-hour format: `HH:mm` (e.g., 18:00, 09:30)
- 12-hour format with AM/PM: `h:mm AM` or `h:mm PM` (e.g., 6:00 PM, 9:30 AM)

## Example CSV

```csv
Home Team,Away Team,Date,Time,Location
Spurs,Sharks,2025-01-15,18:00,Court A
Eagles,Tigers,2025-01-15,19:30,Court B
Warriors,Lions,2025-01-22,18:00,Court A
Sharks,Eagles,2025-01-22,19:30,Court B
Tigers,Spurs,2025-01-29,18:00,Court A
Lions,Warriors,2025-01-29,19:30,Court B
```

### Without Header Row

```csv
Spurs,Sharks,2025-01-15,18:00,Court A
Eagles,Tigers,01/15/2025,7:30 PM,Court B
Warriors,Lions,2025-01-22,18:00,Main Gym
```

## How to Use

1. Navigate to the Schedule Management page for your league
2. Find the "Bulk Import from CSV" section at the top
3. Click the "Upload CSV" button
4. Select your CSV file
5. The system will:
   - Parse the CSV file
   - Validate each row
   - Import all valid games
   - Report any errors for rows that couldn't be imported

## Validation Rules

The importer validates each row and will skip rows that:
- Have the same home and away team
- Have missing required fields
- Have invalid date formats
- Have invalid time formats
- Don't have the correct number of columns (must be exactly 5)

## Timezone

Games are imported using the timezone setting from the schedule form (defaults to America/Detroit). Make sure to set the correct timezone before importing if needed.

## Error Handling

- If any rows have errors, the system will still import the valid rows
- Up to 10 error messages will be displayed in the console for debugging
- A summary message will show how many games were successfully imported vs total rows

## Quoted Fields

The CSV parser supports quoted fields if your data contains commas:
```csv
Home Team,Away Team,Date,Time,Location
"Team A, Division 1","Team B, Division 2",2025-01-15,18:00,Court A
```

## Sample File

A sample CSV file (`sample-schedule.csv`) is included in the project root for reference.

## Tips

- Use a spreadsheet program (Excel, Google Sheets) to create your schedule
- Export as CSV when done
- Double-check dates and times before importing
- Team names should match existing teams in your league for consistency
- Keep location names consistent (e.g., always use "Court A" not "court a" or "CourtA")

