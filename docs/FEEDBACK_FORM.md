# ChainChit User Feedback Form

**Live form:** https://forms.gle/2gWMDTeXUNkMaUUB8

This document contains the exact questions used in the official ChainChit
feedback form. Responses are exported to an Excel sheet for analysis
(`docs/ChainChit_Feedback.xlsx` — committed, with a self-updating Analysis tab).

## Exporting Responses

1. Google Forms → Responses → **Link to Sheets**
2. In the linked Sheet: File → Download → **Excel (.xlsx)**
3. Paste the rows under the headers in the workbook's **Responses** tab —
   the **Analysis** tab updates automatically.

## Questions

### 1. Full Name
Short answer (Required)

### 2. Email Address
Short answer (Required) — validation: email

### 3. Wallet Address (Stellar Public Key)
Short answer (Required) — placeholder: `G...` 40-character Stellar address

### 4. How would you rate ChainChit overall?
Linear scale 1–5 (Required)
- 1 = Very poor, 5 = Excellent
- Labels: 1 (Very poor) … 5 (Excellent)

### 5. What did you like most about ChainChit?
Paragraph (Optional)

### 6. What frustrated you or felt missing?
Paragraph (Optional)

### 7. How easy was creating/joining a chit group?
Multiple choice (Required)
- Very easy
- Easy
- Neutral
- Difficult
- Very difficult

### 8. Which features would you want next?
Checkboxes (Optional)
- Lower minimum contribution
- Mobile app
- Notifications (email/SMS)
- Loan against chit share
- More payment options (XLM, other stablecoins)
- Other

### 9. Would you recommend ChainChit to others?
Multiple choice (Required)
- Yes, definitely
- Probably yes
- Not sure
- Probably not
- No

### 10. Any other comments or suggestions?
Paragraph (Optional)

## Analysis Workflow

1. Export responses and paste into `docs/ChainChit_Feedback.xlsx` (see above)
2. Review the **Analysis** tab:
   - Average rating
   - Top requested features (from Q8 checkboxes)
   - Common complaints (Q6 word cloud / manual read)
   - Churn risk signals (rating ≤ 2, "Difficult" onboarding)
3. Summarize findings in `docs/GROWTH_REPORT.md`
4. Turn top feedback items into GitHub issues → fix → reference commit
   links in the README **Improvement Plan** section