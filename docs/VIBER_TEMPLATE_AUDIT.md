# Viber Template Audit - RFQ Copy Feature

**Date:** June 2, 2026  
**Feature:** Copy for Viber - RFQ Notification Template  
**Location:** Canvassing page → "Copy for Viber" button

---

## 🎯 Current Template

### Code Location:
`lib/viber-utils.ts` → `formatRfqForViber()`

### Current Format:
```
📢 *NEW RFQ ISSUED*
---------------------------
*RFQ:* RFQ-20260529-0003
*Dept:* Operations
*Purpose:* Maintenance & Repair
*Deadline:* N/A

*Items:*
1. ballpen (3 ream)
2. paper (5 pcs)
3. bolt (10 pcs)

*Login to submit quote:*
http://localhost:3000/login
---------------------------
```

---

## 🔍 Audit Findings

### ✅ Strengths:

1. **Clear Structure**
   - Clean separator lines
   - Bold headers using asterisks (*text*)
   - Logical information flow

2. **Essential Information Present**
   - RFQ number
   - Department
   - Purpose
   - Deadline
   - Item list with quantities and units
   - Action link

3. **User-Friendly**
   - Emoji icon draws attention (📢)
   - Numbered items list
   - Truncation for long lists (shows first 10, then "...and X more")

4. **Link Handling**
   - Direct link to supplier quotation page (when assignment ID provided)
   - Fallback to login page (when no assignment ID)

---

## ❌ Issues Found:

### 1. **Inconsistent Spacing**
- Line breaks are inconsistent
- Double `\n\n` after deadline, but single `\n` elsewhere
- No blank line before closing separator

### 2. **Unit Display Issue**
Looking at your example:
```
1. ballpen (3 ream)
```
**Problem:** "ream" is not the correct unit for ballpen. This suggests the unit data might be wrong in the source, but the template should handle this better.

### 3. **Deadline Format**
- Shows "N/A" when no deadline
- Could be more descriptive: "No deadline specified" or "Open-ended"

### 4. **Missing Information**
Consider adding:
- **Contact person** (Procurement officer name/phone)
- **Priority level** (if urgent)
- **Expected response time**
- **RFQ creation date**

### 5. **Link Readability**
- Long URLs can wrap awkwardly in Viber
- Consider using URL shortener or better formatting

### 6. **Markdown Compatibility**
- Viber supports some markdown but formatting varies
- Bold with `*text*` works, but consider testing other apps

### 7. **Character Limit**
- No check for overall message length
- Some messaging apps have character limits

---

## 🎨 Recommended Improvements

### Option 1: Enhanced Format (Recommended)

```
📢 *NEW RFQ ISSUED*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *RFQ:* RFQ-20260529-0003
🏢 *Dept:* Operations
📝 *Purpose:* Maintenance & Repair
⏰ *Deadline:* May 30, 2026 (3 days)
📅 *Issued:* May 27, 2026

*Items Requested:*
  1. Ballpen × 3 ream
  2. Paper × 5 pcs  
  3. Bolt × 10 pcs

📦 *Total:* 3 line items

🔗 *Submit Quote:*
http://localhost:3000/supplier/quotations/abc123

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Please respond before the deadline
```

**Changes:**
- ✅ Emoji icons for each field (visual scanning)
- ✅ Relative deadline ("3 days" or "3 days remaining")
- ✅ Issue date included
- ✅ Better item formatting (× symbol, cleaner layout)
- ✅ Total count summary
- ✅ Call-to-action at bottom
- ✅ Unicode box-drawing characters for separators
- ✅ Consistent spacing

---

### Option 2: Compact Format (Mobile-Optimized)

```
📢 *NEW RFQ*

*RFQ-20260529-0003*
Operations | Maintenance & Repair
⏰ Due: May 30, 2026

*3 Items:*
• Ballpen × 3 ream
• Paper × 5 pcs
• Bolt × 10 pcs

🔗 Submit: http://localhost:3000/supplier/quotations/abc123

Reply by deadline to be considered.
```

**Changes:**
- ✅ More compact (better for mobile)
- ✅ Bullet points instead of numbers
- ✅ Inline department and purpose
- ✅ Cleaner, less cluttered
- ✅ Clear call-to-action

