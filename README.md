# EmergentJS

EmergentJS is an AI-powered interactive narrative engine built with Next.js. It creates living, breathing worlds where characters have their own lives, motivations, and off-screen interactions.

![EmergentJS Status](https://img.shields.io/badge/Status-Active_Development-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

## 🌟 Features

- **Dynamic Interactive Storytelling**: Interact with a world narrated by an AI Game Master that adapts to your choices.
- **Living World Simulation**: Characters don't just wait for you to talk to them. The "World Engine" stimulates off-screen interactions between characters based on their goals and relationships.
- **Dual-Layer Time System**:
    - **Narrative Time**: Fluid, story-driven time (e.g., "Late Afternoon").
    - **Logic Ticks**: Deterministic time-tracking for simulation mechanics.
- **Character Discovery**: Characters are dynamically discovered and added to the world state as you encounter them or hear about them.
- **Multiple Scenarios**: Support for various world settings and scenarios (e.g., Noir Fantasy, Sci-Fi).
- **Mobile-Responsive UI**: A modern, responsive interface designed for both desktop and mobile play.

## 🛠 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Directory)
- **AI Integration**: [Vercel AI SDK](https://sdk.vercel.ai/docs)
- **LLM Provider**: [OpenRouter](https://openrouter.ai/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: TypeScript

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai/) API Key

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/willie/emergent-js.git
    cd emergent-js
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment Variables:**
    Create a `.env.local` file in the root directory and add your OpenRouter API key:
    ```env
    OPENROUTER_API_KEY=your_api_key_here
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Open the app:**
    Visit [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Documentation

For a deep dive into how the AI constructs the world and handles simulations, check out the documentation in the `docs/` folder:

- [Prompt Architecture](./docs/PROMPT_ARCHITECTURE.md): Explains the Main Game Loop (Narrator) and Off-Screen Simulation (World Engine).

## 🧩 Architecture Overview

EmergentJS uses a dual-pipeline architecture:

1.  **The Narrator (Main Loop)**: Handles direct user interaction, constructing dynamic system prompts based on the current location, present characters, and time.
2.  **The World Engine (Simulation Loop)**: Runs in the background when time passes or characters are off-screen. It generates dialogues between NPCs and extracts "World Events" that impact the global state.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.


