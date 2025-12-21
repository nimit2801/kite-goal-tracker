# Kite Connect Holdings Viewer

A minimal, aesthetically pleasing web application to view your Zerodha Kite holdings.

## Setup

1.  **Install Dependencies**:

    ```bash
    npm install
    ```

2.  **Configure Environment**:
    Create a `.env` file in the root directory (you can copy `.env.example`):

    ```bash
    cp .env.example .env
    ```

    Then, open `.env` and fill in your `KITE_API_KEY` and `KITE_API_SECRET` from the [Kite Developer Console](https://developers.kite.trade/apps).

3.  **Run the App**:

    ```bash
    node server.js
    ```

4.  **Open in Browser**:
    Go to [http://localhost:3001](http://localhost:3001).

## Features

- Secure OAuth2 Login with Zerodha.
- Real-time fetching of holdings.
- Modern, dark-themed UI with glassmorphism effects.
- Net P&L calculation.
