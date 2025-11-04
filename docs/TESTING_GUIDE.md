# CSV Bulk Import Testing Guide

## Quick Test Steps

### 1. Basic Import Test

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to Schedule Management page:
   - Go to `/leagues/[your-league-id]/schedule`
   - You should see admin interface (requires admin auth)

3. Look for "Bulk Import from CSV" section at the top of the page

4. Use the provided `sample-schedule.csv` file:
   - Click "Upload CSV" button
   - Select `sample-schedule.csv`
   - Wait for upload to complete

5. Expected Result:
   - ✅ Green success message: "Successfully imported 6 games"
   - ✅ Games list refreshes automatically
   - ✅ 6 new games appear in the schedule

### 2. Format Validation Tests

Create test CSV files to verify different scenarios:

#### Test A: With Header Row
```csv
Home Team,Away Team,Date,Time,Location
Warriors,Lakers,2025-02-01,18:00,Court A
Celtics,Heat,2025-02-01,19:30,Court B
```

#### Test B: Without Header Row
```csv
Warriors,Lakers,2025-02-01,18:00,Court A
Celtics,Heat,2025-02-01,19:30,Court B
```

#### Test C: Different Date Formats
```csv
Home Team,Away Team,Date,Time,Location
Warriors,Lakers,2025-02-01,18:00,Court A
Celtics,Heat,02/01/2025,7:30 PM,Court B
Bulls,Nets,2-1-2025,6:00 PM,Main Gym
```

#### Test D: Quoted Fields (Commas in Names)
```csv
"Team A, Division 1","Team B, Division 2",2025-02-01,18:00,"Court A, Main Building"
```

#### Test E: Invalid Data (Should Show Errors)
```csv
Home Team,Away Team,Date,Time,Location
Warriors,Warriors,2025-02-01,18:00,Court A
Lakers,Celtics,invalid-date,18:00,Court B
Heat,Bulls,2025-02-01,99:99,Court A
```

Expected Result for Test E:
- ❌ Row 1 skipped (same team error)
- ❌ Row 2 skipped (invalid date)
- ❌ Row 3 skipped (invalid time)
- Red error message with details

### 3. Edge Case Tests

#### Empty File
- Create empty CSV file
- Expected: "CSV file is empty" error

#### Wrong File Type
- Try uploading .txt or .xlsx file
- Expected: "File must be a CSV (.csv)" error

#### Only Header (No Data)
```csv
Home Team,Away Team,Date,Time,Location
```
- Expected: "No valid games found in CSV" error

#### Missing Columns
```csv
Warriors,Lakers,2025-02-01,18:00
```
- Expected: Error about expected 5 columns

### 4. Integration Tests

#### Test Timezone Handling
1. Change timezone in the form (e.g., to "America/New_York")
2. Upload CSV with time "18:00"
3. Verify game shows correct time for that timezone

#### Test Game Display
1. Import games via CSV
2. Verify they appear in:
   - Desktop table view
   - Mobile card view
3. Check that:
   - Date displays correctly
   - Time displays correctly
   - Teams show properly
   - Location is correct
   - Status is "scheduled"

#### Test With Existing Games
1. Manually add 2 games
2. Upload CSV with 3 games
3. Verify all 5 games appear (no duplicates/overwrites)

### 5. Error Recovery Tests

#### Partial Success
1. Upload CSV with 5 rows (3 valid, 2 invalid)
2. Expected:
   - 3 games imported
   - Message: "Imported 3 of 5 games. 2 rows had errors."
   - Valid games appear in list
   - Console shows error details

#### Network Error Simulation
1. Disconnect network
2. Try to upload
3. Expected: "Upload failed. Please try again."

### 6. UI/UX Tests

#### Loading State
1. Click "Upload CSV"
2. While uploading, verify:
   - Button shows "Uploading..."
   - Button is disabled
   - Cursor shows not-allowed

