const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const FormData = require('form-data');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, '../frontend')));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// ============= TRIPO3D API INTEGRATION (v3) =============

// Tripo3D v3 configuration
const TRIPO_API_KEY = process.env.TRIPO_API_KEY;
const TRIPO_BASE_URL = "https://openapi.tripo3d.ai/v3";

// Helper function for Tripo3D v3 API calls
async function callTripoAPI(endpoint, method = 'GET', body = null, isJson = true) {
    const url = `${TRIPO_BASE_URL}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${TRIPO_API_KEY}`
    };

    if (isJson && body) {
        headers['Content-Type'] = 'application/json';
    }

    const options = { method, headers };

    if (body) {
        options.body = isJson ? JSON.stringify(body) : body;
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (data.code !== 0) {
        const suggestion = data.suggestion ? ` — ${data.suggestion}` : '';
        throw new Error(`Tripo3D API error [${data.code}]: ${data.message || 'Unknown error'}${suggestion}`);
    }

    return data.data;
}

// Check Tripo3D account balance
app.get('/api/tripo/balance', async (req, res) => {
    try {
        const data = await callTripoAPI('/account/balance');
        res.json({ success: true, data });
    } catch (error) {
        console.error('Tripo balance error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload image to Tripo3D (v3: POST /files)
app.post('/api/tripo/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image uploaded' });
        }

        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const response = await fetch(`${TRIPO_BASE_URL}/files`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TRIPO_API_KEY}`
            },
            body: formData
        });

        const data = await response.json();

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        if (data.code !== 0) {
            throw new Error(`Upload failed [${data.code}]: ${data.message}`);
        }

        // v3 returns file_token
        res.json({ success: true, file_token: data.data.file_token });
    } catch (error) {
        console.error('Tripo upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit image-to-3d task (v3: POST /generation/image-to-model)
app.post('/api/tripo/generate', async (req, res) => {
    try {
        const {
            file_token,                 // from upload — or pass `url` / `task_id` instead
            model = 'v3.1-20260211',
            texture = true,
            pbr = true,
            texture_quality = 'standard',
            geometry_quality = 'standard',
            enable_image_autofix = false,
            face_limit,
            quad = false
        } = req.body;

        if (!file_token) {
            return res.status(400).json({ success: false, error: 'file_token (or url / task_id) required' });
        }

        const taskData = {
            input: file_token,          // v3 accepts file_token / URL / task_id directly
            model,
            texture,
            pbr,
            texture_quality,
            geometry_quality,
            enable_image_autofix,
            quad
        };

        if (face_limit) taskData.face_limit = face_limit;

        const data = await callTripoAPI('/generation/image-to-model', 'POST', taskData);
        res.json({ success: true, task_id: data.task_id });
    } catch (error) {
        console.error('Tripo generate error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check task status (v3: GET /tasks/:id)
app.get('/api/tripo/task/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const data = await callTripoAPI(`/tasks/${taskId}`);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Tripo task status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit refine task
// NOTE: v3 has no separate refine task. Quality is controlled via
// geometry_quality / texture_quality at generation time. Kept here as a
// friendly no-op so older frontends don't break.
app.post('/api/tripo/refine', async (req, res) => {
    res.status(410).json({
        success: false,
        error: 'Refine task removed in Tripo v3. Use geometry_quality/texture_quality at generation time instead.'
    });
});

// Convert model format (v3: POST /models/convert)
app.post('/api/tripo/convert', async (req, res) => {
    try {
        const { task_id, format = 'GLTF', quad = false, face_limit = 10000 } = req.body;

        if (!task_id) {
            return res.status(400).json({ success: false, error: 'Task ID required' });
        }

        const taskData = {
            original_model_task_id: task_id,
            format,
            quad,
            face_limit
        };

        const data = await callTripoAPI('/models/convert', 'POST', taskData);
        res.json({ success: true, task_id: data.task_id });
    } catch (error) {
        console.error('Tripo convert error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= EXISTING ENDPOINTS =============

// Generate car recommendations using Mistral AI
app.post('/api/generate-car-recommendations', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('Generating car recommendations for prompt:', prompt);

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "mistral-large-latest",
                messages: [
                    {
                        role: 'user',
                        content: `Based on this car request: "${prompt}", recommend 3 specific cars that best match. Return ONLY a valid JSON object with this exact structure, no other text: {"cars":[{"make":"","model":"","year":"","price":"","engine":"","horsepower":"","description":"","matchScore":number}]}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Mistral API error:', errorText);
            return res.status(response.status).json({ error: 'Mistral API error' });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error in generate-car-recommendations:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate title using Mistral AI
app.post('/api/generate-title', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('Generating title for prompt:', prompt);

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "mistral-small-latest",
                messages: [
                    {
                        role: 'user',
                        content: `Create a creative, catchy title (max 5 words) and a one-sentence description for this image concept: "${prompt}". 
                        Return ONLY a JSON object with this exact structure: 
                        {"title": "creative title here", "description": "brief description here"}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 100
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Mistral API error:', errorText);
            return res.status(response.status).json({ error: 'Mistral API error' });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error in generate-title:', error);
        res.status(500).json({ error: error.message });
    }
});

// Submit image generation to AI Horde
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('Submitting image generation for prompt:', prompt);

        const response = await fetch('https://aihorde.net/api/v2/generate/async', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.HORDE_API_KEY
            },
            body: JSON.stringify({
                prompt: prompt,
                params: {
                    n: 1,
                    width: 704,
                    height: 512,
                    steps: 25,
                    cfg_scale: 7
                },
                models: ["stable_diffusion"]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AI Horde API error:', errorText);
            return res.status(response.status).json({ error: 'AI Horde API error' });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error in generate-image:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/image-status/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log('Checking status for job:', id);

        const response = await fetch(`https://aihorde.net/api/v2/generate/status/${id}`);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch status' });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error in image-status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Call Prompt Generator API to enhance prompts
app.post('/api/enhance-prompt', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('Enhancing prompt:', prompt);

        let promptGeneratorUrl = process.env.PROMPT_GENERATOR_URL;

        if (!promptGeneratorUrl) {
            if (process.env.NODE_ENV === 'production') {
                promptGeneratorUrl = process.env.NGROK_URL || 'http://localhost:5000/generate';
            } else {
                promptGeneratorUrl = 'http://localhost:5000/generate';
            }
        }

        console.log(`Calling prompt generator at: ${promptGeneratorUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(promptGeneratorUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    temperature: 0.9,
                    top_k: 8,
                    max_length: 80,
                    num_return_sequences: 3
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const fallbackPrompts = [
                    `${prompt}, highly detailed, masterpiece, trending on ArtStation`,
                    `${prompt}, cinematic lighting, 8k resolution, professional photography`,
                    `${prompt}, intricate details, sharp focus, award winning`
                ];

                return res.json({
                    enhancedPrompts: fallbackPrompts,
                    original: prompt,
                    fallback: true
                });
            }

            const data = await response.json();

            let enhancedPrompts = [];
            if (Array.isArray(data)) {
                enhancedPrompts = data;
            } else if (data.enhancedPrompts) {
                enhancedPrompts = data.enhancedPrompts;
            } else {
                enhancedPrompts = [prompt];
            }

            res.json({
                enhancedPrompts: enhancedPrompts,
                original: prompt
            });

        } catch (fetchError) {
            clearTimeout(timeoutId);

            const fallbackPrompts = [
                `${prompt}, highly detailed, masterpiece, trending on ArtStation`,
                `${prompt}, cinematic lighting, 8k resolution, professional photography`,
                `${prompt}, intricate details, sharp focus, award winning`
            ];

            res.json({
                enhancedPrompts: fallbackPrompts,
                original: prompt,
                fallback: true
            });
        }

    } catch (error) {
        console.error('Error in enhance-prompt:', error);
        const fallbackPrompts = [
            `${prompt}, highly detailed`,
            `${prompt}, cinematic lighting`,
            `${prompt}, masterpiece`
        ];
        res.json({
            enhancedPrompts: fallbackPrompts,
            original: prompt
        });
    }
});

// Proxy for Tripo3D models to avoid CORS
app.get('/api/tripo/proxy-model', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter required' });
        }

        console.log('Proxying model from:', url);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status}`);
        }

        // Get the content type from the response
        const contentType = response.headers.get('content-type') || 'model/gltf-binary';

        // Set appropriate headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');

        // Stream the response to the client
        response.body.pipe(res);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check prompt generator status
app.get('/api/prompt-generator-status', async (req, res) => {
    try {
        const promptGeneratorUrl = process.env.PROMPT_GENERATOR_URL || 'http://localhost:5000/health';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(promptGeneratorUrl, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            res.json({
                status: 'connected',
                url: promptGeneratorUrl,
                details: data
            });
        } else {
            res.json({
                status: 'error',
                url: promptGeneratorUrl,
                code: response.status
            });
        }
    } catch (error) {
        res.json({
            status: 'disconnected',
            url: process.env.PROMPT_GENERATOR_URL || 'http://localhost:5000/health',
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔑 Mistral API Key: ${process.env.MISTRAL_API_KEY ? '✓ Loaded' : '✗ Missing'}`);
    console.log(`🔑 Horde API Key: ${process.env.HORDE_API_KEY ? '✓ Loaded' : '✗ Missing'}`);
    console.log(`🔑 Tripo3D API Key: ${process.env.TRIPO_API_KEY ? '✓ Loaded' : '✗ Missing'}`);
    console.log(`🤖 Prompt Generator: ${process.env.PROMPT_GENERATOR_URL || 'http://localhost:5000/generate (default)'}`);
    console.log(`🧊 Tripo3D API: v3 (https://openapi.tripo3d.ai/v3)`);

    if (process.env.NGROK_URL) {
        console.log(`🌐 Using ngrok tunnel: ${process.env.NGROK_URL}`);
    }
});
