# QPTech: AI Image Generator

> A free generative-AI web platform that turns text into images, finds your dream car, and builds 3D models. Built for a hackathon by **BLSQP Development** (University of the East).

## 🚀 Try It Online

**Live demo: [https://hackathon-thkh.onrender.com](https://hackathon-thkh.onrender.com/)**

| Tool                | Link                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| 🏠 Home             | [hackathon-thkh.onrender.com](https://hackathon-thkh.onrender.com/)           |
| 🎨 AI Image         | [/everythingai.html](https://hackathon-thkh.onrender.com/everythingai.html)   |
| 🚗 Dream Car Finder | [/car.html](https://hackathon-thkh.onrender.com/car.html)                     |
| 🧊 3D Model         | [/3dmodel.html](https://hackathon-thkh.onrender.com/3dmodel.html)             |

> **Note:** The demo is hosted on Render. If it hasn't been visited in a while, the first load may take up to a minute while the server wakes up.

---

## Features

- **AI image generation**: turn a short text description into high-quality visuals, from concept art to product design
- **Prompt enhancer**: automatically adds style, mood, camera, and quality keywords to your prompt for better results
- **Dream car finder**: describe your ideal ride and the AI matches specs and style, and can generate images of it
- **3D model tool**: generate 3D models from your ideas
- **LLM reasoning**: Mistral AI powers smart reasoning and creative titles
- **Safety filtering**: a strict no-NSFW policy; inappropriate content is filtered and blocked

## How It Works

1. **Describe**: write a sentence, like "cyberpunk car" or "ethereal forest"
2. **AI enhance**: the prompt enhancer adds style keywords automatically
3. **Generate**: get your enhanced prompt and the generated result

### Prompt tips

| Technique             | Example                                         |
| --------------------- | ----------------------------------------------- |
| Be specific           | `red Ferrari 458 Italia, sunset highway, cinematic` |
| Add mood / atmosphere | `mystical forest, ethereal atmosphere, glowing` |
| Mention an art style  | `cyberpunk samurai, rain, neon lights`          |
| Camera & composition  | `mountain landscape, wide angle, dramatic clouds` |
| Negative concepts     | `beautiful beach, no people, sunset`            |
| Quality indicators    | `fantasy dragon, highly detailed, 8k`           |

## Tech Stack

- **Backend:** Node.js 18.x (`nodemon` for development)
- **Frontend:** multi-page web client (`index`, `everythingai`, `car`, `3dmodel`)
- **LLM:** Mistral AI
- **Python / AI:** `transformers`, `huggingface-hub`, `einops`, `omegaconf`, `Pillow`, `rembg`, `trimesh`, `imageio[ffmpeg]`
- **Hosting:** Render

## Project Structure

```
Hackathon/
├── backend/            # Node.js server (server.js)
├── frontend/           # Web UI pages
├── prompt-generator/   # Python prompt / generation code
├── package.json        # Node scripts and engine requirements
├── package-lock.json
├── requirements.txt    # Python dependencies
└── .gitignore
```

## Run It Locally

### Prerequisites

- [Node.js 18.x](https://nodejs.org/)
- [Python 3.9+](https://www.python.org/) and `pip`
- [FFmpeg](https://ffmpeg.org/)
- API keys for the services you use (e.g. Mistral, Hugging Face)

### Installation

```bash
# 1. Clone
git clone https://github.com/HiraiGinji/Hackathon.git
cd Hackathon

# 2. Node dependencies (also installs backend/ via postinstall)
npm install

# 3. Python dependencies
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment variables

Create a `.env` file in `backend/` with the keys your setup needs, for example:

```env
PORT=3000
MISTRAL_API_KEY=your_key_here
HUGGINGFACE_TOKEN=your_token_here
```

> Variable names are examples. Match them to what `backend/server.js` reads.

### Start the app

```bash
npm start        # production
npm run dev      # development (auto-restart with nodemon)
```

Then open `http://localhost:3000`.

## Scripts

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `npm start`   | Starts the backend with `node backend/server.js` |
| `npm run dev` | Starts the backend with `nodemon`                |