---

### Option 3: Professional Format (Formal Tone)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📢 REQUEST FOR QUOTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━

RFQ NUMBER: RFQ-20260529-0003
DEPARTMENT: Operations
PROJECT: Maintenance & Repair
DEADLINE: May 30, 2026 at 5:00 PM
ISSUED: May 27, 2026

ITEMS REQUESTED:
─────────────────────────────
 1. Ballpen (3 ream)
 2. Paper (5 pcs)
 3. Bolt (10 pcs)

TOTAL LINE ITEMS: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 TO SUBMIT YOUR QUOTATION:
http://localhost:3000/supplier/quotations/abc123

⚠️ Late submissions will not be accepted.

For questions, contact:
Procurement Office
procurement@company.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Changes:**
- ✅ More formal, professional tone
- ✅ ALL CAPS headers for clarity
- ✅ Contact information included
- ✅ Explicit late submission warning
- ✅ Structured sections
- ✅ Time included in deadline

---

## 🛠️ Technical Improvements

### 1. Add Relative Time to Deadline

```typescript
import { format, formatDistanceToNow } from 'date-fns';

const deadlineStr = rfq.deadline 
  ? `${format(new Date(rfq.deadline), 'MMM d, yyyy')} (${formatDistanceToNow(new Date(rfq.deadline), { addSuffix: true })})`
  : 'No deadline specified';
```

**Output:** `May 30, 2026 (in 3 days)`

---

### 2. Better Unit Handling

```typescript
// Format quantity with unit
const formatQuantity = (qty: number, unit: string) => {
  return `${qty} ${unit || 'unit'}`;
};

// In the loop:
text += `${idx + 1}. ${item.description} × ${formatQuantity(item.quantity_requested, item.unit_of_measure)}\n`;
```

**Output:** `1. Ballpen × 3 ream` (using × symbol)

---

### 3. Add Issue Date

```typescript
const issuedStr = format(new Date(rfq.created_at), 'MMM d, yyyy');
text += `*Issued:* ${issuedStr}\n`;
```

---

### 4. Smart Link Label

```typescript
if (supplierAssignmentId) {
  text += `\n🔗 *Submit Your Quote:*\n${appUrl}/supplier/quotations/${supplierAssignmentId}\n`;
} else {
  text += `\n🔗 *Login to View RFQ:*\n${appUrl}/login\n`;
}
```

---

### 5. Add Summary Line

```typescript
text += `\n📦 *Total:* ${items.length} line item${items.length !== 1 ? 's' : ''}\n`;
```

---

### 6. Handle Missing Data Gracefully

```typescript
const purposeStr = pr1.purpose || 'General procurement';
const deptStr = pr1.department_name_snapshot || 'Unspecified';
```

---

### 7. Add Urgency Indicator

```typescript
// Check if deadline is within 48 hours
const isUrgent = rfq.deadline && 
  (new Date(rfq.deadline).getTime() - Date.now()) < (48 * 60 * 60 * 1000);

if (isUrgent) {
  text += `\n⚠️ *URGENT* - Response needed within 48 hours\n`;
}
```

---

## 📝 Recommended Implementation

### Updated `lib/viber-utils.ts`:

