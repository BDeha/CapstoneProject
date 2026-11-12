# Interactive Privilege Walk Workshop Web Application

An interactive full-stack web and local desktop application built for facilitating live, anonymous **Privilege Walk** workshops in classrooms and community events. Participants respond to 29 structured socio-economic and identity prompts under a randomized anonymous alias (`User_XXXX`), observe their relative position along a live class spectrum, submit qualitative post-walk reflections, and generate real-time analytics for facilitators.

**Live Hosted App:** [https://capstoneproject-re11.onrender.com](https://capstoneproject-re11.onrender.com)

> **Important Note on Live Link Wake-Up Time:** The public deployment is hosted on Render's free tier, which automatically spins down the server after **15 minutes of inactivity**. If nobody has visited the link recently, the very first request may take **~50 seconds** to wake the server up. All sessions, student accounts, scores, and reflections are stored externally in Turso Cloud SQLite and remain permanently saved across sleep cycles. *(Facilitator tip: Open the link ~1 minute before starting a live workshop so it loads instantaneously for participants.)*

---

## Core Features

### Student / Participant Portal
* **Session-Gated Registration:** Students join an active workshop using a facilitator-provided **Session Join Code** and receive an auto-generated anonymous alias (`User_XXXX`) to protect privacy while keeping real identities separated in the database.
* **Timed 29-Prompt Privilege Walk:** Displays 29 advantage/disadvantage prompts one at a time with a 2-second reading buffer before enabling **Yes / No** responses, automatically calculating cumulative position scores (`+1`, `0`, or `-1`).
* **Class Position Spectrum:** Visualizes every participant's final score along a horizontal spectrum (`Further Behind` ↔ `Furthest Ahead`) upon completion.
* **Post-Walk Reflection Module:** Collects qualitative student reflections tied to their anonymous alias.

### Facilitator / Admin Portal
* **Session Lifecycle Management:** Create, re-activate, close (`end`), or permanently delete workshop sessions with automatic expiration windows.
* **Automatic Student Join URL:** Displays the active join link (automatically detecting the public cloud URL in production or the host's local Wi-Fi IP address when run offline).
* **Real-Time Response Density Heatmap:** Color-coded breakdown across all 29 prompts (`Q1`–`Q29`) showing exact `Yes` percentages and live response counts for any selected session.
* **Score Distribution Histogram & CSV Export:** Displays class score frequency distributions and exports anonymized session results (`Student Alias, Total Score, Reflection Response`) to CSV.

---

## Tech Stack
* **Frontend:** React (`react-scripts`), HTML5, CSS3
* **Backend:** Node.js, Express v5, `bcryptjs`, `cors`
* **Database:** `@libsql/client` supporting both **Turso** (cloud SQLite for persistent 24/7 hosting) and **local embedded SQLite** (`privilege_walk.db` for zero-setup offline/LAN workshops)
* **Cloud Hosting:** Render (Web Service) + Turso (Cloud SQLite)

---

## Repository Structure

```text
CapstoneProject/
├── .gitignore
├── README.md
└── privilege-walk-app/
    ├── privilege-frontend/       # React client application
    │   ├── public/
    │   └── src/
    │       └── App.js
    └── privilege-backend/        # Express REST API + static build server
        ├── index.js
        └── package.json
```

---

## Running Locally (Offline / Same Wi-Fi Mode)

You can run the entire application locally with zero external cloud accounts—when `TURSO_DATABASE_URL` is not set, the backend automatically creates and seeds a local `privilege_walk.db` SQLite file.

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or newer)

### Setup & Launch
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/BDeha/CapstoneProject.git](https://github.com/BDeha/CapstoneProject.git)
   cd CapstoneProject/privilege-walk-app
   ```

2. **Install dependencies and build the React frontend:**
   ```bash
   cd privilege-frontend
   npm install
   npm run build
   ```

3. **Install backend dependencies and start the server:**
   ```bash
   cd ../privilege-backend
   npm install
   node index.js
   ```

4. **Open the application:**
   * **Facilitator / Host:** Visit `http://localhost:3000`
   * **Default Local Facilitator Credentials:** Username `admin` / Password `admin123`
   * **Local Wi-Fi Participants:** Share the `http://<YOUR-LOCAL-IP>:3000` URL displayed at the top of the Facilitator Portal with devices on the same network.

---

## Cloud Deployment Configuration (Render + Turso)

To deploy your own free, persistent cloud instance:

1. **Database (Turso):** Create a free SQLite database at [turso.tech](https://turso.tech) and generate a **Database URL** (`libsql://...`) and **Auth Token**.
2. **Web Service (Render):** Connect this repository to a free Node Web Service on [render.com](https://render.com) with:
   * **Root Directory:** `privilege-walk-app`
   * **Build Command:** `cd privilege-frontend && npm install && npm run build && cd ../privilege-backend && npm install`
   * **Start Command:** `node privilege-backend/index.js`
3. **Environment Variables:** Configure the following keys in Render:

| Variable | Description |
| :--- | :--- |
| `TURSO_DATABASE_URL` | Your Turso database URL (`libsql://privilege-walk-...turso.io`) |
| `TURSO_AUTH_TOKEN` | Your Turso authentication token |
| `ADMIN_USER` | Custom Facilitator Portal username (defaults to `admin` if unset) |
| `ADMIN_PASS` | Custom Facilitator Portal password (defaults to `admin123` if unset) |

---

## Author
* **Benny-Hardy L. Deha** — Senior Computer Science Capstone Project, Mount Saint Mary's University (2026)