#### Message Persistence
1. Upload valid CSV
2. Verify success message appears in green
3. Upload another file
4. Verify new message replaces old one

#### Format Helper Text
1. Look at the CSV upload section
2. Verify you see:
   - "Format: homeTeam, awayTeam, date, time, location"
   - Example with code formatting
   - Detailed format specification

### 7. Browser Console Tests

Open browser dev tools (F12) and check:

#### Successful Import
```
Console should show:
- No errors
- Possible: "Successfully imported X games to league Y" (server log)
```

#### Partial Import
```
Console should show:
- Warning: Import warnings: [array of errors]
```

#### Failed Import
```
Console should show:
- Error: CSV errors: [array of errors]
```

## Manual Testing Checklist

- [ ] Sample CSV imports successfully
- [ ] Header row detected and skipped
- [ ] CSV without header works
- [ ] Date format YYYY-MM-DD works
- [ ] Date format MM/DD/YYYY works
- [ ] Time format HH:mm works
- [ ] Time format h:mm AM/PM works
- [ ] Quoted fields parse correctly
- [ ] Same team error detected
- [ ] Invalid date error shown
- [ ] Invalid time error shown
- [ ] Wrong file type rejected
- [ ] Empty file rejected
- [ ] Games appear after import
- [ ] Game list auto-refreshes
- [ ] Success message shown in green
- [ ] Error message shown in red
- [ ] Loading state works
- [ ] Timezone respected
- [ ] Multiple uploads work
- [ ] Works with existing games
- [ ] Mobile view displays correctly
- [ ] Desktop view displays correctly
- [ ] Edit imported game works
- [ ] Delete imported game works

## Common Issues & Solutions

### Issue: Games don't appear after import
**Solution:** 
- Check browser console for errors
- Verify API endpoint is accessible
- Check Vercel KV connection
- Try manual refresh of page

### Issue: All rows showing errors
**Solution:**
- Verify CSV format exactly matches specification
- Check for hidden characters or encoding issues
- Try saving CSV as UTF-8
- Verify 5 columns in each row

### Issue: Dates/times incorrect
**Solution:**
- Check timezone setting in form
- Verify date format matches supported formats
- Ensure time is in HH:mm or h:mm AM/PM format

### Issue: Upload button not appearing
**Solution:**
- Verify you're logged in as admin
- Check you're on the correct page
- Clear browser cache
- Check console for JavaScript errors

## Performance Testing

For large CSV files (100+ games):

1. Create CSV with 100 rows
2. Upload and time the operation
3. Verify:
   - Upload completes within reasonable time
   - All games imported correctly
   - UI remains responsive
   - No browser crashes/freezes

Expected performance:
- ~1-2 seconds for 100 games
- ~5-10 seconds for 500 games

## Security Testing

- [ ] Only admins can access upload feature
- [ ] File size limits respected
- [ ] SQL injection attempts in team names handled
- [ ] XSS attempts in location names sanitized
- [ ] Malformed CSV doesn't crash server

## Regression Testing

After implementation, verify existing features still work:

- [ ] Manual game entry still works
- [ ] PDF upload still works
- [ ] Edit game still works
- [ ] Delete game still works
- [ ] Schedule display still works
- [ ] Mobile view still works
- [ ] Team filtering still works
- [ ] Other league features unaffected

## Production Deployment Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] No console errors
- [ ] Linter passes
- [ ] TypeScript compiles without errors
- [ ] Sample CSV file tested
- [ ] Documentation reviewed
- [ ] Error messages are user-friendly
- [ ] Loading states work
- [ ] Mobile responsive
- [ ] Timezone handling verified
- [ ] Backup key writing confirmed
- [ ] KV storage tested with real data

## Support Resources

If issues arise:
1. Check IMPLEMENTATION_SUMMARY.md for technical details
2. Check CSV_SCHEDULE_IMPORT.md for user guidance
3. Review browser console for errors
4. Check server logs for API errors
5. Verify Vercel KV dashboard for data

