# NOKTA-POS (Point of Sale System)

NOKTA-POS is a modern, standalone Point of Sale web application designed specifically for restaurants and cafes. It is built as a Progressive Web App (PWA) to work seamlessly on Android tablets, desktop browsers, and local networks (LAN) without requiring an active internet connection.

## 🚀 Key Features

*   **Multi-Device Sync:** Real-time updates across multiple tablets and cashiers using Socket.IO.
*   **Offline-First:** Functions fully on a local network. Service Workers and IndexedDB ensure stability.
*   **Bilingual & RTL:** Native support for Arabic and English with seamless Right-to-Left (RTL) layout switching.
*   **Comprehensive Order Management:** Supports Dine-in, Takeaway, and Delivery orders.
*   **Kitchen Display System (KDS):** Instant order transmission to the kitchen screen.
*   **Robust Role-based Access:** Pin and Password-based employee logins with granular permission control and max discount enforcement.
*   **Audit Trail:** Detailed logging of all sensitive actions (order modification, deletion, discounting).
*   **Data Safety:** Built-in `node:sqlite` database with WAL mode and automatic atomic transactions to prevent data corruption.
*   **Daily Closings & Reports:** Generate end-of-shift reports and Excel-based sales analytics.

## 🛠 Tech Stack

*   **Backend:** Node.js (v22.5+), Express.js
*   **Real-time:** Socket.IO
*   **Database:** `node:sqlite` (SQLite built-in to Node.js)
*   **Frontend:** Vanilla JavaScript, HTML5, CSS3 (No heavy frameworks for maximum performance)
*   **PWA:** Service Worker + Web App Manifest

## 📦 Installation & Setup

1.  **Prerequisites:** Ensure you have [Node.js](https://nodejs.org/) installed (Version 22.5 or higher is required for `node:sqlite`).
2.  **Install dependencies:**
    ```bash
    npm install
    # or using pnpm
    pnpm install
    ```
3.  **Start the server:**
    ```bash
    node server.js
    ```
4.  **Access the POS:** Open your browser and navigate to `http://localhost:3000` (or your local IP address on the network).
5.  **Initial Setup:** You will be prompted to create the first Administrator account upon your first visit.

## 📚 Documentation

For developers looking to contribute, extend, or maintain the system, please refer to the following comprehensive guides:

*   **[Project Handoff & Architecture (`PROJECT-HANDOFF.md`)](./PROJECT-HANDOFF.md)**: Start here. Contains the architectural philosophy, recent major fixes, file mapping, and current system state.
*   **[Technical Specifications (`PROJECT-SPEC.md`)](./PROJECT-SPEC.md)**: Contains database schemas, API endpoint definitions, and detailed permissions documentation.
*   **[Architecture Plan (`ARCHITECTURE-PLAN.md`)](./ARCHITECTURE-PLAN.md)**: Outline for future scaling and structural decoupling.
*   **[Remote Access (`REMOTE-ACCESS.md`)](./REMOTE-ACCESS.md)**: Guide for setting up secure remote management using Tailscale.
*   **[Audit Changelog (`audit/CHANGELOG.md`)](./audit/CHANGELOG.md)**: A strict log of all major code changes, required for every update.
