# DeFiHackLabs-Incident-Explorer

This project combines [DeFiHackLabs](https://github.com/SunWeb3Sec/DeFiHackLabs) and Root Cause Report [RCA](https://github.com/SunWeb3Sec/DeFi-Security-Breach-RCA) into an Incident Explorer, making it easy for everyone to search, browse, and learn from DeFi security incidents.

**DeFiHackLabs Incident Explorer:** [https://defihacklabs.io/explorer/](https://defihacklabs.io/explorer/)

## Data Files Overview

### `data.js`
- **Purpose:**
  - Contains the main array of DeFi security incidents.
  - Each entry includes metadata such as the project name, date, type of attack, amount lost, loss type (e.g., USD, ETH, BTC), and links to relevant contracts or proofs of concept.
- **Usage:**
  - The frontend JavaScript reads this file to render the incidents table, calculate statistics (like Total Incidents and Total Loss), and populate filter options (year, attack type, etc).

### `rootcause_data.json`
- **Purpose:**
  - Stores detailed root cause analyses for each incident, indexed by project name.
  - Each entry provides an in-depth explanation of how the attack happened, technical details, and references (such as transaction links or exploit code).
- **Usage:**
  - The frontend fetches this file to display root cause details in modals or detail views when a user clicks on an incident.
  - Enables users to learn from past incidents and understand common vulnerabilities in DeFi protocols.

## How It Works
- The application loads `data.js` and `rootcause_data.json` on startup.
- Users can filter, sort, and search incidents.
- Clicking an incident displays the root cause analysis (if available).
- Statistics such as Total Incidents and Total Loss are calculated dynamically from the data.

## File Structure (excerpt)
```
DeFiHackLabs-Explorer-main/
├── data.js                # Main incidents data
├── rootcause_data.json    # Root cause analyses
├── index.html             # Main web page
├── script.js              # Frontend logic
└── ...
```

## Contribution
Feel free to add new incidents to `data.js` or expand analyses in `rootcause_data.json` to help the community learn more about DeFi security!