```typescript
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';

export function formatRfqForViber(
  rfq: any,
  pr1: any,
  items: any[],
  supplierAssignmentId?: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  
  // Format deadline with relative time
  let deadlineStr = 'No deadline specified';
  let isUrgent = false;
  
  if (rfq.deadline) {
    const deadlineDate = new Date(rfq.deadline);
    const hoursRemaining = differenceInHours(deadlineDate, new Date());
    isUrgent = hoursRemaining < 48 && hoursRemaining > 0;
    
    deadlineStr = `${format(deadlineDate, 'MMM d, yyyy')} (${formatDistanceToNow(deadlineDate, { addSuffix: true })})`;
  }
  
  // Build message
  let text = `📢 *NEW RFQ ISSUED*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  text += `📋 *RFQ:* ${rfq.rfq_number}\n`;
  text += `🏢 *Dept:* ${pr1.department_name_snapshot || 'Unspecified'}\n`;
  text += `📝 *Purpose:* ${pr1.purpose || 'General procurement'}\n`;
  text += `⏰ *Deadline:* ${deadlineStr}\n`;
  
  if (isUrgent) {
    text += `⚠️ *URGENT* - Response needed soon!\n`;
  }
  
  text += `\n*Items Requested:*\n`;
  items.slice(0, 10).forEach((item, idx) => {
    const unit = item.unit_of_measure || 'unit';
    text += `  ${idx + 1}. ${item.description} × ${item.quantity_requested} ${unit}\n`;
  });
  
  if (items.length > 10) {
    text += `  ...and ${items.length - 10} more item${items.length - 10 !== 1 ? 's' : ''}\n`;
  }
  
  text += `\n📦 *Total:* ${items.length} line item${items.length !== 1 ? 's' : ''}\n`;
  
  if (supplierAssignmentId) {
    text += `\n🔗 *Submit Your Quote:*\n${appUrl}/supplier/quotations/${supplierAssignmentId}\n`;
  } else {
    text += `\n🔗 *Login to View RFQ:*\n${appUrl}/login\n`;
  }
  
  text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `⚡ Please respond before the deadline`;
  
  return text;
}
```

---

## 📊 Comparison

| Feature | Current | Recommended |
|---------|---------|-------------|
| **Emoji icons** | 📢 only | 📢 📋 🏢 📝 ⏰ 📦 🔗 |
| **Separator** | Dashes `---` | Box drawing `━━━` |
| **Deadline** | Static date or N/A | Relative time + date |
| **Urgency** | Not shown | ⚠️ indicator if <48hrs |
| **Issue date** | Not shown | Included |
| **Item format** | Number. text (qty unit) | Number. text × qty unit |
| **Summary** | Not shown | Total line items count |
| **Call-to-action** | Just link | Clear label + link + reminder |
| **Spacing** | Inconsistent | Consistent |
| **Mobile friendly** | Good | Better (icons for scanning) |

---

## 🎯 Testing Checklist

Test the template with:

- [ ] RFQ with no deadline
- [ ] RFQ with deadline in 1 day (urgent)
- [ ] RFQ with deadline in 7 days (normal)
- [ ] RFQ with 1 item
- [ ] RFQ with 3 items
- [ ] RFQ with 15 items (test truncation)
- [ ] RFQ with very long item descriptions
- [ ] RFQ with missing department name
- [ ] RFQ with missing purpose
- [ ] With supplier assignment ID (direct link)
- [ ] Without supplier assignment ID (login link)
- [ ] Copy to Viber app (test formatting)
- [ ] Copy to WhatsApp (test compatibility)
- [ ] Copy to Telegram (test compatibility)
- [ ] Copy to SMS (test length limits)

---

## 🚀 Additional Features to Consider

### 1. **Multiple Templates**
Offer template choices:
- Compact (for SMS/character limits)
- Standard (current enhanced version)
- Detailed (with all info)

### 2. **Customizable Fields**
Allow procurement to choose what to include:
- Contact person
- Special instructions
- Attachments link
- Company name

### 3. **Language Support**
If suppliers use different languages:
- Template in Filipino
- Template in English
- Auto-detect based on supplier profile

### 4. **Shortened URLs**
Integrate URL shortener for cleaner messages

### 5. **QR Code Option**
Generate QR code for suppliers to scan instead of typing URL

---

## 📋 Summary of Issues

### Critical:
- None (template is functional)

### Medium Priority:
1. Inconsistent spacing
2. Missing relative deadline time
3. No urgency indicator
4. No summary count

### Low Priority:
1. Could use better separators
2. More emoji icons for visual scanning
3. Missing issue date
4. No contact information

---

## ✅ Recommended Action

**Implement Option 1 (Enhanced Format)** because:
- ✅ Maintains familiarity (similar structure)
- ✅ Adds valuable information (relative time, urgency)
- ✅ Better visual hierarchy (emojis)
- ✅ Mobile-friendly
- ✅ Not too long (fits most messaging apps)
- ✅ Professional yet friendly tone

---

**Audit Completed:** June 2, 2026  
**Recommendation:** Implement enhanced format with relative deadline and urgency indicators  
**Priority:** Medium - Current template works, but improvements will enhance UX

