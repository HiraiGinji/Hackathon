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

        // Call the Python Prompt Generator service
        // If running locally on same machine
        const promptGeneratorUrl = process.env.PROMPT_GENERATOR_URL || 'http://localhost:5000/generate';
        
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
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('========== PROMPT GENERATOR ERROR ==========');
            console.error('Status Code:', response.status);
            console.error('Status Text:', response.statusText);
            console.error('Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
            console.error('Raw Error Response:', errorText);
            
            // Try to parse as JSON if possible
            try {
                const errorJson = JSON.parse(errorText);
                console.error('Parsed Error JSON:', JSON.stringify(errorJson, null, 2));
            } catch (e) {
                console.error('Response is not JSON (plain text or HTML)');
            }
            
            console.error('URL Called:', promptGeneratorUrl);
            console.error('Request Payload:', JSON.stringify({ prompt, temperature: 0.9, top_k: 8, max_length: 80, num_return_sequences: 3 }));
            console.error('===========================================');
            
            // Fallback to original prompt if generator fails
            return res.json({ 
                enhancedPrompts: [prompt, prompt, prompt],
                original: prompt,
                debug: {
                    error: true,
                    statusCode: response.status,
                    errorText: errorText.substring(0, 500) // Limit size
                }
            });
        }

        const data = await response.json();
        
        // The prompt generator returns an array of enhanced prompts
        res.json({ 
            enhancedPrompts: data,
            original: prompt 
        });
        
    } catch (error) {
        console.error('Error in enhance-prompt:', error);
        // Fallback to original prompt
        res.json({ 
            enhancedPrompts: [prompt],
            original: prompt 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔑 Mistral API Key: ${process.env.MISTRAL_API_KEY ? '✓ Loaded' : '✗ Missing'}`);
    console.log(`🔑 Horde API Key: ${process.env.HORDE_API_KEY ? '✓ Loaded' : '✗ Missing'}`);
});