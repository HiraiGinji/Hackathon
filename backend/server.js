const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

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

        // Get the prompt generator URL from environment or use default
        // Check if we're using ngrok tunnel
        let promptGeneratorUrl = process.env.PROMPT_GENERATOR_URL;
        
        // If no env var set, try to determine the best URL
        if (!promptGeneratorUrl) {
            // Check if we're in development vs production
            if (process.env.NODE_ENV === 'production') {
                // In production, use the ngrok URL if available, otherwise fallback to localhost
                promptGeneratorUrl = process.env.NGROK_URL || 'http://localhost:5000/generate';
            } else {
                // In development, use localhost
                promptGeneratorUrl = 'http://localhost:5000/generate';
            }
        }

        console.log(`Calling prompt generator at: ${promptGeneratorUrl}`);

        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

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
                const errorText = await response.text();
                console.error('========== PROMPT GENERATOR ERROR ==========');
                console.error('Status Code:', response.status);
                console.error('Status Text:', response.statusText);
                console.error('URL Called:', promptGeneratorUrl);
                console.error('===========================================');
                
                // Fallback to simple enhanced prompts
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
            
            // Handle different response formats
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
            
            if (fetchError.name === 'AbortError') {
                console.error('Prompt generator request timed out');
            } else {
                console.error('Fetch error:', fetchError.message);
            }
            
            // Fallback to simple enhanced prompts
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
        // Fallback to original prompt with simple enhancements
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

// New endpoint to check prompt generator status
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
    console.log(`🤖 Prompt Generator: ${process.env.PROMPT_GENERATOR_URL || 'http://localhost:5000/generate (default)'}`);
    
    // Show ngrok info if configured
    if (process.env.NGROK_URL) {
        console.log(`🌐 Using ngrok tunnel: ${process.env.NGROK_URL}`);
    }
});
