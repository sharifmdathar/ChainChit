# ChainChit — Interactive Demo Video Guide

Follow this step-by-step script to record a professional, high-quality 2-minute walkthrough demo video for your submission.

---

## Preparation (Before Recording)

1. **Reputation Bootstrapped**: We have already seeded your main admin wallet with a reputation history on testnet (3 payments on time, 2 completed cycles). Your profile will immediately display a high composite reputation score (~640) and a reputation tier badge.
2. **Fund Your Wallet**: Make sure your Freighter wallet has both **XLM** (for gas/fees) and **USDC** (the group token).
   - If you need USDC, click the **SEP-24 Ramp** button on the dashboard to request test USDC, or fund it via the Stellar Laboratory.
3. **Open the App**: Run the app locally (`npm run dev`) and open `http://localhost:3000`.

---

## Video Script & Steps

### 1. Introduction & Wallet Connection (0:00 - 0:20)
* **What to show**: The landing page/dashboard.
* **What to do**:
  1. Click **Connect Wallet** in the top right.
  2. Select **Freighter** (or your preferred wallet).
  3. Approve the connection.
  4. Show your address and XLM/USDC balance displaying dynamically.
* **What to say**: *"Welcome to ChainChit, the transparent on-chain rotating savings and chit fund platform on Stellar. I will connect my Freighter wallet. Once connected, my balances are fetched directly from the Stellar testnet."*

### 2. User Profile & On-Chain Reputation (0:20 - 0:40)
* **What to show**: The **Profile** page.
* **What to do**:
  1. Click **Profile** in the navigation bar.
  2. Highlight the **Composite Reputation Score** (e.g., 640) and the **Reputation Badge**.
  3. Explain that this score is calculated on-chain from payment ratios and completed cycles.
* **What to say**: *"On the Profile page, you can see my composite reputation score. This is computed dynamically by our Reputation smart contract based on my payment history and completed cycles. High reputation reduces collateral requirements and allows participating in premium groups."*

### 3. Create a Chit Group (0:40 - 1:00)
* **What to show**: The **Create Group** page.
* **What to do**:
  1. Click **Create Group** in the nav bar.
  2. Fill out the form:
     - **Contribution**: `10000000` (10 USDC, since USDC has 7 decimals).
     - **Members**: `2` (set to 2 for quick simulation).
     - **Cycles**: `2`.
     - **Min Attestation Score**: `0` (so anyone can join for testing).
     - **Min Reputation**: `0`.
  3. Click **Create Group** and approve the Freighter transaction.
  4. Show the success notification and the new group listed on the **Dashboard**.
* **What to say**: *"Now, I will create a new chit group. I'll set the contribution to 10 USDC per cycle with 2 members. I'll sign the transaction to deploy and initialize the group parameters on-chain."*

### 4. Join, Contribute & Bidding Flow (1:00 - 1:30)
* **What to show**: The **Group Details** page.
* **What to do**:
  1. Click on the newly created group.
  2. Click **Start Collection** to open the cycle contribution phase.
  3. Click **Pay Contribution** (approves USDC transfer from wallet to contract).
  4. Go to the **Bidding Panel** at the bottom.
  5. Enter a bid (e.g., `500000` which is 0.5 USDC) and click **Commit Bid** (submits the SHA-256 hash on-chain to hide your bid).
  6. Wait/Simulate reveal phase: Click **Reveal Bid** and enter the same amount to verify the commitment on-chain.
* **What to say**: *"Once the group is active, members contribute their cycle funds. I will contribute my 10 USDC. Next, I'll place a sealed bid in the commit-reveal phase. I submit a SHA-256 hash of my bid, then reveal it during the reveal phase. The lowest unique bid wins the pool."*

### 5. Multi-Sig Dispute Resolution (1:30 - 1:50)
* **What to show**: The **Disputes** page.
* **What to do**:
  1. Click **Disputes** in the nav bar.
  2. Click **Raise Dispute** on your group (simulating a member defaulting or disputing a cycle).
  3. Show the open dispute record.
  4. Click **Vote** inside the Dispute Modal (arbitrators vote on resolutions like `ForceDefault` or `ReversePayout`).
* **What to say**: *"If a member defaults or a disagreement occurs, a dispute can be raised. This triggers our Multi-Sig Dispute contract where an arbitrator panel votes on-chain to resolve or dismiss the dispute."*

### 6. SEP-24 Fiat Ramp & Conclusion (1:50 - 2:00)
* **What to show**: The **SEP-24 Ramp** popup/panel on the dashboard.
* **What to do**:
  1. Show the **Deposit INR / Withdraw INR** input fields.
  2. Click **Initiate Deposit** to show the interactive anchor window opening.
  3. Conclude the video.
* **What to say**: *"Finally, we integrated a SEP-24 INR fiat ramp to allow users to easily deposit bank funds directly into USDC on Stellar. This concludes the demo of ChainChit — bringing transparency and trust to rotating savings. Thank you!"*
