# CSV Schedule Import Implementation Summary

## What Was Implemented

### 1. Backend API Endpoint
**File:** `src/app/api/leagues/[leagueId]/schedule/bulk-import/route.ts`

**Features:**
- Accepts CSV file uploads via multipart form data
- Parses CSV with custom parser that handles:
  - Optional header rows (auto-detected)
  - Quoted fields (for commas in team names)
  - Multiple date formats (YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY)
  - Multiple time formats (24-hour HH:mm, 12-hour h:mm AM/PM)
- Validates each row:
  - Ensures 5 columns present
  - Checks for same home/away teams
  - Validates date/time formats
  - Checks for empty required fields
- Creates game objects with proper structure:
  - Generates unique IDs
  - Converts to ISO datetime with timezone support
  - Sets status to 'scheduled'
- Returns detailed results:
  - Success count
  - Total rows processed
  - Error messages for failed rows (up to 10)
- Saves to Vercel KV with backup key

### 2. Frontend UI Updates
**File:** `src/app/leagues/[leagueId]/schedule/scheduleClient.tsx`

**Changes:**
- Added CSV upload state management:
  - `csvUploading` - tracks upload progress
  - `csvMessage` - displays success/error messages
- Created `handleCsvUpload` function:
  - Validates file extension (.csv)
  - Sends file with timezone to API
  - Displays results with appropriate styling
  - Refreshes game list on success
  - Shows console warnings for partial imports
- Added new UI section "Bulk Import from CSV":
  - Upload button with loading state
  - Status message with color coding (green for success, red for errors)
  - Format helper text with example
  - Detailed format specification
- Styled to match existing design system

### 3. Documentation Files
- `CSV_SCHEDULE_IMPORT.md` - Complete user guide
- `sample-schedule.csv` - Example CSV file
- `IMPLEMENTATION_SUMMARY.md` - This file

## File Structure

```
src/app/api/leagues/[leagueId]/schedule/
├── bulk-import/
│   └── route.ts           ← NEW: CSV bulk import endpoint
├── [gameId]/
│   └── route.ts           (existing)
├── pdf/
│   └── route.ts           (existing)
├── pdf-info/
│   └── route.ts           (existing)
├── upload/
│   └── route.ts           (existing - PDF upload)
└── route.ts               (existing - GET/POST games)

src/app/leagues/[leagueId]/schedule/
└── scheduleClient.tsx     ← MODIFIED: Added CSV upload UI
```

## How It Works

### User Flow
1. Admin navigates to Schedule Management page
2. Clicks "Upload CSV" button in "Bulk Import from CSV" section
3. Selects CSV file from file system
4. System uploads and processes file
5. Games are created and added to schedule
6. Success/error message displayed
7. Game list refreshes automatically

### Data Flow
```
CSV File
  ↓
scheduleClient.tsx (handleCsvUpload)
  ↓
POST /api/leagues/[leagueId]/schedule/bulk-import
  ↓
parseCSV() - Parses and validates rows
  ↓
Create game objects with timezone conversion
  ↓
Add to existing games array
  ↓
Save to Vercel KV (primary + backup keys)
  ↓
Return success/error response
  ↓
Update UI and refresh game list
```

## Expected CSV Format

### With Header
```csv
Home Team,Away Team,Date,Time,Location
Spurs,Sharks,2025-01-15,18:00,Court A
Eagles,Tigers,2025-01-15,19:30,Court B
```

### Without Header
```csv
Spurs,Sharks,2025-01-15,18:00,Court A
Eagles,Tigers,2025-01-15,19:30,Court B
```

## Supported Formats

### Dates
- `YYYY-MM-DD` → 2025-01-15
- `MM/DD/YYYY` → 01/15/2025
- `M/D/YYYY` → 1/15/2025
- `MM-DD-YYYY` → 01-15-2025

### Times
- `HH:mm` → 18:00 (24-hour)
- `h:mm A` → 6:00 PM (12-hour)
- `h:mm a` → 6:00 pm (12-hour)

## Error Handling

### Client-Side
- File extension validation (.csv required)
- Loading state during upload
- Error messages displayed in red
- Success messages displayed in green
- Detailed errors logged to console

### Server-Side
- CSV parsing errors (malformed CSV)
- Row validation errors (missing columns, invalid data)
- Date/time parsing errors (invalid formats)
- Business logic errors (same team matchup)
- Returns partial success if some rows valid

## Testing Scenarios

### Happy Path
1. Upload valid CSV with all correct data
   - ✅ All games should be imported
   - ✅ Success message displayed
   - ✅ Games appear in schedule list

### Edge Cases
1. CSV with header row
   - ✅ Header detected and skipped
   
2. CSV without header row
   - ✅ All rows treated as data

3. Mixed valid/invalid rows
   - ✅ Valid rows imported
   - ✅ Invalid rows skipped
   - ✅ Error summary displayed

4. Quoted fields (commas in names)
   - ✅ "Team A, Division 1" parsed correctly

5. Different date/time formats
   - ✅ All supported formats work

6. Empty file
   - ✅ Error: "CSV file is empty"

7. Wrong file type
   - ✅ Error: "File must be a CSV (.csv)"

8. Invalid data
   - Same home/away team → Skipped with error
   - Invalid date → Skipped with error
   - Missing columns → Skipped with error

## Key Features

✅ **No External Dependencies** - Custom CSV parser, no new packages needed
✅ **Robust Validation** - Multiple layers of data validation
✅ **Flexible Formats** - Supports common date/time formats
✅ **Error Reporting** - Clear error messages for debugging
✅ **Partial Success** - Imports valid rows even if some fail
✅ **Timezone Support** - Uses form timezone setting
✅ **Auto-refresh** - Game list updates after import
✅ **Consistent UX** - Matches existing design patterns
✅ **Type Safety** - Full TypeScript implementation

## Integration Points

### Existing Functionality Used
- `parseKV()` - Parse stored games from Vercel KV
- `kv.get()` / `kv.set()` - Database operations
- `dayjs` - Date/time parsing and timezone conversion
- `refresh()` - Reload games list
- Form timezone state - Consistent timezone handling

### No Breaking Changes
- Existing PDF upload functionality unchanged
- Manual game entry functionality unchanged
- All existing routes and endpoints unchanged
- Database structure unchanged

## Future Enhancements (Optional)

- [ ] CSV export functionality (reverse of import)
- [ ] Template download button
- [ ] Preview mode before final import
- [ ] Dry-run mode to validate without importing
- [ ] Support for Excel files (.xlsx)
- [ ] Batch edit via CSV re-upload
- [ ] Import history/audit log
- [ ] Drag-and-drop file upload
- [ ] Progress bar for large files
- [ ] Duplicate detection and merging options

## Notes

- Default timezone: America/Detroit (configurable via form)
- Maximum error messages displayed: 10
- Games status: Always set to 'scheduled' on import
- IDs: Generated via `crypto.randomUUID()`
- Storage: Vercel KV with backup key for reliability

