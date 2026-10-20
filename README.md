# QPTech: AI Image Generator

> A hackathon project that pairs a web frontend with a Node.js backend and a Python prompt/generation toolkit to turn ideas into AI-generated images.

---

## Overview

QPTech is split into three parts that work together:

| Folder              | Role                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `frontend/`         | User interface for entering ideas and viewing generated results   |
| `backend/`          | Node.js server (`backend/server.js`) that serves the app and API  |
| `prompt-generator/` | Python tooling for prompt generation and the AI/image pipeline    |

## Tech Stack

- **Backend:** Node.js 18.x (`nodemon` for development)
- **Frontend:** web client served alongside the backend
- **AI / Python:** `transformers`, `huggingface-hub`, `einops`, `omegaconf`, `Pillow`, `rembg` (background removal), `trimesh` (3D mesh handling), `imageio[ffmpeg]` (image/video I/O)

## Project Structure

```
Hackathon/
├── backend/            # Node.js server
├── frontend/           # Web UI
├── prompt-generator/   # Python prompt / generation code
├── package.json        # Node scripts and engine requirements
├── package-lock.json
├── requirements.txt    # Python dependencies
└── .gitignore
```

## Getting Started

### Prerequisites

- [Node.js 18.x](https://nodejs.org/)
- [Python 3.9+](https://www.python.org/) and `pip`
- [FFmpeg](https://ffmpeg.org/) (used by `imageio[ffmpeg]`)
- A [Hugging Face](https://huggingface.co/) account/token if the models you use require one

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/HiraiGinji/Hackathon.git
   cd Hackathon
   ```

2. **Install Node dependencies**
   ```bash
   npm install
   ```
   The `postinstall` script automatically runs `npm install` inside `backend/` as well.

3. **Install Python dependencies**
   ```bash
   python -m venv venv
   source venv/bin/activate        # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   Create a `.env` file in `backend/` (and `prompt-generator/` if needed) with any API keys or tokens your setup requires, for example:
   ```env
   PORT=3000
   HUGGINGFACE_TOKEN=your_token_here
   ```

### Running the App

```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

Then open `http://localhost:3000` in your browser (adjust the port to match your configuration).

## Scripts

| Command       | Description                                    |
| ------------- | ---------------------------------------------- |
| `npm start`   | Starts the backend with `node backend/server.js` |
| `npm run dev` | Starts the backend with `nodemon`              |

## Usage

1. Open the web app.
2. Enter a description or idea for the image you want.
3. Let the prompt generator refine it and send it to the AI pipeline.
4. View and download the generated result.
