# Contributing to Kite Goal Tracker 🚀

First off, thanks for taking the time to contribute!

## How Can I Contribute?

### Reporting Bugs

- **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/nimit2801/kite-goal-tracker/issues).
- If you're unable to find an open issue addressing the problem, open a new one. Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

- Open a new issue with a clear title and detailed description of the suggested enhancement.
- Provide arguments and/or code examples of why this enhancement would be useful.

### Pull Requests

1.  Fork the repo and create your branch from `main`.
2.  If you've added code that should be tested, add tests.
3.  Ensure the test suite passes.
4.  Make sure your code lints.
5.  Issue that pull request!

## Development Setup

1.  **Clone the repo**:

    ```bash
    git clone https://github.com/nimit2801/kite-goal-tracker.git
    cd kite-goal-tracker
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

3.  **Setup Environment**:

    - Copy `.env.example` to `.env`.
    - Fill in your `KITE_API_KEY`, `KITE_API_SECRET`, and optional `GEMINI_API_KEY`.

4.  **Run the app**:

    ```bash
    npm start
    ```

5.  **Open browser**:
    Navigate to `http://localhost:3001`.

## Style Guide

- Use **JavaScript (ES6+)** with Clean Code principles.
- **CSS Variables** are used for theming in `public/style.css`. Conserve the dark/glassmorphism aesthetic.
- **HTML** Structure should remain semantic.

Happy Coding! 🎉
