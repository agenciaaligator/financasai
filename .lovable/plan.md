
# Fix: Styling Issues on /register Dark Theme

## Problems
1. **Phone input country dropdown**: The native `<select>` renders white text on white background - countries are invisible
2. **Phone number text**: Typed digits appear white inside the input but the dropdown overlay blocks visibility  
3. **"Ja tenho conta" button**: Text only visible on hover because it's white on transparent with no contrast
4. **Country selector overlay**: The `<select>` element creates a large white block

## Solution

### 1. Register.tsx - Phone Input Styling
Replace the raw `PhoneInput` with properly styled version that works on dark backgrounds:
- Add explicit dark-compatible styles to the phone input container
- Style the country `<select>` dropdown with dark colors so items are readable
- Ensure typed phone number text is visible (white text on dark bg)

### 2. Register.tsx - "Ja tenho conta" Button  
Add visible background/border contrast so text is always readable, not just on hover.

### 3. phone-input.css - Dark Theme Support
Add dark-theme-aware styles for the country selector dropdown:
- Set `color: black` on `.PhoneInputCountrySelect` so dropdown items are readable
- Ensure the select element doesn't create a white overlay

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Register.tsx` | Fix phone input styling with dark-theme-compatible classes; fix button visibility |
| `src/components/ui/phone-input.css` | Add color/background rules for the native select dropdown |

## Technical Details

### Register.tsx changes
```tsx
// Phone input: add explicit styling for dark bg
<PhoneInput
  international
  defaultCountry="BR"
  value={phone}
  onChange={(value) => setPhone(value || "")}
  className="phone-input-dark flex h-11 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-base text-white"
  disabled={loading}
/>

// Button: ensure text is always visible
<Button
  variant="outline"
  onClick={() => navigate("/")}
  className="border-white/30 text-white bg-white/10 hover:bg-white/20"
>
```

### phone-input.css additions
```css
/* Dark theme support for Register page */
.phone-input-dark .PhoneInputInput {
  color: white;
  background: transparent;
}

.phone-input-dark .PhoneInputCountrySelect {
  color: black; /* Native dropdown items need dark text */
}

.phone-input-dark .PhoneInputCountrySelectArrow {
  color: white;
  opacity: 0.7;
}
```
